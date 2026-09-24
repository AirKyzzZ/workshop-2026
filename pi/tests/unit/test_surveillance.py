import types

import pytest

from atria import modules, surveillance


class Horloge:
    def __init__(self, t):
        self.t = t

    def time(self):
        return self.t


def _point(x=0.0, y=0.0, z=0.0):
    return types.SimpleNamespace(x=x, y=y, z=z)


BOUTS = {"pouce": 4, "index": 8, "majeur": 12, "annulaire": 16, "auriculaire": 20}


def _main(ratios=None, poignet_y=1.0):
    ratios = ratios or {}
    points = [_point(0.0, poignet_y, 0.0) for _ in range(21)]
    for i, (nom, bout) in enumerate(BOUTS.items()):
        x = i * 10.0
        points[bout - 3] = _point(x, 0.0, 0.0)
        points[bout - 2] = _point(x, 0.05, 0.0)
        r = ratios.get(nom, 0.4)
        points[bout] = _point(x, 0.05 * r, 0.0)
    return points


def test_main_ouverte_ne_declenche_aucun_geste():
    points = _main({n: 3.0 for n in BOUTS})
    geste, tendus, _ = surveillance.Analyse._geste(points)
    assert geste is None
    assert all(tendus.values())


def test_majeur_seul_tendu_est_un_doigt_d_honneur():
    points = _main({"majeur": 3.0})
    geste, tendus, _ = surveillance.Analyse._geste(points)
    assert geste == ("doigt_honneur", 1.0)
    assert tendus["majeur"] is True
    assert tendus["index"] is False
    assert tendus["annulaire"] is False
    assert tendus["auriculaire"] is False


def test_doigt_honneur_ne_depend_pas_de_l_etat_du_pouce():
    points = _main({"majeur": 3.0, "pouce": 3.0})
    geste, _, _ = surveillance.Analyse._geste(points)
    assert geste == ("doigt_honneur", 1.0)


def test_quatre_doigts_replies_pouce_replie_est_un_poing_ferme():
    points = _main()
    geste, tendus, _ = surveillance.Analyse._geste(points)
    assert geste == ("poing_ferme", 1.0)
    assert tendus["pouce"] is False


def test_pouce_tendu_pointant_vers_le_bas_est_pouce_baisse():
    points = _main({"pouce": 3.0}, poignet_y=0.0)
    geste, tendus, _ = surveillance.Analyse._geste(points)
    assert geste == ("pouce_baisse", 1.0)
    assert tendus["pouce"] is True


def test_pouce_tendu_sans_pointer_vers_le_bas_n_est_pas_un_geste():
    points = _main({"pouce": 3.0}, poignet_y=1.0)
    geste, tendus, _ = surveillance.Analyse._geste(points)
    assert geste is None
    assert tendus["pouce"] is True


def test_ratio_egal_au_seuil_doigt_compte_comme_tendu():
    points = _main({"majeur": surveillance.RATIO_DOIGT})
    _, tendus, ratios = surveillance.Analyse._geste(points)
    assert tendus["majeur"] is True
    assert ratios["majeur"] == pytest.approx(surveillance.RATIO_DOIGT)


def test_ratio_juste_sous_le_seuil_doigt_compte_comme_replie():
    points = _main({"majeur": surveillance.RATIO_DOIGT - 0.001})
    _, tendus, _ = surveillance.Analyse._geste(points)
    assert tendus["majeur"] is False


def test_ratio_egal_au_seuil_pouce_compte_comme_tendu():
    points = _main({"pouce": surveillance.RATIO_POUCE}, poignet_y=0.0)
    _, tendus, _ = surveillance.Analyse._geste(points)
    assert tendus["pouce"] is True


def test_ratio_juste_sous_le_seuil_pouce_compte_comme_replie():
    points = _main({"pouce": surveillance.RATIO_POUCE - 0.001}, poignet_y=0.0)
    _, tendus, _ = surveillance.Analyse._geste(points)
    assert tendus["pouce"] is False


def test_boite_encadre_les_points_de_la_main():
    points = [_point(0.1, 0.2), _point(0.5, 0.05), _point(0.3, 0.6)]
    assert surveillance._boite(points) == [0.1, 0.05, 0.4, 0.55]


def test_doit_analyser_refuse_si_les_modeles_sont_absents(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "disponible", lambda: False)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    assert surv.doit_analyser(maintenant=1000.0) is False


def test_doit_analyser_refuse_si_le_module_est_desarme(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "disponible", lambda: True)
    monkeypatch.setattr(modules, "actif", lambda nom: False)
    assert surv.doit_analyser(maintenant=1000.0) is False


def test_doit_analyser_respecte_la_periode_minimale(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "disponible", lambda: True)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    surv.dernier_passage = 1000.0
    assert surv.doit_analyser(maintenant=1000.0 + surveillance.PERIODE_S - 0.1) is False
    assert surv.doit_analyser(maintenant=1000.0 + surveillance.PERIODE_S) is True


def test_surveillance_se_met_en_pause_a_la_temperature_max(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: surveillance.TEMP_MAX_C)
    assert surv.verifier_thermique() is False
    assert surv.en_pause is True
    assert surv.motif_pause is not None
    ligne = conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["type"] == "systeme"


def test_pas_de_pause_juste_sous_le_seuil_max_quand_actif(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "temperature_soc",
                        lambda: surveillance.TEMP_MAX_C - 0.1)
    assert surv.verifier_thermique() is True
    assert surv.en_pause is False


def test_surveillance_reste_en_pause_tant_que_le_seuil_de_reprise_n_est_pas_franchi(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: surveillance.TEMP_MAX_C)
    surv.verifier_thermique()
    monkeypatch.setattr(surveillance, "temperature_soc",
                        lambda: surveillance.TEMP_REPRISE_C)
    assert surv.verifier_thermique() is False
    assert surv.en_pause is True


def test_surveillance_reprend_sous_le_seuil_de_reprise(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: surveillance.TEMP_MAX_C)
    surv.verifier_thermique()
    monkeypatch.setattr(surveillance, "temperature_soc",
                        lambda: surveillance.TEMP_REPRISE_C - 0.1)
    assert surv.verifier_thermique() is True
    assert surv.en_pause is False
    assert surv.motif_pause is None


def test_traiter_ignore_tout_pendant_la_pause_thermique(conn, monkeypatch):
    surv = surveillance.Surveillance(conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: surveillance.TEMP_MAX_C)

    def _echoue(img):
        raise AssertionError("analyser ne doit pas etre appele pendant la pause")
    monkeypatch.setattr(surv.analyse, "analyser", _echoue)

    assert surv.traiter(None, "moreau") == []


def test_repos_incident_empeche_de_compter_deux_fois_le_meme_geste(etat, monkeypatch):
    surv = surveillance.Surveillance(etat.conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: 20.0)
    monkeypatch.setattr(surv.analyse, "analyser",
                        lambda img: ([("doigt_honneur", 1.0)], {}))
    horloge = Horloge(1000.0)
    monkeypatch.setattr(surveillance, "time", horloge)

    premiere = surv.traiter(None, "moreau")
    assert len(premiere) == 1
    assert premiere[0]["type"] == "doigt_honneur"
    assert premiere[0]["gravite"] == pytest.approx(surveillance.GRAVITES["doigt_honneur"])

    horloge.t = 1000.0 + surveillance.REPOS_INCIDENT_S - 0.1
    assert surv.traiter(None, "moreau") == []

    horloge.t = 1000.0 + surveillance.REPOS_INCIDENT_S + 0.1
    troisieme = surv.traiter(None, "moreau")
    assert len(troisieme) == 1


def test_repos_incident_est_par_auteur_et_pas_global(etat, monkeypatch):
    surv = surveillance.Surveillance(etat.conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: 20.0)
    monkeypatch.setattr(surv.analyse, "analyser",
                        lambda img: ([("poing_ferme", 1.0)], {}))
    horloge = Horloge(1000.0)
    monkeypatch.setattr(surveillance, "time", horloge)

    assert len(surv.traiter(None, "moreau")) == 1
    assert len(surv.traiter(None, "bianchi")) == 1


def test_incident_attribue_enregistre_le_crew(etat, monkeypatch):
    surv = surveillance.Surveillance(etat.conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: 20.0)
    monkeypatch.setattr(surv.analyse, "analyser",
                        lambda img: ([("poing_ferme", 1.0)], {}))
    surv.traiter(None, "moreau")
    ligne = etat.conn.execute(
        "SELECT crew FROM incident ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["crew"] == "moreau"


def test_incident_sans_auteur_reconnu_est_journalise_anonyme(etat, monkeypatch):
    surv = surveillance.Surveillance(etat.conn)
    monkeypatch.setattr(surveillance, "temperature_soc", lambda: 20.0)
    monkeypatch.setattr(surv.analyse, "analyser",
                        lambda img: ([("poing_ferme", 1.0)], {}))
    surv.traiter(None, None)
    ligne = etat.conn.execute(
        "SELECT crew FROM incident ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["crew"] is None


def test_etat_signale_les_modeles_manquants_en_environnement_de_test(conn):
    surv = surveillance.Surveillance(conn)
    e = surv.etat()
    assert e["modeles"] is False
