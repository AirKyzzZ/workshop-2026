"""Flux caméra de bord, propriétaire unique du périphérique.

`/dev/video0` ne supporte qu'une ouverture à la fois. Le flux vit donc dans le processus
de l'API, dans un fil qui tourne en continu, et tout le reste du système passe par lui :
le terminal pour vérifier un visage après un badge, le dashboard pour afficher l'image.

Aucune image n'est écrite sur disque. Les trames vivent en mémoire le temps d'être servies,
et l'enrôlement ne conserve que l'empreinte de 128 réels.
"""

import threading
import time

import cv2

from . import db, surveillance, visage

PERIODE_VEILLE_S = 1.0
PERIODE_SURVEILLANCE_S = 1.0
"""Cadence quand seule la surveillance a besoin de la camera. Detecter un visage coute
peu, mais le faire cinq fois par seconde en continu porte le SoC au-dela de sa consigne :
une image par seconde suffit a attraper un geste tenu devant l'objectif."""
PERIODE_REPOS_S = 0.20
PERIODE_VISAGE_S = 0.5
"""Cadence de la detection de visage quand personne ne se fait verifier.

Le detecteur tournait sur chaque image, donc cinq fois par seconde des qu'un spectateur
ouvrait le flux video : a lui seul il consommait un quart de coeur et le SoC montait a
81 °C, ou le garde thermique suspendait la surveillance. Or le cadre d'un visage ne bouge
pas en deux cents millisecondes. Deux mesures par seconde suffisent pour l'incrustation,
et le controle d'acces garde sa pleine cadence."""
PERIODE_CONTROLE_S = 0.08
"""Deux cadences. SFace coute environ 100 ms par image : le calculer en continu
consomme un coeur entier et fait monter le SoC au-dela de sa consigne thermique.
Au repos on se contente de detecter, ce qui est dix fois moins cher."""
FRAMES_POUR_ACCORD = 3
DELAI_VERIFICATION_S = 8.0
MAINTIEN_VERDICT_S = 6.0
QUALITE_JPEG = 70

VERT = (88, 214, 75)
ROUGE = (95, 112, 244)
AMBRE = (60, 163, 232)
GRIS = (150, 145, 145)


def modules_armes():
    from . import modules
    return modules.actif("surveillance")

TTL_MAIN_S = 6.0
"""Une main vue recemment garde l'analyse ouverte meme sans visage : c'est ce qui permet
de continuer a lire un geste fait devant la tete, sans faire tourner MediaPipe en
permanence sur une piece vide."""

TTL_AUTEUR_S = 45.0
"""Duree pendant laquelle la derniere personne reconnue reste l'auteur presume.

Un geste se fait souvent main devant le visage, et le detecteur perd alors la tete. Sans
ce report, l'incident devient anonyme au moment precis ou il compte."""


class Flux:
    def __init__(self):
        self.verrou = threading.Lock()
        self.actif = False
        self.fil = None
        self.jpeg = None
        self.ts = 0.0
        self.visage_present = False
        self.surface = 0
        self.empreinte = None
        self.image_brute = None
        self.boite = None
        self.erreur = None
        self.verification = None
        self.spectateurs = 0
        self.surveillance = None
        self.derniere_detection = []
        self.auteur_vu = None
        self.auteur_vu_le = 0.0
        self.gabarits = {}
        self.gabarits_le = 0.0
        self._thermique_le = 0.0
        self._main_vue_le = 0.0
        self._vignette = None
        self._visage_le = 0.0
        self.mouvement = 0.0
        self.occupe = False
        self.echecs = 0
        self.chemin = None

    # ---------- cycle de vie ----------

    def demarrer(self):
        if self.actif:
            return
        self.actif = True
        self.fil = threading.Thread(target=self._boucle, daemon=True)
        self.fil.start()

    def arreter(self):
        self.actif = False
        if self.fil:
            self.fil.join(timeout=2)

    # ---------- verification ----------

    def armer(self, nom, gabarits):
        with self.verrou:
            self.verification = {
                "nom": nom, "gabarits": gabarits, "etat": "en_cours",
                "score": 0.0, "accords": 0, "expire": time.time() + DELAI_VERIFICATION_S,
                "affichage": 0.0, "motif": "présentez votre visage",
            }

    def armer_surveillance(self, conn):
        """La surveillance a besoin d'une connexion a la base : elle vient de l'API."""
        self.surveillance = surveillance.Surveillance(conn)

    def _identifier(self, img, boite):
        """Qui est devant l'objectif. Un incident non attribue ne sert a rien.

        Les gabarits sont relus toutes les deux minutes : un enrolement en cours doit etre
        pris en compte sans redemarrer le service.
        """
        s = self.surveillance
        if s is None or boite is None:
            return None
        maintenant = time.time()
        if maintenant - self.gabarits_le > 120:
            self.gabarits_le = maintenant
            self.gabarits = {nom: db.gabarits(s.conn, nom)
                             for nom, _ in db.membres_enroles(s.conn)}
        if not self.gabarits:
            return None
        try:
            empreinte = visage.empreinte(img, boite)
        except Exception:
            return None
        meilleur, score = None, 0.0
        for nom, gabarits in self.gabarits.items():
            v = visage.comparer(empreinte, gabarits)
            if v > score:
                meilleur, score = nom, v
        return meilleur if score >= visage.SEUIL_COSINUS else None

    def regarder(self, delta):
        """Compte les flux MJPEG ouverts. Sans spectateur ni controle, la boucle dort.

        Detecter et encoder en continu coutait un demi-coeur pour personne, et faisait
        monter le SoC au-dela de sa consigne thermique."""
        with self.verrou:
            self.spectateurs = max(0, self.spectateurs + delta)

    def desarmer(self):
        with self.verrou:
            self.verification = None

    def maintenir_verdict(self):
        with self.verrou:
            if self.verification is not None:
                self.verification["affichage"] = time.time() + MAINTIEN_VERDICT_S

    def etat_verification(self):
        """Le verdict survit a la verification elle-meme.

        Sans ce maintien, l'ecran de verrouillage voit `null` des que le controle rend
        la main, repasse en mode badge, et le dashboard n'apparait qu'au sondage suivant.
        On garde donc le verdict quelques secondes, le temps que la session s'ouvre.
        """
        with self.verrou:
            v = self.verification
            if v is None:
                return None
            if v["affichage"] and time.time() > v["affichage"]:
                self.verification = None
                return None
            return {"nom": v["nom"], "etat": v["etat"], "score": round(v["score"], 3),
                    "seuil": visage.SEUIL_COSINUS, "motif": v["motif"],
                    "reste": max(0.0, round(v["expire"] - time.time(), 1))}

    def attendre_verdict(self, delai=DELAI_VERIFICATION_S + 2):
        fin = time.time() + delai
        while time.time() < fin:
            with self.verrou:
                v = self.verification
                if v is None:
                    return None
                if v["etat"] != "en_cours":
                    return {"etat": v["etat"], "score": v["score"], "motif": v["motif"]}
            time.sleep(0.1)
        with self.verrou:
            v = self.verification
            score = v["score"] if v else 0.0
            if v:
                v["etat"] = "refuse"
                v["motif"] = "délai dépassé"
        return {"etat": "refuse", "score": score, "motif": "délai dépassé"}

    # ---------- boucle ----------

    def _boucle(self):
        capture = self._ouvrir_capture()
        if capture is None:
            return

        while self.actif:
            with self.verrou:
                controle = self.verification is not None
                regarde = self.spectateurs > 0

            if self.surveillance is not None and time.time() - self._thermique_le > 20:
                self._thermique_le = time.time()
                self.surveillance.verifier_thermique()

            ok, img = capture.read()
            if not ok:
                # Un debranchement ne doit pas laisser la surveillance aveugle pour de
                # bon : on relache et on retente, la camera peut revenir sur un autre
                # index.
                self.echecs += 1
                if self.echecs > 25:
                    capture.release()
                    time.sleep(2.0)
                    capture = self._ouvrir_capture()
                    if capture is None:
                        return
                time.sleep(0.2)
                continue
            self.echecs = 0

            # La pause thermique ne concerne que l'analyse MediaPipe, jamais l'image.
            # Encoder un JPEG coute quelques millisecondes ; couper le flux video quand le
            # SoC chauffe privait le dashboard de sa camera sans rien economiser d'utile,
            # et la boucle ne reprenait qu'une fois la temperature redescendue sous la
            # consigne de reprise, ce qui pouvait durer.
            surveille = (self.surveillance is not None and self.surveillance.active
                         and modules_armes())
            if not controle and not regarde and not surveille:
                time.sleep(PERIODE_VEILLE_S)
                continue

            try:
                self._traiter(img)
            except Exception as exc:
                self.erreur = str(exc)[:80]
            if controle:
                time.sleep(PERIODE_CONTROLE_S)
            elif regarde:
                time.sleep(PERIODE_REPOS_S)
            else:
                time.sleep(PERIODE_SURVEILLANCE_S)

        capture.release()

    def _ouvrir_capture(self):
        chemin = visage.resoudre_camera()
        capture = cv2.VideoCapture(chemin, cv2.CAP_V4L2)
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, visage.LARGEUR)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, visage.HAUTEUR)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not capture.isOpened():
            self.erreur = f"caméra indisponible sur {chemin}"
            self.actif = False
            return None
        self.erreur = None
        self.chemin = chemin
        self.echecs = 0
        return capture

    def _traiter(self, img):
        brute = img.copy()

        with self.verrou:
            controle = self.verification is not None

        # Pendant une verification, chaque image compte. Le reste du temps, le cadre du
        # visage est reutilise entre deux detections.
        maintenant = time.time()
        if controle or maintenant - self._visage_le >= PERIODE_VISAGE_S:
            self._visage_le = maintenant
            boite = visage.plus_grand_visage(img)
            self.boite_gardee = boite
        else:
            boite = getattr(self, "boite_gardee", None)

        with self.verrou:
            v = self.verification

        actif = v is not None and v["etat"] == "en_cours"
        empreinte = visage.empreinte(img, boite) if (actif and boite is not None) else None
        couleur, legende = GRIS, "aucun visage"

        # L'analyse tourne des que le module est arme, sans condition d'entree.
        #
        # Une porte de mouvement gardait auparavant MediaPipe au repos quand rien ne
        # bougeait. Elle economisait quelques watts et coutait la fiabilite : mesuree
        # devant quelqu'un qui gesticulait, la difference d'images plafonnait a 2.02 pour
        # un seuil de 3.2, donc le geste n'etait jamais analyse. Le detecteur de visage ne
        # tournant plus qu'a deux images par seconde, le budget thermique n'a plus besoin
        # de cette economie, et le garde thermique reste le vrai filet.
        self.mouvement = round(self._difference(brute), 2)
        self.occupe = True
        if self.surveillance is not None and self.surveillance.doit_analyser():
            self._surveiller(brute, boite)

        if actif:
            couleur, legende = self._juger(v, empreinte, boite)
        elif boite is not None:
            couleur, legende = AMBRE, (f"{self.auteur_vu} reconnu" if self.auteur_vu
                                       else "visage détecté")

        if boite is not None:
            self._annoter(img, boite, couleur, legende)
        self._annoter_gestes(img)
        if boite is None:
            self._bandeau(img, legende if actif else self._legende_veille(), couleur)

        ok, tampon = cv2.imencode(".jpg", img,
                                  [int(cv2.IMWRITE_JPEG_QUALITY), QUALITE_JPEG])
        with self.verrou:
            if ok:
                self.jpeg = tampon.tobytes()
                self.ts = time.time()
            self.visage_present = boite is not None
            self.surface = int(boite[2] * boite[3]) if boite is not None else 0
            self.empreinte = empreinte
            self.image_brute = brute
            self.boite = boite

    def _difference(self, img):
        """Ecart moyen avec l'image precedente. Sert au diagnostic, plus a decider."""
        vignette = cv2.cvtColor(cv2.resize(img, (64, 48)), cv2.COLOR_BGR2GRAY)
        precedente, self._vignette = self._vignette, vignette
        if precedente is None:
            return 0.0
        return float(cv2.absdiff(vignette, precedente).mean())

    def _surveiller(self, brute, boite):
        """Analyse comportementale, attribuee a la personne reconnue."""
        maintenant = time.time()
        if boite is not None and maintenant - self.auteur_vu_le > 10:
            trouve = self._identifier(brute, boite)
            if trouve:
                self.auteur_vu = trouve
                self.auteur_vu_le = maintenant
        elif self.auteur_vu and maintenant - self.auteur_vu_le > TTL_AUTEUR_S:
            self.auteur_vu = None
        try:
            rgb = cv2.cvtColor(brute, cv2.COLOR_BGR2RGB)
            trouves = self.surveillance.traiter(rgb, self.auteur_vu)
        except Exception as exc:
            self.erreur = str(exc)[:80]
            return
        if self.surveillance.observation.get("mains"):
            self._main_vue_le = maintenant
        if trouves:
            with self.verrou:
                self.derniere_detection = trouves

    def _legende_veille(self):
        o = self.surveillance.observation if self.surveillance else {}
        if o.get("mains"):
            return f"main suivie · {self.auteur_vu or 'auteur inconnu'}"
        return "aucun visage"

    def _annoter_gestes(self, img):
        """Dessine ce que le modele de mains vient de lire.

        Sans ce trace, la video ne montre rien de la detection : le geste est reconnu,
        enregistre et note au journal, mais l'ecran affiche encore « aucun visage ».
        """
        if self.surveillance is None:
            return
        o = self.surveillance.observation or {}
        h, l = img.shape[:2]
        for i, cadre in enumerate(o.get("boites") or []):
            geste = (o.get("gestes") or ["aucun"])[i] if i < len(o.get("gestes") or []) else "aucun"
            reconnu = geste != "aucun"
            couleur = ROUGE if reconnu else AMBRE
            x, y = int(cadre[0] * l), int(cadre[1] * h)
            largeur, hauteur = int(cadre[2] * l), int(cadre[3] * h)
            marge = 12
            x, y = max(0, x - marge), max(0, y - marge)
            largeur, hauteur = largeur + 2 * marge, hauteur + 2 * marge
            cv2.rectangle(img, (x, y), (x + largeur, y + hauteur), couleur, 2)

            doigts = (o.get("doigts") or [""])[i] if i < len(o.get("doigts") or []) else ""
            texte = (f"{geste.replace('_', ' ')} · {self.auteur_vu or 'non attribué'}"
                     if reconnu else f"main · {doigts}")
            larg_texte = min(l - x, 9 * len(texte) + 14)
            cv2.rectangle(img, (x, max(0, y - 22)), (x + larg_texte, y), couleur, -1)
            cv2.putText(img, texte, (x + 6, max(14, y - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (20, 20, 20), 1, cv2.LINE_AA)

    def _juger(self, v, empreinte, boite):
        with self.verrou:
            if time.time() > v["expire"]:
                v["etat"] = "refuse"
                v["motif"] = "délai dépassé, aucun visage reconnu"
                return ROUGE, v["motif"]

            if empreinte is None:
                return AMBRE, f"{v['nom']} · présentez votre visage"

            score = visage.comparer(empreinte, v["gabarits"])
            v["score"] = max(v["score"], score)

            if score >= visage.SEUIL_COSINUS:
                v["accords"] += 1
                if v["accords"] >= FRAMES_POUR_ACCORD:
                    v["etat"] = "accorde"
                    v["motif"] = f"visage reconnu, similarité {score:.3f}"
                    return VERT, v["motif"]
                return VERT, f"{v['nom']} · {score:.2f} ({v['accords']}/{FRAMES_POUR_ACCORD})"

            v["accords"] = 0
            return ROUGE, f"visage non reconnu · {score:.2f} < {visage.SEUIL_COSINUS}"

    @staticmethod
    def _annoter(img, boite, couleur, legende):
        x, y, l, h = (int(n) for n in boite[:4])
        cv2.rectangle(img, (x, y), (x + l, y + h), couleur, 2)
        cv2.rectangle(img, (x, y + h), (x + l, y + h + 22), couleur, -1)
        cv2.putText(img, legende[:34], (x + 6, y + h + 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (20, 20, 20), 1, cv2.LINE_AA)

    @staticmethod
    def _bandeau(img, texte, couleur):
        cv2.rectangle(img, (0, visage.HAUTEUR - 26), (visage.LARGEUR, visage.HAUTEUR),
                      couleur, -1)
        cv2.putText(img, texte[:46], (10, visage.HAUTEUR - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20, 20, 20), 1, cv2.LINE_AA)

    # ---------- lecture ----------

    def image(self):
        with self.verrou:
            return self.jpeg

    def etat(self):
        with self.verrou:
            return {
                "actif": self.actif, "erreur": self.erreur,
                "visage": self.visage_present, "surface": self.surface,
                "spectateurs": self.spectateurs, "chemin": self.chemin,
                "auteur": self.auteur_vu,
                "detections": self.derniere_detection,
                "surveillance": None if self.surveillance is None
                                else self.surveillance.etat(),
                "mouvement": self.mouvement,
                "occupe": self.occupe,
                "age": round(time.time() - self.ts, 2) if self.ts else None,
            }

    def empreinte_courante(self):
        """Calculee a la demande : l'enrolement est rare, la boucle tourne en continu."""
        with self.verrou:
            if self.empreinte is not None:
                return self.empreinte.copy()
            img, boite = self.image_brute, self.boite
        if img is None or boite is None:
            return None
        return visage.empreinte(img, boite)


flux = Flux()


def verifier(conn, nom):
    """Arme un contrôle facial et attend son verdict. Rend (accorde, score, motif)."""
    gabarits = db.gabarits(conn, nom)
    if not gabarits:
        return True, None, "aucun gabarit enrôlé"
    if not flux.actif:
        return True, None, "flux caméra inactif"

    flux.armer(nom, gabarits)
    verdict = flux.attendre_verdict()
    flux.maintenir_verdict()
    if verdict is None:
        return True, None, "contrôle interrompu"
    return verdict["etat"] == "accorde", verdict["score"], verdict["motif"]
