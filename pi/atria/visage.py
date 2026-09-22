"""Reconnaissance faciale de bord, second facteur après le badge.

Le badge dit qui prétend se présenter, le visage vérifie que c'est bien lui. Les deux
modèles tournent sur la carte, en ONNX, et aucune image n'est conservée : seule
l'empreinte de 128 réels est écrite en base, et on ne remonte pas d'un gabarit à un
visage. C'est ce qui rend la biométrie compatible avec la promesse du cahier des charges.
"""

import os

import cv2
import numpy as np

MODELES = os.path.expanduser("~/atria/models/visage")
DETECTEUR = os.path.join(MODELES, "yunet.onnx")
ENCODEUR = os.path.join(MODELES, "sface.onnx")

CAMERA = 0
LARGEUR = 640
HAUTEUR = 480

SEUIL_COSINUS = 0.363
"""Seuil recommandé par OpenCV pour SFace. Au-dessus, même personne."""

SEUIL_DETECTION = 0.8
GABARITS_PAR_MEMBRE = 5

_detecteur = None
_encodeur = None


def _modeles():
    global _detecteur, _encodeur
    if _detecteur is None:
        _detecteur = cv2.FaceDetectorYN.create(
            DETECTEUR, "", (LARGEUR, HAUTEUR),
            score_threshold=SEUIL_DETECTION, nms_threshold=0.3, top_k=5000)
        _encodeur = cv2.FaceRecognizerSF.create(ENCODEUR, "")
    return _detecteur, _encodeur


def disponible():
    return os.path.exists(DETECTEUR) and os.path.exists(ENCODEUR)


class Camera:
    def __enter__(self):
        self.flux = cv2.VideoCapture(CAMERA, cv2.CAP_V4L2)
        self.flux.set(cv2.CAP_PROP_FRAME_WIDTH, LARGEUR)
        self.flux.set(cv2.CAP_PROP_FRAME_HEIGHT, HAUTEUR)
        self.flux.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return self

    def __exit__(self, *_):
        self.flux.release()

    def image(self):
        # Le C270 renvoie des images périmées tant que le tampon n'est pas vidé.
        for _ in range(4):
            self.flux.grab()
        ok, img = self.flux.read()
        return img if ok else None


def plus_grand_visage(img):
    detecteur, _ = _modeles()
    h, l = img.shape[:2]
    detecteur.setInputSize((l, h))
    _, visages = detecteur.detect(img)
    if visages is None or not len(visages):
        return None
    return max(visages, key=lambda v: v[2] * v[3])


def empreinte(img, visage):
    _, encodeur = _modeles()
    aligne = encodeur.alignCrop(img, visage)
    vecteur = encodeur.feature(aligne)
    return np.asarray(vecteur, dtype=np.float32).flatten()


def similarite(a, b):
    a = np.asarray(a, dtype=np.float32).flatten()
    b = np.asarray(b, dtype=np.float32).flatten()
    norme = float(np.linalg.norm(a) * np.linalg.norm(b))
    return 0.0 if norme == 0 else float(np.dot(a, b) / norme)


def capturer_empreinte(camera):
    """Rend (empreinte, surface du visage), ou (None, 0) si personne n'est cadré."""
    img = camera.image()
    if img is None:
        return None, 0
    visage = plus_grand_visage(img)
    if visage is None:
        return None, 0
    return empreinte(img, visage), int(visage[2] * visage[3])


def comparer(candidat, gabarits):
    """Meilleure similarité entre un candidat et les gabarits enrôlés d'un membre."""
    if candidat is None or not gabarits:
        return 0.0
    return max(similarite(candidat, g) for g in gabarits)
