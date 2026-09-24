"""Détection comportementale : expression du visage et gestes de la main.

ATRIA note la conduite de l'équipage à partir de ce que la caméra voit. Un incident
attribué fait chuter le score de conduite de son auteur, et le régulateur refuse un poste
à qui passe sous le seuil. C'est une surveillance, elle est assumée comme telle : chaque
détection est écrite au journal avec son canal, sa gravité et son auteur.

Deux garde-fous encadrent la mesure. Un incident n'est retenu que s'il est attribué à une
personne reconnue, faute de quoi il est journalisé comme anonyme plutôt que collé au
hasard. Et la détection s'arrête d'elle-même si le SoC dépasse sa consigne thermique :
faire tomber la carte pendant une démonstration coûte plus cher que de rater un geste.
"""

import os
import subprocess
import time

MODELES = os.path.expanduser("~/atria/models/mediapipe")
VISAGE = os.path.join(MODELES, "face_landmarker.task")
MAIN = os.path.join(MODELES, "hand_landmarker.task")

PERIODE_S = 1.0
TEMP_MAX_C = 79.0
TEMP_REPRISE_C = 71.0
"""Le SoC de cette carte tourne deja pres de 70 °C au repos, refroidissement passif
compris, et le Pi 5 commence a reduire ses frequences a 80 °C. La consigne de coupure se
place donc juste en dessous.

La consigne de reprise, elle, doit etre franchement plus basse que le repos : a 73 °C elle
tombait dans la plage ou la carte oscille en permanence, et la surveillance restait
suspendue indefiniment apres un seul pic."""
REPOS_INCIDENT_S = 6.0
"""Un même geste tenu devant l'objectif ne doit compter qu'une fois."""

GRAVITES = {
    "doigt_honneur": 0.45,
    "poing_ferme": 0.20,
    "pouce_baisse": 0.15,
    "hostilite": 0.25,
    "cri": 0.20,
    "insulte": 0.40,
}

RATIO_DOIGT = 1.55
"""Doigt tendu : le bout est environ deux fois plus loin de sa base que ne l'est
l'articulation intermediaire. Replie, il revient vers cette base et le rapport tombe sous
un. Le seuil se place entre les deux."""

RATIO_POUCE = 1.35

FENETRE_FATIGUE_S = 60.0
PERIODE_FATIGUE_S = 15.0
ECHANTILLONS_FATIGUE_MIN = 8
FENETRE_BASE_S = 600.0
FERMETURE_RELATIVE = 0.55
ECHANTILLONS_BASE_MIN = 40
"""Le coefficient de clignement ne repose pas au meme niveau d'un visage a l'autre ni d'un
eclairage a l'autre : mesure avec un seuil absolu, un oeil grand ouvert a donne PERCLOS
1.00 sur trois releves consecutifs. La reference se prend donc sur la personne elle-meme,
au bas de sa propre distribution.

Cette reference se calcule sur dix minutes et non sur la fenetre de mesure. Calibrer sur
la minute en cours produirait l'erreur inverse : quelqu'un qui garde les yeux clos pendant
toute la fenetre verrait sa base descendre avec lui, et serait declare parfaitement
eveille. Personne ne garde les yeux fermes dix minutes devant un detecteur de visage, donc
le bas de la distribution longue est bien l'oeil ouvert.

Tant qu'il n'y a pas assez d'echantillons pour etablir cette base, aucun releve n'est
emis : une mesure fausse vaut moins que pas de mesure."""
SEUIL_BAILLEMENT = 0.50
"""Mesure de somnolence inspiree du PERCLOS, la metrique de reference en automobile :
la part du temps ou les paupieres restent closes sur une fenetre glissante.

Une precision honnete sur ce que cette cadence permet : a une image par seconde, un
clignement de 150 ms passe entre deux mesures, donc la frequence de clignement n'est pas
mesurable ici. Ce qui l'est, et qui signe la somnolence, ce sont les fermetures qui durent
et les baillements, tous deux longs de plusieurs secondes."""

SEUIL_HOSTILITE = 0.55
"""Combinaison sourcils baissés, yeux plissés et bouche crispée."""


def disponible():
    return os.path.exists(VISAGE) and os.path.exists(MAIN)


def _boite(points):
    """Cadre normalise [x, y, largeur, hauteur] autour des 21 points d'une main."""
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    return [round(min(xs), 4), round(min(ys), 4),
            round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4)]


def temperature_soc():
    try:
        sortie = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True,
                                text=True, timeout=2).stdout
        return float(sortie.split("=")[1].split("'")[0])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return 0.0


class Analyse:
    """Charge les modèles MediaPipe au premier besoin et analyse une image."""

    def __init__(self):
        self.visage = None
        self.main = None
        self.erreur = None

    def _charger(self):
        if self.visage is not None or self.erreur:
            return
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mpp
            from mediapipe.tasks.python import vision

            self._mp = mp
            self._vision = vision
            self.visage = vision.FaceLandmarker.create_from_options(
                vision.FaceLandmarkerOptions(
                    base_options=mpp.BaseOptions(model_asset_path=VISAGE),
                    output_face_blendshapes=True,
                    num_faces=1))
            self.main = vision.HandLandmarker.create_from_options(
                vision.HandLandmarkerOptions(
                    base_options=mpp.BaseOptions(model_asset_path=MAIN),
                    num_hands=2))
        except Exception as exc:
            self.erreur = str(exc)[:120]

    def analyser(self, img_rgb):
        """Rend (détections, observation). L'observation sert au diagnostic en direct."""
        self._charger()
        if self.erreur:
            return [], {}

        paquet = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=img_rgb)
        trouves = []

        visages = self.visage.detect(paquet)
        hostilite = 0.0
        paupieres = None
        if visages.face_blendshapes:
            hostilite = self._hostilite(visages.face_blendshapes[0])
            if hostilite >= SEUIL_HOSTILITE:
                trouves.append(("hostilite", hostilite))
            paupieres = self._paupieres(visages.face_blendshapes[0])

        mains = self.main.detect(paquet)
        gestes = []
        doigts = []
        boites = []
        mesures = []
        for points in mains.hand_landmarks:
            geste, tendus, ratios = self._geste(points)
            gestes.append(geste[0] if geste else "aucun")
            doigts.append("".join(n[0].upper() if t else n[0]
                                  for n, t in tendus.items()))
            mesures.append({n: round(r, 2) for n, r in ratios.items()})
            boites.append(_boite(points))
            if geste:
                trouves.append(geste)

        observation = {"visages": len(visages.face_blendshapes),
                       "hostilite": round(hostilite, 3),
                       "paupieres": None if paupieres is None
                                    else [round(x, 3) for x in paupieres],
                       "mains": len(mains.hand_landmarks), "gestes": gestes,
                       "doigts": doigts, "boites": boites, "ratios": mesures,
                       "expressions": self._expressions(visages)}
        return trouves, observation

    @staticmethod
    def _paupieres(blendshapes):
        """Fermeture moyenne des paupieres, bouche ouverte, plissement des yeux."""
        v = {c.category_name: c.score for c in blendshapes}
        fermeture = (v.get("eyeBlinkLeft", 0.0) + v.get("eyeBlinkRight", 0.0)) / 2
        plissement = (v.get("eyeSquintLeft", 0.0) + v.get("eyeSquintRight", 0.0)) / 2
        return fermeture, v.get("jawOpen", 0.0), plissement

    @staticmethod
    def _expressions(visages):
        """Les cinq coefficients d'expression les plus actifs, pour l'affichage."""
        if not visages.face_blendshapes:
            return []
        tries = sorted(visages.face_blendshapes[0], key=lambda c: -c.score)[:5]
        return [{"nom": c.category_name, "score": round(c.score, 3)} for c in tries]

    @staticmethod
    def _hostilite(blendshapes):
        """Combine les coefficients d'expression en un indice d'hostilité."""
        poids = {
            "browDownLeft": 0.9, "browDownRight": 0.9,
            "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
            "mouthFrownLeft": 0.7, "mouthFrownRight": 0.7,
            "mouthPressLeft": 0.4, "mouthPressRight": 0.4,
            "jawForward": 0.5, "noseSneerLeft": 0.8, "noseSneerRight": 0.8,
        }
        total = poids_total = 0.0
        for c in blendshapes:
            p = poids.get(c.category_name)
            if p:
                total += c.score * p
                poids_total += p
        return total / poids_total * 3.0 if poids_total else 0.0

    @staticmethod
    def _geste(points):
        """Reconnaît trois gestes à la géométrie des 21 points de la main.

        L'extension se mesure depuis l'articulation de base du doigt, en trois dimensions,
        et non depuis le poignet. La distance au poignet depend de l'orientation de la
        main : main de trois quarts, un majeur replie reste loin du poignet et un index
        plie passe pour tendu, ce qui faisait lire un index la ou il y avait un majeur.
        Rapportee a sa propre base, l'extension d'un doigt ne depend plus de l'angle.

        Rend (geste, ratios d'extension). Les ratios servent au reglage en direct.
        """
        def dist(a, b):
            return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2
                    + (getattr(a, "z", 0.0) - getattr(b, "z", 0.0)) ** 2) ** 0.5

        bouts = {"pouce": 4, "index": 8, "majeur": 12, "annulaire": 16, "auriculaire": 20}
        ratios = {}
        for nom, bout in bouts.items():
            base = points[bout - 3]
            milieu = points[bout - 2]
            reference = dist(milieu, base)
            ratios[nom] = dist(points[bout], base) / reference if reference else 0.0

        tendus = {nom: r >= (RATIO_POUCE if nom == "pouce" else RATIO_DOIGT)
                  for nom, r in ratios.items()}
        autres = [n for n in bouts if n != "pouce"]
        replies = sum(1 for n in autres if not tendus[n])

        geste = None
        if tendus["majeur"] and replies == 3:
            geste = ("doigt_honneur", 1.0)
        elif replies == 4 and not tendus["pouce"]:
            geste = ("poing_ferme", 1.0)
        elif tendus["pouce"] and replies == 4 and points[4].y > points[0].y:
            geste = ("pouce_baisse", 1.0)
        return geste, tendus, ratios


class Surveillance:
    """Tient l'état de la surveillance : cadence, thermique, anti-répétition."""

    def __init__(self, conn):
        self.conn = conn
        self.analyse = Analyse()
        self.active = True
        self.en_pause = False
        self.motif_pause = None
        self.derniers = {}
        self.dernier_passage = 0.0
        self.compteur = 0
        self.observation = {}
        self.fenetres = {}
        self.bases = {}
        self.dernier_bilan = {}
        self.fatigue = {}

    def doit_analyser(self, maintenant=None):
        from . import modules

        maintenant = maintenant or time.time()
        if not self.active or not modules.actif("surveillance") or not disponible():
            return False
        return maintenant - self.dernier_passage >= PERIODE_S

    def verifier_thermique(self):
        """Hysteresis : on coupe a 72 °C et on ne reprend qu'a 66, sinon la surveillance
        oscille autour du seuil et rechauffe aussitot ce qu'elle vient de refroidir."""
        t = temperature_soc()
        chaud = t >= (TEMP_REPRISE_C if self.en_pause else TEMP_MAX_C)
        if chaud and not self.en_pause:
            self.en_pause = True
            self.motif_pause = f"SoC a {t:.1f} °C, surveillance suspendue"
            from . import db
            db.journaliser(self.conn, "systeme", self.motif_pause, acteur="atria")
        elif not chaud and self.en_pause:
            self.en_pause = False
            self.motif_pause = None
        return not self.en_pause

    def traiter(self, img_rgb, auteur):
        """Analyse une image et enregistre les incidents attribués. Rend les détections."""
        from . import db

        self.dernier_passage = time.time()
        if not self.verifier_thermique():
            return []

        trouves, self.observation = self.analyse.analyser(img_rgb)
        self.suivre_fatigue(auteur)
        retenus = []
        for type_, force in trouves:
            cle = (auteur or "inconnu", type_)
            if self.dernier_passage - self.derniers.get(cle, 0) < REPOS_INCIDENT_S:
                continue
            self.derniers[cle] = self.dernier_passage
            gravite = GRAVITES.get(type_, 0.2) * min(1.0, force)
            detail = f"force {force:.2f}"
            db.enregistrer_incident(self.conn, auteur, "camera", type_, gravite, detail)
            db.journaliser(self.conn, "conduite",
                           f"{type_.replace('_', ' ')} detecte, gravite {gravite:.2f}",
                           acteur="atria", sujet=auteur,
                           donnees={"canal": "camera", "force": round(force, 3)})
            self.compteur += 1
            retenus.append({"type": type_, "force": round(force, 3),
                            "gravite": round(gravite, 3), "auteur": auteur})
        return retenus

    def _accumuler(self, auteur, paupieres, maintenant):
        """Empile les mesures de paupieres et rend un bilan quand la fenetre est pleine."""
        if not auteur or paupieres is None:
            return None
        fenetre = self.fenetres.setdefault(auteur, [])
        fenetre.append((maintenant, *paupieres))
        limite = maintenant - FENETRE_FATIGUE_S
        while fenetre and fenetre[0][0] < limite:
            fenetre.pop(0)

        longue = self.bases.setdefault(auteur, [])
        longue.append((maintenant, paupieres[0]))
        seuil = maintenant - FENETRE_BASE_S
        while longue and longue[0][0] < seuil:
            longue.pop(0)

        if maintenant - self.dernier_bilan.get(auteur, 0.0) < PERIODE_FATIGUE_S:
            return None
        if len(fenetre) < ECHANTILLONS_FATIGUE_MIN:
            return None
        self.dernier_bilan[auteur] = maintenant

        if len(longue) < ECHANTILLONS_BASE_MIN:
            return None
        reference = sorted(f for _, f in longue)
        base = reference[len(reference) // 5]
        amplitude = max(0.15, 1.0 - base)
        fermes = sum(1 for _, f, _, _ in fenetre
                     if (f - base) / amplitude >= FERMETURE_RELATIVE)
        perclos = fermes / len(fenetre)
        plissement = sum(p for _, _, _, p in fenetre) / len(fenetre)

        # Un baillement dure plusieurs secondes : on compte les episodes, pas les images,
        # sinon une seule bouche ouverte longtemps vaudrait dix baillements.
        baillements = 0
        ouvert = False
        for _, _, machoire, _ in fenetre:
            if machoire >= SEUIL_BAILLEMENT and not ouvert:
                baillements += 1
                ouvert = True
            elif machoire < SEUIL_BAILLEMENT:
                ouvert = False

        indice = min(1.0, 0.65 * perclos + 0.25 * min(1.0, baillements / 3.0)
                          + 0.10 * plissement)
        return {"perclos": round(perclos, 3), "baillements": baillements,
                "plissement": round(plissement, 3), "indice": round(indice, 3),
                "echantillons": len(fenetre), "base": round(base, 3)}

    def suivre_fatigue(self, auteur):
        """Ecrit un point de capacite quand la fenetre de somnolence est complete."""
        from . import db

        bilan = self._accumuler(auteur, self.observation.get("paupieres"),
                                self.dernier_passage)
        if bilan is None:
            return None
        cognitive = db.enregistrer_fatigue(
            self.conn, auteur, bilan["perclos"], bilan["baillements"],
            bilan["plissement"], bilan["indice"], bilan["echantillons"])
        bilan["cognitive"] = None if cognitive is None else round(cognitive, 3)
        self.fatigue[auteur] = bilan
        if bilan["indice"] >= 0.5 and cognitive is not None:
            db.journaliser(self.conn, "alerte",
                           f"somnolence observee, capacite ramenee a {cognitive:.2f}",
                           acteur="atria", sujet=auteur,
                           donnees={"perclos": bilan["perclos"],
                                    "baillements": bilan["baillements"],
                                    "indice": bilan["indice"]})
        return bilan

    def etat(self):
        from . import modules

        return {"active": self.active, "arme": modules.actif("surveillance"),
                "en_pause": self.en_pause,
                "motif_pause": self.motif_pause, "incidents": self.compteur,
                "modeles": disponible(), "erreur": self.analyse.erreur,
                "observation": self.observation,
                "fatigue": self.fatigue,
                "vu_il_y_a": round(time.time() - self.dernier_passage, 1)
                             if self.dernier_passage else None}
