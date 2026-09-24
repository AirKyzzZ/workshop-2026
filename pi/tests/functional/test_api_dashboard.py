import pytest

ROUTES = {
    "/api/etat": ("equipage", "compartiments", "confinements"),
    "/api/social": ("noeuds", "liens", "conflits"),
    "/api/surete": ("feu", "menaces", "dossiers"),
    "/api/perception": ("camera", "ecoute", "modules"),
    "/api/prediction": ("modele", "risques", "anomalies"),
    "/api/briefing": ("constats", "texte"),
    "/api/pouls": ("actif", "duree_s"),
    "/api/ecoute": ("ecoute", "modules", "incidents"),
    "/api/modules": ("modules",),
    "/api/surveillance": ("incidents", "conduites"),
    "/api/journal": ("entrees",),
    "/api/camera/etat": ("actif", "surveillance"),
    "/api/session": ("acteur", "capitaine"),
}


@pytest.mark.parametrize("chemin, cles", ROUTES.items(), ids=list(ROUTES))
def test_route_du_tableau_de_bord_repond_200_avec_ses_cles(client, chemin, cles):
    reponse = client.get(chemin)
    assert reponse.status_code == 200
    corps = reponse.json()
    for cle in cles:
        assert cle in corps


def test_image_camera_sans_flux_rend_503(client):
    reponse = client.get("/api/camera/image")
    assert reponse.status_code == 503
