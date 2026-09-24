import pytest

from atria import modules


class Horloge:
    def __init__(self, t):
        self.t = t

    def time(self):
        return self.t


@pytest.fixture(autouse=True)
def etats_propres(monkeypatch):
    frais = {nom: {"actif": nom in modules.PERMANENTS, "expire": None}
             for nom in modules.DEFINITIONS}
    monkeypatch.setattr(modules, "_etats", frais)
    yield


def test_module_permanent_est_actif_par_defaut_sans_echeance():
    assert modules.actif("surveillance") is True
    e = modules.etat("surveillance")
    assert e["reste_s"] is None


def test_module_a_la_demande_est_inactif_par_defaut():
    assert modules.actif("ecoute") is False
    assert modules.actif("transcription") is False


def test_armer_active_le_module_pour_la_duree_donnee(monkeypatch):
    horloge = Horloge(1000.0)
    monkeypatch.setattr(modules, "time", horloge)

    modules.armer("ecoute", minutes=5)
    assert modules.actif("ecoute") is True

    horloge.t = 1000.0 + 5 * 60 - 1
    assert modules.actif("ecoute") is True

    horloge.t = 1000.0 + 5 * 60 + 1
    assert modules.actif("ecoute") is False


def test_module_expire_se_desarme_lui_meme(monkeypatch):
    horloge = Horloge(1000.0)
    monkeypatch.setattr(modules, "time", horloge)

    modules.armer("ecoute", minutes=5)
    horloge.t = 1000.0 + 5 * 60 + 1
    assert modules.actif("ecoute") is False
    assert modules._etats["ecoute"]["actif"] is False
    assert modules._etats["ecoute"]["expire"] is None


def test_armer_sans_echeance_reste_actif_indefiniment(monkeypatch):
    horloge = Horloge(1000.0)
    monkeypatch.setattr(modules, "time", horloge)

    modules.armer("ecoute", minutes=None)
    horloge.t += 10_000_000
    assert modules.actif("ecoute") is True


def test_desarmer_un_module_actif():
    modules.armer("ecoute", minutes=5)
    modules.desarmer("ecoute")
    assert modules.actif("ecoute") is False


def test_armer_nom_inconnu_ne_cree_rien():
    assert modules.armer("inexistant") is None
    assert modules.desarmer("inexistant") is None
    assert modules.actif("inexistant") is False


def test_etat_rend_le_temps_restant_arrondi(monkeypatch):
    horloge = Horloge(1000.0)
    monkeypatch.setattr(modules, "time", horloge)

    modules.armer("ecoute", minutes=2)
    e = modules.etat("ecoute")
    assert e["reste_s"] == 120


def test_tous_rend_un_etat_pour_chaque_module_defini():
    noms = {m["nom"] for m in modules.tous()}
    assert noms == set(modules.DEFINITIONS)
