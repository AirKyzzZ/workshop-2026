def test_le_capitaine_non_identifie_ne_peut_pas_affecter(client):
    reponse = client.post("/api/affectation", json={"nom": "moreau", "poste": "chirurgie"})
    corps = reponse.json()
    assert corps["accepte"] is False
    assert corps["erreur"] == "reserve au capitaine identifie"

    journal = client.get("/api/journal").json()["entrees"]
    entree = next(e for e in journal
                  if e["motif"] == "affectation refusee, capitaine non identifie")
    assert entree["acteur"] == "anonyme"


def test_route_biometrique_refusee_sans_capitaine(client):
    reponse = client.get("/api/visage/enroles")
    assert reponse.status_code == 200
    assert reponse.json()["erreur"] == "reserve au capitaine identifie"


def test_route_biometrique_ouverte_au_capitaine(client, capitaine):
    reponse = client.get("/api/visage/enroles")
    corps = reponse.json()
    assert "erreur" not in corps
    assert corps["membres"] == []


def test_pouls_refuse_sans_capitaine(client):
    reponse = client.post("/api/pouls", json={"crew": "moreau"})
    assert reponse.json()["erreur"] == "reserve au capitaine identifie"


def test_armement_module_refuse_sans_capitaine(client):
    reponse = client.post("/api/modules", json={"nom": "ecoute", "actif": True})
    assert reponse.json()["erreur"] == "reserve au capitaine identifie"


def test_armement_module_accepte_par_le_capitaine(client, capitaine):
    reponse = client.post("/api/modules",
                          json={"nom": "ecoute", "actif": True, "minutes": 5})
    corps = reponse.json()
    assert corps["actif"] is True
    assert corps["nom"] == "ecoute"

    modules_actifs = client.get("/api/modules").json()["modules"]
    ecoute_module = next(m for m in modules_actifs if m["nom"] == "ecoute")
    assert ecoute_module["actif"] is True
