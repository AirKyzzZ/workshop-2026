import numpy as np
import pytest

from atria import visage


def test_disponible_rend_faux_sans_modeles_installes():
    assert visage.disponible() is False


def test_similarite_est_maximale_pour_deux_vecteurs_identiques():
    v = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    assert visage.similarite(v, v) == pytest.approx(1.0)


def test_similarite_est_nulle_pour_un_vecteur_nul():
    a = np.zeros(3, dtype=np.float32)
    b = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert visage.similarite(a, b) == 0.0


def test_comparer_rend_zero_sans_candidat():
    gabarits = [np.array([1.0, 0.0], dtype=np.float32)]
    assert visage.comparer(None, gabarits) == 0.0


def test_comparer_rend_zero_sans_gabarit():
    candidat = np.array([1.0, 0.0], dtype=np.float32)
    assert visage.comparer(candidat, []) == 0.0


def test_comparer_rend_la_meilleure_similarite_parmi_les_gabarits():
    candidat = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    gabarits = [np.array([0.0, 1.0, 0.0], dtype=np.float32),
                np.array([1.0, 0.0, 0.0], dtype=np.float32)]
    assert visage.comparer(candidat, gabarits) == pytest.approx(1.0)


def test_capturer_empreinte_rend_none_sans_image():
    class FausseCamera:
        def image(self):
            return None

    assert visage.capturer_empreinte(FausseCamera()) == (None, 0)


def test_capturer_empreinte_rend_none_sans_visage_detecte(monkeypatch):
    class FausseCamera:
        def image(self):
            return object()

    monkeypatch.setattr(visage, "plus_grand_visage", lambda img: None)
    assert visage.capturer_empreinte(FausseCamera()) == (None, 0)


def test_resoudre_camera_priorise_la_signature_usb(monkeypatch):
    def _glob(motif):
        if motif.startswith(visage.BY_ID):
            return ["/dev/v4l/by-id/usb-Logitech_C270_046d_0825-video-index0"]
        return ["/dev/video3", "/dev/video0"]
    monkeypatch.setattr(visage.glob, "glob", _glob)
    monkeypatch.setattr(visage.os.path, "realpath", lambda p: "/dev/video2")
    assert visage.resoudre_camera() == "/dev/video2"


def test_resoudre_camera_ignore_un_chemin_by_id_qui_n_est_pas_index0(monkeypatch):
    def _glob(motif):
        if motif.startswith(visage.BY_ID):
            return ["/dev/v4l/by-id/usb-Logitech_C270_046d_0825-video-index1"]
        return ["/dev/video1"]
    monkeypatch.setattr(visage.glob, "glob", _glob)
    assert visage.resoudre_camera() == "/dev/video1"


def test_resoudre_camera_repli_sur_le_premier_video_sans_signature(monkeypatch):
    def _glob(motif):
        if motif.startswith(visage.BY_ID):
            return []
        return ["/dev/video3", "/dev/video1"]
    monkeypatch.setattr(visage.glob, "glob", _glob)
    assert visage.resoudre_camera() == "/dev/video1"


def test_resoudre_camera_rend_le_defaut_si_rien_n_est_trouve(monkeypatch):
    monkeypatch.setattr(visage.glob, "glob", lambda motif: [])
    assert visage.resoudre_camera() == "/dev/video0"
    assert visage.resoudre_camera(defaut="/dev/videoX") == "/dev/videoX"
