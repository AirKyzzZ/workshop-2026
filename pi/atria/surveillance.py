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
TEMP_MAX_C = 72.0
TEMP_REPRISE_C = 66.0
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

SEUIL_HOSTILITE = 0.55
"""Combinaison sourcils baissés, yeux plissés et bouche crispée."""


def disponible():
    return os.path.exists(VISAGE) and os.path.exists(MAIN)


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
        """Rend la liste des détections d'une image : [(type, force), ...]."""
        self._charger()
        if self.erreur:
            return []

        paquet = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=img_rgb)
        trouves = []

        visages = self.visage.detect(paquet)
        if visages.face_blendshapes:
            force = self._hostilite(visages.face_blendshapes[0])
            if force >= SEUIL_HOSTILITE:
                trouves.append(("hostilite", force))

        mains = self.main.detect(paquet)
        for points in mains.hand_landmarks:
            geste = self._geste(points)
            if geste:
                trouves.append(geste)
        return trouves

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

        Un doigt est tendu quand son extrémité est plus loin du poignet que son
        articulation intermédiaire. Le repère MediaPipe est normalisé, donc la mesure
        tient quelle que soit la distance à l'objectif.
        """
        def dist(a, b):
            return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5

        poignet = points[0]
        bouts = {"pouce": 4, "index": 8, "majeur": 12, "annulaire": 16, "auriculaire": 20}
        tendus = {}
        for nom, bout in bouts.items():
            articulation = bout - 2
            tendus[nom] = dist(points[bout], poignet) > dist(points[articulation], poignet) * 1.12

        replies = sum(1 for n, t in tendus.items() if n != "pouce" and not t)

        if tendus["majeur"] and replies == 3:
            return ("doigt_honneur", 1.0)
        if replies == 4 and not tendus["pouce"]:
            return ("poing_ferme", 1.0)
        if tendus["pouce"] and replies == 4 and points[4].y > poignet.y:
            return ("pouce_baisse", 1.0)
        return None


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

    def doit_analyser(self, maintenant=None):
        maintenant = maintenant or time.time()
        if not self.active or not disponible():
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

        trouves = self.analyse.analyser(img_rgb)
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

    def etat(self):
        return {"active": self.active, "en_pause": self.en_pause,
                "motif_pause": self.motif_pause, "incidents": self.compteur,
                "modeles": disponible(), "erreur": self.analyse.erreur}
