import time

from atria import db


def test_ordre_refuse_apres_incident_puis_derogation_capitaine(client, capitaine, etat):
    poste = next(p for p in client.get("/api/etat").json()["postes"]
                 if p["criticite"] == "vital")

    premiere = client.post("/api/affectation", json={"nom": "moreau", "poste": poste["nom"]})
    corps_premiere = premiere.json()
    assert corps_premiere["accepte"] is True
    assert corps_premiere["titre"] == "AFFECTATION VALIDEE"

    db.enregistrer_incident(etat.conn, "moreau", "camera", "doigt_honneur", 0.45)

    refus = client.post("/api/affectation", json={"nom": "moreau", "poste": poste["nom"]})
    corps_refus = refus.json()
    assert corps_refus["accepte"] is False
    assert corps_refus["titre"] == "ORDRE REFUSE"
    assert "0.60" in corps_refus["detail"]

    derogation = client.post("/api/derogation", json={"nom": "moreau", "poste": poste["nom"]})
    corps_derogation = derogation.json()
    assert corps_derogation["accepte"] is True
    assert corps_derogation["titre"] == "DEROGATION ENREGISTREE"

    journal = client.get("/api/journal", params={"limite": 20}).json()["entrees"]
    types = [entree["type"] for entree in journal]
    assert "refus" in types
    assert "derogation" in types

    entree_derogation = next(e for e in journal if e["type"] == "derogation")
    assert entree_derogation["acteur"] == "maxime"
    assert entree_derogation["sujet"] == "moreau"
    assert entree_derogation["ts"] > 0


def test_incendie_serre_evacue_puis_scelle_puis_leve(client, capitaine, etat):
    debut = client.post("/api/surete/simulation",
                        json={"compartiment": "serre", "actif": True})
    corps_debut = debut.json()
    assert corps_debut["fumee"] is True
    evacuation = next(a for a in corps_debut["actions"] if a["compartiment"] == "serre")
    assert evacuation["action"] == "evacuation"
    assert evacuation["occupants"]

    surete = client.get("/api/surete").json()
    cas = next(c for c in surete["feu"] if c["compartiment"] == "serre")
    assert cas["decision"] == "evacuer"

    ecrans = db.ecrans(etat.conn)
    assert ecrans["serre"]["haut"] == "!! EVACUEZ !!"

    etat.conn.execute(
        "UPDATE presence SET sortie = ? WHERE compartiment = 'serre' AND sortie IS NULL",
        (time.time(),))
    etat.conn.commit()

    relance = client.post("/api/surete/simulation",
                          json={"compartiment": "serre", "actif": True})
    corps_relance = relance.json()
    scelle = next(a for a in corps_relance["actions"] if a["compartiment"] == "serre")
    assert scelle["action"] == "scelle"

    surete_scelle = client.get("/api/surete").json()
    cas_scelle = next(c for c in surete_scelle["feu"] if c["compartiment"] == "serre")
    assert cas_scelle["decision"] == "sceller"

    fin = client.post("/api/surete/simulation",
                      json={"compartiment": "serre", "actif": False})
    corps_fin = fin.json()
    assert corps_fin["fumee"] is False
    leve = next(a for a in corps_fin["actions"] if a["compartiment"] == "serre")
    assert leve["action"] == "leve"
