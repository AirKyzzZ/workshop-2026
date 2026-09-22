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

from . import db, visage

PERIODE_S = 0.08
FRAMES_POUR_ACCORD = 3
DELAI_VERIFICATION_S = 12.0
QUALITE_JPEG = 70

VERT = (88, 214, 75)
ROUGE = (95, 112, 244)
AMBRE = (60, 163, 232)
GRIS = (150, 145, 145)


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
        self.erreur = None
        self.verification = None

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
                "motif": "présentez votre visage",
            }

    def desarmer(self):
        with self.verrou:
            self.verification = None

    def etat_verification(self):
        with self.verrou:
            v = self.verification
            if v is None:
                return None
            return {"nom": v["nom"], "etat": v["etat"], "score": round(v["score"], 3),
                    "seuil": visage.SEUIL_COSINUS, "motif": v["motif"],
                    "reste": max(0.0, round(v["expire"] - time.time(), 1))}

    def attendre_verdict(self, delai=DELAI_VERIFICATION_S + 1):
        fin = time.time() + delai
        while time.time() < fin:
            with self.verrou:
                v = self.verification
                if v is None:
                    return None
                if v["etat"] != "en_cours":
                    return {"etat": v["etat"], "score": v["score"], "motif": v["motif"]}
            time.sleep(0.1)
        return {"etat": "refuse", "score": 0.0, "motif": "délai dépassé"}

    # ---------- boucle ----------

    def _boucle(self):
        capture = cv2.VideoCapture(visage.CAMERA, cv2.CAP_V4L2)
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, visage.LARGEUR)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, visage.HAUTEUR)
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not capture.isOpened():
            self.erreur = "caméra indisponible"
            self.actif = False
            return
        self.erreur = None

        while self.actif:
            ok, img = capture.read()
            if not ok:
                time.sleep(0.2)
                continue
            try:
                self._traiter(img)
            except Exception as exc:
                self.erreur = str(exc)[:80]
            time.sleep(PERIODE_S)

        capture.release()

    def _traiter(self, img):
        boite = visage.plus_grand_visage(img)
        empreinte = visage.empreinte(img, boite) if boite is not None else None
        couleur, legende = GRIS, "aucun visage"

        with self.verrou:
            v = self.verification

        if v is not None and v["etat"] == "en_cours":
            couleur, legende = self._juger(v, empreinte, boite)
        elif boite is not None:
            couleur, legende = AMBRE, "visage détecté"

        if boite is not None:
            self._annoter(img, boite, couleur, legende)
        else:
            self._bandeau(img, legende, couleur)

        ok, tampon = cv2.imencode(".jpg", img,
                                  [int(cv2.IMWRITE_JPEG_QUALITY), QUALITE_JPEG])
        with self.verrou:
            if ok:
                self.jpeg = tampon.tobytes()
                self.ts = time.time()
            self.visage_present = boite is not None
            self.surface = int(boite[2] * boite[3]) if boite is not None else 0
            self.empreinte = empreinte

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
                "age": round(time.time() - self.ts, 2) if self.ts else None,
            }

    def empreinte_courante(self):
        with self.verrou:
            return None if self.empreinte is None else self.empreinte.copy()


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
    flux.desarmer()
    if verdict is None:
        return True, None, "contrôle interrompu"
    return verdict["etat"] == "accorde", verdict["score"], verdict["motif"]
