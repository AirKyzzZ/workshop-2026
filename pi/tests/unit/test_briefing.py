import time

from atria import briefing, confinement, db


def test_constats_compte_les_membres_actifs(etat):
    lignes = briefing.constats(etat)
    actifs = sum(1 for c in etat.equipage if c.statut == "actif")
    assert lignes[0] == f"{actifs} membres en service actif."


def test_constats_signale_les_postes_sans_titulaire(etat):
    etat.conn.execute("UPDATE poste SET titulaire = NULL WHERE nom = 'laboratoire'")
    etat.conn.commit()
    etat.recharger()

    lignes = briefing.constats(etat)

    assert any("sans titulaire" in l and "laboratoire" in l for l in lignes)


def test_constats_sans_poste_decouvert_dit_tout_couvert(etat):
    lignes = briefing.constats(etat)
    assert "Tous les postes sont couverts." in lignes


def test_constats_signale_les_capacites_basses(etat):
    membre = next(c for c in etat.equipage if c.cognitive >= briefing.SEUIL_CAPACITE_BASSE)
    etat.conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive) VALUES (?,?,?)",
        (membre.nom, time.time(), 0.10))
    etat.conn.commit()
    etat.recharger()

    lignes = briefing.constats(etat)

    assert any("sous 0.50 de capacité" in l and membre.nom in l for l in lignes)


def test_constats_reprend_la_conduite_relevee_sur_les_incidents(etat):
    db.enregistrer_incident(etat.conn, "moreau", "vision", "doigt_honneur", 0.45)

    lignes = briefing.constats(etat)

    assert any(l.startswith("Conduite relevée sur 24 heures") and "moreau" in l
              for l in lignes)


def test_constats_sans_incident_omet_la_ligne_de_conduite(etat):
    lignes = briefing.constats(etat)
    assert not any(l.startswith("Conduite relevée") for l in lignes)


def test_constats_signale_les_confinements_actifs(etat):
    etat.declencher_fumee("atelier", True)
    confinement.appliquer_feu(etat)

    lignes = briefing.constats(etat)

    assert any("dossiers de confinement ouverts" in l and "atelier" in l for l in lignes)


def test_constats_sans_confinement_actif_omet_la_ligne(etat):
    lignes = briefing.constats(etat)
    assert not any("dossiers de confinement" in l for l in lignes)


def test_rediger_sans_modele_rend_le_texte_brut_deterministe(etat, monkeypatch):
    monkeypatch.setattr(briefing.llm, "ACTIF", False)

    resultat = briefing.rediger(etat, force=True)

    assert resultat["source"] == "outils de bord"
    assert resultat["rejet"] == "modèle éteint"
    assert resultat["texte"] == " ".join(resultat["constats"])
    assert resultat["modele_actif"] is False


def test_rediger_reutilise_le_cache_tant_qu_il_est_frais(etat, monkeypatch):
    monkeypatch.setattr(briefing.llm, "ACTIF", False)

    premier = briefing.rediger(etat, force=True)
    db.enregistrer_incident(etat.conn, "moreau", "vision", "doigt_honneur", 0.45)
    second = briefing.rediger(etat)

    assert second is premier


def test_rediger_avec_force_recalcule_les_constats(etat, monkeypatch):
    monkeypatch.setattr(briefing.llm, "ACTIF", False)

    briefing.rediger(etat, force=True)
    db.enregistrer_incident(etat.conn, "moreau", "vision", "doigt_honneur", 0.45)
    second = briefing.rediger(etat, force=True)

    assert any("moreau" in c for c in second["constats"])
