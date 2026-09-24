import json
import time

import pytest

from atria import db, regulator, social


def test_affecter_accepte_un_poste_vital_sans_incident(etat):
    reponse = regulator.affecter(etat, "moreau", "chirurgie")
    assert reponse.accepte is True
    assert reponse.titre == "AFFECTATION VALIDEE"
    assert etat.poste("chirurgie").titulaire == "moreau"


def test_affecter_refuse_apres_un_geste_qui_fait_chuter_la_conduite(etat):
    db.enregistrer_incident(etat.conn, "moreau", "vision", "doigt_honneur", 0.45, "geste")
    conduite = db.conduite(etat.conn, "moreau")
    assert conduite < db.SEUIL_CONDUITE

    reponse = regulator.affecter(etat, "moreau", "chirurgie")

    assert reponse.accepte is False
    assert reponse.titre == "ORDRE REFUSE"
    assert reponse.parole.startswith("Negatif. Conduite de moreau")
    assert etat.poste("chirurgie").titulaire != "moreau"


def test_affecter_refuse_journalise_le_motif_de_conduite(etat):
    db.enregistrer_incident(etat.conn, "moreau", "vision", "doigt_honneur", 0.45, "geste")
    regulator.affecter(etat, "moreau", "chirurgie", auteur="capitaine")

    lignes = db.journal(etat.conn)
    assert lignes[0]["type"] == "refus"
    assert lignes[0]["sujet"] == "moreau"
    assert lignes[0]["acteur"] == "capitaine"
    assert "conduite" in lignes[0]["motif"]
    donnees = json.loads(lignes[0]["donnees"])
    assert donnees["motif"] == "conduite"


def test_affecter_refuse_sans_la_qualification_requise(etat):
    membre = etat.membre("moreau")
    assert "propulsion" not in membre.competences

    reponse = regulator.affecter(etat, "moreau", "propulsion")

    assert reponse.accepte is False
    assert reponse.titre == "REFUSE"
    assert "qualifie" in reponse.parole
    lignes = db.journal(etat.conn)
    assert lignes[0]["type"] == "refus"
    assert "qualification" in lignes[0]["motif"]


def test_affecter_refuse_sous_le_seuil_de_capacite(etat):
    membre = etat.membre("blanc")
    poste = etat.poste("laboratoire")
    assert membre.cognitive < poste.seuil

    reponse = regulator.affecter(etat, "blanc", "laboratoire")

    assert reponse.accepte is False
    assert reponse.titre == "ORDRE REFUSE"
    assert f"{membre.cognitive:.2f}" in reponse.detail
    lignes = db.journal(etat.conn)
    assert "capacité" in lignes[0]["motif"]


def test_affecter_refuse_un_poste_vital_sous_le_seuil_de_confiance(etat, monkeypatch):
    membre = etat.membre("bernard")
    poste = etat.poste("chirurgie")
    assert poste.criticite == "vital"
    assert membre.cognitive >= poste.seuil
    assert db.conduite(etat.conn, "bernard") >= db.SEUIL_CONDUITE

    def confiances_truquees(conn, g=None):
        return {"bernard": {"confiance": 0.30, "conduite": 1.0,
                            "regularite": 0.9, "appui": 0.1, "sous_seuil": True}}

    monkeypatch.setattr(social, "confiances", confiances_truquees)

    reponse = regulator.affecter(etat, "bernard", "chirurgie")

    assert reponse.accepte is False
    assert reponse.titre == "ORDRE REFUSE"
    assert "Poste vital" in reponse.parole
    lignes = db.journal(etat.conn)
    assert lignes[0]["donnees"]
    donnees = json.loads(lignes[0]["donnees"])
    assert donnees["motif"] == "confiance"


def test_affecter_membre_inconnu(etat):
    reponse = regulator.affecter(etat, "fantome", "chirurgie")
    assert reponse.accepte is False
    assert reponse.titre == "INCONNU"


def test_affecter_poste_inconnu(etat):
    reponse = regulator.affecter(etat, "moreau", "hangar")
    assert reponse.accepte is False
    assert reponse.titre == "POSTE INCONNU"


def test_deroger_passe_outre_le_seuil_de_capacite(etat):
    membre = etat.membre("blanc")
    poste = etat.poste("laboratoire")
    assert membre.cognitive < poste.seuil

    reponse = regulator.deroger(etat, "blanc", "laboratoire", auteur="capitaine")

    assert reponse.accepte is True
    assert reponse.titre == "DEROGATION ENREGISTREE"
    assert etat.poste("laboratoire").titulaire == "blanc"


def test_deroger_journalise_acteur_horodatage_et_donnees(etat):
    avant = time.time()
    regulator.deroger(etat, "blanc", "laboratoire", auteur="capitaine")
    apres = time.time()

    lignes = db.journal(etat.conn)
    entree = lignes[0]
    assert entree["type"] == "derogation"
    assert entree["acteur"] == "capitaine"
    assert entree["sujet"] == "blanc"
    assert avant <= entree["ts"] <= apres
    donnees = json.loads(entree["donnees"])
    assert donnees["poste"] == "laboratoire"
    assert donnees["seuil"] == etat.poste("laboratoire").seuil


def test_deroger_cible_inconnue_refuse(etat):
    reponse = regulator.deroger(etat, "fantome", "laboratoire")
    assert reponse.accepte is False
    assert reponse.titre == "DEROGATION REFUSEE"


def test_qui_peut_recommande_le_plus_apte(etat):
    reponse = regulator.qui_peut(etat, "chirurgie")
    assert reponse.accepte is True
    assert "bernard" in reponse.parole


def test_qui_peut_sans_aucun_membre_apte(etat, monkeypatch):
    poste = etat.poste("chirurgie")
    monkeypatch.setattr(poste, "seuil", 1.5)
    reponse = regulator.qui_peut(etat, "chirurgie")
    assert reponse.accepte is False
    assert "AUCUN APTE" in reponse.titre


def test_qui_peut_poste_inconnu(etat):
    reponse = regulator.qui_peut(etat, "hangar")
    assert reponse.accepte is False
    assert reponse.titre == "POSTE INCONNU"
