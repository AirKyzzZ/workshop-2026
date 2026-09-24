import time

import pytest

from atria import confinement, db


def _vider(conn, compartiment):
    conn.execute("UPDATE presence SET sortie = ? WHERE compartiment = ? AND sortie IS NULL",
                (time.time(), compartiment))
    conn.commit()


def test_niveau_feu_fumee_seule_declenche_feu():
    comp = type("C", (), {"temp_c": None, "fumee": True})()
    assert confinement.niveau_feu(comp) == "feu"


def test_niveau_feu_temperature_haute_declenche_feu_sans_fumee():
    comp = type("C", (), {"temp_c": 50.0, "fumee": False})()
    assert confinement.niveau_feu(comp) == "feu"


def test_niveau_feu_temperature_tiede_est_une_suspicion():
    comp = type("C", (), {"temp_c": 40.0, "fumee": False})()
    assert confinement.niveau_feu(comp) == "suspicion"


def test_niveau_feu_rien_d_anormal():
    comp = type("C", (), {"temp_c": 20.0, "fumee": False})()
    assert confinement.niveau_feu(comp) is None


def test_combustion_dans_compartiment_occupe_ordonne_l_evacuation_sans_sceller(etat):
    occupants = list(etat.compartiment("atelier").occupants)
    assert occupants

    etat.declencher_fumee("atelier", True)
    actions = confinement.appliquer_feu(etat)

    assert actions == [{"compartiment": "atelier", "action": "evacuation",
                        "occupants": occupants}]
    dossiers = confinement.actifs(etat.conn, genre="compartiment", cible="atelier")
    assert dossiers[0]["etat"] == "attente_evacuation"
    ecran = db.ecrans(etat.conn)["atelier"]
    assert "EVACUEZ" in ecran["haut"]


def test_combustion_ne_re_ouvre_pas_une_evacuation_deja_en_cours(etat):
    etat.declencher_fumee("atelier", True)
    confinement.appliquer_feu(etat)
    actions = confinement.appliquer_feu(etat)
    assert actions == []


def test_compartiment_vide_se_scelle(etat):
    _vider(etat.conn, "atelier")
    etat.recharger()
    etat.declencher_fumee("atelier", True)

    actions = confinement.appliquer_feu(etat)

    assert actions == [{"compartiment": "atelier", "action": "scelle"}]
    dossiers = confinement.actifs(etat.conn, genre="compartiment", cible="atelier")
    assert dossiers[0]["etat"] == "scelle"
    ecran = db.ecrans(etat.conn)["atelier"]
    assert ecran["haut"] == "COMPARTIMENT"
    assert ecran["bas"] == "SCELLE"


def test_evacuation_puis_vidage_bascule_vers_scelle(etat):
    etat.declencher_fumee("atelier", True)
    confinement.appliquer_feu(etat)

    _vider(etat.conn, "atelier")
    etat.recharger()
    actions = confinement.appliquer_feu(etat)

    assert actions == [{"compartiment": "atelier", "action": "scelle"}]
    dossiers = confinement.actifs(etat.conn, genre="compartiment", cible="atelier")
    assert len(dossiers) == 1
    assert dossiers[0]["etat"] == "scelle"


def test_lever_la_combustion_reouvre_le_compartiment(etat):
    _vider(etat.conn, "atelier")
    etat.recharger()
    etat.declencher_fumee("atelier", True)
    confinement.appliquer_feu(etat)

    etat.declencher_fumee("atelier", False)
    actions = confinement.appliquer_feu(etat)

    assert actions == [{"compartiment": "atelier", "action": "leve"}]
    assert confinement.actifs(etat.conn, genre="compartiment", cible="atelier") == []
    ecran = db.ecrans(etat.conn)["atelier"]
    assert ecran["haut"] == ""
    assert ecran["bas"] == ""


def test_evaluer_feu_niveau_suspicion_ne_declenche_rien(etat):
    etat.conn.execute(
        "INSERT INTO ambiance (compartiment, ts, co2, bruit_db, fumee, temp_c)"
        " VALUES ('serre', ?, 500, 40, 0, 40.0)", (time.time(),))
    etat.conn.commit()
    etat.recharger()

    sorties = confinement.evaluer_feu(etat)
    cas = next(s for s in sorties if s["compartiment"] == "serre")
    assert cas["decision"] == "surveiller"

    actions = confinement.appliquer_feu(etat)
    assert actions == []
    assert confinement.actifs(etat.conn, genre="compartiment", cible="serre") == []


def test_proposer_isolement_ecrit_une_proposition_et_journalise(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": ["conduite effondree"],
           "cible": None, "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)

    assert identifiant is not None
    dossiers = confinement.actifs(etat.conn, genre="personne", cible="moreau")
    assert dossiers[0]["etat"] == "propose"
    assert dossiers[0]["risque"] == 0.8
    lignes = db.journal(etat.conn)
    assert lignes[0]["type"] == "confinement"
    assert lignes[0]["sujet"] == "moreau"


def test_proposer_isolement_ne_double_pas_une_proposition_active(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    premier = confinement.proposer_isolement(etat.conn, cas)
    second = confinement.proposer_isolement(etat.conn, cas)
    assert premier is not None
    assert second is None


def test_decider_confiner_journalise_avec_l_approbation_du_capitaine(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)

    resultat = confinement.decider(etat.conn, identifiant, "confiner", "capitaine")

    assert resultat["etat"] == "confine"
    lignes = db.journal(etat.conn)
    assert lignes[0]["type"] == "confinement"
    assert lignes[0]["acteur"] == "capitaine"


def test_decider_confiner_refuse_si_deja_tranche(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)
    confinement.decider(etat.conn, identifiant, "rejeter", "capitaine")

    resultat = confinement.decider(etat.conn, identifiant, "confiner", "capitaine")
    assert "erreur" in resultat


def test_decider_sceller_malgre_occupants_est_une_derogation(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)

    resultat = confinement.decider(etat.conn, identifiant, "sceller", "capitaine")

    assert resultat["etat"] == "scelle"
    lignes = db.journal(etat.conn)
    assert lignes[0]["type"] == "crise"


def test_decider_decision_inconnue(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)
    resultat = confinement.decider(etat.conn, identifiant, "danser", "capitaine")
    assert "erreur" in resultat


def test_tranche_recente_empeche_une_nouvelle_proposition(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)
    confinement.decider(etat.conn, identifiant, "rejeter", "capitaine")

    assert confinement.tranche_recente(etat.conn, "moreau") is not None
    assert confinement.proposer_isolement(etat.conn, cas) is None


def test_tranche_recente_expire_apres_le_delai_de_repropositon(etat):
    cas = {"crew": "moreau", "risque": 0.8, "motifs": [], "cible": None,
           "compartiment": "infirmerie"}
    identifiant = confinement.proposer_isolement(etat.conn, cas)
    confinement.decider(etat.conn, identifiant, "rejeter", "capitaine")

    plus_tard = time.time() + confinement.DELAI_REPROPOSITION_S + 1
    assert confinement.tranche_recente(etat.conn, "moreau", maintenant=plus_tard) is None
