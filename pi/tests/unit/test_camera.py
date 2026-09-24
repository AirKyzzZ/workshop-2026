import numpy as np
import pytest

from atria import camera


class Horloge:
    def __init__(self, t):
        self.t = t

    def time(self):
        return self.t

    def sleep(self, _s):
        pass


class FausseSurveillance:
    def __init__(self):
        self.observation = {}
        self.appels = []

    def traiter(self, rgb, auteur):
        self.appels.append(auteur)
        return []


def test_regarder_ne_descend_jamais_sous_zero():
    f = camera.Flux()
    f.regarder(-5)
    assert f.spectateurs == 0
    f.regarder(3)
    assert f.spectateurs == 3
    f.regarder(-10)
    assert f.spectateurs == 0


def test_armer_initialise_l_etat_de_verification():
    f = camera.Flux()
    f.armer("moreau", ["g1"])
    assert f.verification["nom"] == "moreau"
    assert f.verification["etat"] == "en_cours"
    assert f.verification["accords"] == 0


def test_desarmer_efface_la_verification():
    f = camera.Flux()
    f.armer("moreau", ["g1"])
    f.desarmer()
    assert f.verification is None


def test_etat_verification_survit_pendant_le_maintien_puis_expire(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)

    f.armer("moreau", ["g1"])
    f.verification["etat"] = "accorde"
    f.maintenir_verdict()

    horloge.t = 1000.0 + camera.MAINTIEN_VERDICT_S - 1
    v = f.etat_verification()
    assert v is not None
    assert v["nom"] == "moreau"

    horloge.t = 1000.0 + camera.MAINTIEN_VERDICT_S + 1
    assert f.etat_verification() is None
    assert f.verification is None


def test_juger_accorde_apres_le_nombre_de_frames_requis(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.armer("moreau", ["g1"])
    monkeypatch.setattr(camera.visage, "comparer", lambda emp, gab: 0.9)

    for _ in range(camera.FRAMES_POUR_ACCORD):
        couleur, legende = f._juger(f.verification, empreinte=object(), boite=[0, 0, 1, 1])

    assert f.verification["etat"] == "accorde"
    assert couleur == camera.VERT


def test_juger_reinitialise_les_accords_sur_un_score_insuffisant(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.armer("moreau", ["g1"])

    scores = iter([0.9, 0.1])
    monkeypatch.setattr(camera.visage, "comparer", lambda emp, gab: next(scores))

    f._juger(f.verification, empreinte=object(), boite=[0, 0, 1, 1])
    assert f.verification["accords"] == 1

    couleur, _ = f._juger(f.verification, empreinte=object(), boite=[0, 0, 1, 1])
    assert f.verification["accords"] == 0
    assert couleur == camera.ROUGE


def test_juger_refuse_au_dela_du_delai(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.armer("moreau", ["g1"])

    horloge.t = f.verification["expire"] + 1
    couleur, legende = f._juger(f.verification, empreinte=object(), boite=[0, 0, 1, 1])
    assert f.verification["etat"] == "refuse"
    assert couleur == camera.ROUGE


def test_juger_attend_un_visage_si_aucune_empreinte(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.armer("moreau", ["g1"])

    couleur, legende = f._juger(f.verification, empreinte=None, boite=None)
    assert couleur == camera.AMBRE
    assert "présentez votre visage" in legende


def test_surveiller_retient_l_auteur_reconnu(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.surveillance = FausseSurveillance()
    monkeypatch.setattr(f, "_identifier", lambda img, boite: "moreau")

    image = np.zeros((4, 4, 3), dtype=np.uint8)
    f._surveiller(image, [0, 0, 1, 1])

    assert f.auteur_vu == "moreau"
    assert f.auteur_vu_le == 1000.0
    assert f.surveillance.appels == ["moreau"]


def test_surveiller_garde_l_auteur_tant_que_la_reidentification_n_est_pas_due(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.surveillance = FausseSurveillance()
    monkeypatch.setattr(f, "_identifier", lambda img, boite: "moreau")

    image = np.zeros((4, 4, 3), dtype=np.uint8)
    f._surveiller(image, [0, 0, 1, 1])

    horloge.t = 1005.0
    f._surveiller(image, [0, 0, 1, 1])
    assert f.auteur_vu == "moreau"
    assert f.auteur_vu_le == 1000.0


def test_surveiller_efface_l_auteur_apres_le_ttl_sans_visage(monkeypatch):
    f = camera.Flux()
    horloge = Horloge(1000.0)
    monkeypatch.setattr(camera, "time", horloge)
    f.surveillance = FausseSurveillance()
    monkeypatch.setattr(f, "_identifier", lambda img, boite: "moreau")

    image = np.zeros((4, 4, 3), dtype=np.uint8)
    f._surveiller(image, [0, 0, 1, 1])

    horloge.t = 1000.0 + camera.TTL_AUTEUR_S - 1
    f._surveiller(image, None)
    assert f.auteur_vu == "moreau"

    horloge.t = 1000.0 + camera.TTL_AUTEUR_S + 1
    f._surveiller(image, None)
    assert f.auteur_vu is None


def test_surveiller_capture_les_exceptions_sans_les_propager():
    f = camera.Flux()

    class Explose:
        observation = {}

        def traiter(self, rgb, auteur):
            raise RuntimeError("mediapipe explose")

    f.surveillance = Explose()
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    f._surveiller(image, None)
    assert f.erreur is not None
