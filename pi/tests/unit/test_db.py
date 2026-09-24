import sqlite3
import time

import pytest

from atria import db


def _crew(conn, nom):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES (?,?,?)",
                 (nom, "technicien", "maintenance"))
    conn.commit()


def _incident(conn, crew, ts, gravite, type_="cri"):
    conn.execute(
        "INSERT INTO incident (crew, ts, canal, type, gravite, detail) VALUES (?,?,?,?,?,?)",
        (crew, ts, "vision", type_, gravite, None))
    conn.commit()


def test_conduite_sans_incident_vaut_un(conn):
    _crew(conn, "moreau")
    assert db.conduite(conn, "moreau", maintenant=1_700_000_000.0) == 1.0


def test_conduite_baisse_de_la_gravite_au_moment_de_l_incident(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant, 0.4)
    assert db.conduite(conn, "moreau", maintenant=maintenant) == pytest.approx(0.6)


def test_conduite_s_amortit_a_la_demi_vie(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant - db.DEMI_VIE_INCIDENT_S, 0.4)
    assert db.conduite(conn, "moreau", maintenant=maintenant) == pytest.approx(0.8, abs=1e-6)


def test_conduite_ignore_les_incidents_hors_fenetre(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant - db.FENETRE_INCIDENT_S - 1.0, 0.9)
    assert db.conduite(conn, "moreau", maintenant=maintenant) == 1.0


def test_conduite_se_cumule_sur_plusieurs_incidents(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant, 0.3)
    _incident(conn, "moreau", maintenant, 0.2)
    assert db.conduite(conn, "moreau", maintenant=maintenant) == pytest.approx(0.5)


def test_conduite_se_clampe_a_zero_et_ne_devient_jamais_negative(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant, 1.0)
    _incident(conn, "moreau", maintenant, 1.0)
    _incident(conn, "moreau", maintenant, 1.0)
    assert db.conduite(conn, "moreau", maintenant=maintenant) == 0.0


def test_conduites_rend_un_score_par_membre_avec_incident(conn):
    _crew(conn, "moreau")
    _crew(conn, "blanc")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant, 0.3)
    scores = db.conduites(conn, maintenant=maintenant)
    assert scores == {"moreau": pytest.approx(0.7)}


def test_enregistrer_incident_puis_incidents_retrouve_le_detail(conn):
    _crew(conn, "moreau")
    db.enregistrer_incident(conn, "moreau", "vision", "doigt_honneur", 0.45, "geste au capitaine")
    lignes = db.incidents(conn, crew="moreau")
    assert len(lignes) == 1
    assert lignes[0]["type"] == "doigt_honneur"
    assert lignes[0]["gravite"] == 0.45
    assert lignes[0]["detail"] == "geste au capitaine"


def test_incidents_respecte_la_limite_et_l_ordre_du_plus_recent(conn):
    _crew(conn, "moreau")
    maintenant = time.time()
    for i in range(5):
        _incident(conn, "moreau", maintenant - i, 0.1)
    lignes = db.incidents(conn, crew="moreau", limite=3)
    assert len(lignes) == 3
    assert lignes[0]["ts"] > lignes[1]["ts"] > lignes[2]["ts"]


def test_incidents_avec_depuis_exclut_les_incidents_plus_vieux(conn):
    _crew(conn, "moreau")
    maintenant = 1_700_000_000.0
    _incident(conn, "moreau", maintenant - 10, 0.1)
    _incident(conn, "moreau", maintenant + 10, 0.1)
    lignes = db.incidents(conn, crew="moreau", depuis=maintenant)
    assert len(lignes) == 1
    assert lignes[0]["ts"] == maintenant + 10


def test_journaliser_avec_type_inconnu_leve_valueerror(conn):
    with pytest.raises(ValueError):
        db.journaliser(conn, "type_qui_n_existe_pas", "motif")


def test_journaliser_et_journal_donnees_json_round_trip(conn):
    db.journaliser(conn, "refus", "conduite sous le seuil", acteur="capitaine",
                   sujet="moreau", donnees={"poste": "chirurgie", "conduite": 0.55})
    lignes = db.journal(conn)
    assert len(lignes) == 1
    assert lignes[0]["type"] == "refus"
    assert lignes[0]["acteur"] == "capitaine"
    assert lignes[0]["sujet"] == "moreau"
    assert lignes[0]["motif"] == "conduite sous le seuil"


def test_journal_sans_donnees_laisse_donnees_a_none(conn):
    db.journaliser(conn, "systeme", "demarrage")
    lignes = db.journal(conn)
    assert lignes[0]["donnees"] is None


def test_journal_rend_le_plus_recent_en_premier(conn):
    for i in range(3):
        conn.execute(
            "INSERT INTO journal (ts, type, acteur, sujet, motif, donnees) VALUES (?,?,?,?,?,?)",
            (1_700_000_000.0 + i, "systeme", None, None, f"evenement {i}", None))
    conn.commit()
    lignes = db.journal(conn)
    assert [l["motif"] for l in lignes] == ["evenement 2", "evenement 1", "evenement 0"]


def test_journal_avec_depuis_ne_rend_que_les_entrees_recentes(conn):
    conn.execute(
        "INSERT INTO journal (ts, type, acteur, sujet, motif, donnees) VALUES (?,?,?,?,?,?)",
        (1_700_000_000.0, "systeme", None, None, "vieux", None))
    conn.execute(
        "INSERT INTO journal (ts, type, acteur, sujet, motif, donnees) VALUES (?,?,?,?,?,?)",
        (1_700_001_000.0, "systeme", None, None, "recent", None))
    conn.commit()
    lignes = db.journal(conn, depuis=1_700_000_500.0)
    assert [l["motif"] for l in lignes] == ["recent"]


def test_poser_ecran_tronque_a_seize_caracteres(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('atelier', 0)")
    conn.commit()
    db.poser_ecran(conn, "atelier", "un texte bien trop long pour l ecran", "bas")
    ecrans = db.ecrans(conn)
    assert len(ecrans["atelier"]["haut"]) == 16
    assert ecrans["atelier"]["bas"] == "bas"


def test_poser_ecran_met_a_jour_la_consigne_existante(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('atelier', 0)")
    conn.commit()
    db.poser_ecran(conn, "atelier", "PREMIER", "BAS1")
    db.poser_ecran(conn, "atelier", "SECOND", "BAS2")
    ecrans = db.ecrans(conn)
    assert len(ecrans) == 1
    assert ecrans["atelier"]["haut"] == "SECOND"


def test_confirmer_ecran_marque_l_application(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('atelier', 0)")
    conn.commit()
    db.poser_ecran(conn, "atelier", "X", "Y")
    assert db.ecrans(conn)["atelier"]["applique"] is None
    db.confirmer_ecran(conn, "atelier")
    assert db.ecrans(conn)["atelier"]["applique"] is not None


def test_session_vide_par_defaut(conn):
    s = db.session(conn)
    assert s == {"acteur": None, "role": "anonyme", "capitaine": False, "expire": True}


def test_ouvrir_session_capitaine(conn):
    db.ouvrir_session(conn, "de-vries", "capitaine")
    s = db.session(conn)
    assert s["acteur"] == "de-vries"
    assert s["capitaine"] is True
    assert s["expire"] is False


def test_fermer_session_revient_a_anonyme(conn):
    db.ouvrir_session(conn, "de-vries", "capitaine")
    db.fermer_session(conn)
    s = db.session(conn)
    assert s["acteur"] is None
    assert s["role"] == "anonyme"
    assert s["capitaine"] is False


def test_entrer_cloture_la_presence_precedente(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('pont', 0)")
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('serre', 1)")
    _crew(conn, "moreau")
    db.entrer(conn, "moreau", "pont")
    assert db.occupants(conn, "pont") == ["moreau"]
    db.entrer(conn, "moreau", "serre")
    assert db.occupants(conn, "pont") == []
    assert db.occupants(conn, "serre") == ["moreau"]


def test_resoudre_ignore_accents_et_casse(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('réacteur', 0)")
    conn.commit()
    assert db.resoudre(conn, "REACTEUR") == "réacteur"
    assert db.resoudre(conn, "réacteur") == "réacteur"


def test_resoudre_rend_none_si_compartiment_inconnu(conn):
    assert db.resoudre(conn, "soute") is None


def test_reference_capacite_sans_historique_vaut_la_reference_par_defaut(conn):
    assert db.reference_capacite(conn, "moreau") == db.REFERENCE_SANS_HISTORIQUE


def test_reference_capacite_est_la_mediane_des_releves_seed(conn):
    _crew(conn, "moreau")
    for i, valeur in enumerate((0.9, 0.5, 0.7)):
        conn.execute(
            "INSERT INTO capacite (crew, ts, cognitive, source) VALUES (?,?,?,?)",
            ("moreau", 1_700_000_000.0 + i, valeur, "seed"))
    conn.commit()
    assert db.reference_capacite(conn, "moreau") == 0.7


def test_reference_capacite_ignore_les_releves_camera(conn):
    _crew(conn, "moreau")
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES (?,?,?,?)",
        ("moreau", 1_700_000_000.0, 0.9, "seed"))
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES (?,?,?,?)",
        ("moreau", 1_700_000_001.0, 0.1, "camera"))
    conn.commit()
    assert db.reference_capacite(conn, "moreau") == 0.9


def test_enregistrer_fatigue_derive_la_capacite_de_la_reference(conn):
    _crew(conn, "moreau")
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES (?,?,?,?)",
        ("moreau", 1_700_000_000.0, 0.8, "seed"))
    conn.commit()
    cognitive = db.enregistrer_fatigue(conn, "moreau", perclos=0.5, baillements=2,
                                       plissement=0.1, indice=0.4, echantillons=30)
    attendu = 0.8 * (1.0 - db.PENALITE_FATIGUE * 0.4)
    assert cognitive == pytest.approx(attendu)
    releves = db.fatigues(conn, crew="moreau")
    assert len(releves) == 1
    assert releves[0]["indice"] == 0.4


def test_enregistrer_fatigue_clampe_a_zero_pour_un_indice_maximal(conn):
    _crew(conn, "moreau")
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES (?,?,?,?)",
        ("moreau", 1_700_000_000.0, 0.3, "seed"))
    conn.commit()
    cognitive = db.enregistrer_fatigue(conn, "moreau", perclos=0.9, baillements=9,
                                       plissement=0.5, indice=1.0, echantillons=30)
    assert cognitive == pytest.approx(max(0.0, 0.3 * (1.0 - db.PENALITE_FATIGUE)))
