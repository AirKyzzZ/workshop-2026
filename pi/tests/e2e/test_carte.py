import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import pytest

pytestmark = pytest.mark.pi

ATRIA_URL = os.environ.get("ATRIA_URL", "http://192.168.50.104:8000")
ECRITURE = os.environ.get("ATRIA_E2E_ECRITURE") == "1"

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


@pytest.fixture(scope="module", autouse=True)
def _carte_accessible():
    try:
        urllib.request.urlopen(ATRIA_URL + "/api/session", timeout=2.0)
    except (urllib.error.URLError, OSError):
        pytest.skip(f"carte ATRIA inaccessible sur {ATRIA_URL}")


def _lire(chemin, delai=5.0):
    with urllib.request.urlopen(ATRIA_URL + chemin, timeout=delai) as r:
        return json.load(r)


def _poster(chemin, corps, delai=10.0):
    requete = urllib.request.Request(
        ATRIA_URL + chemin, data=json.dumps(corps).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(requete, timeout=delai) as r:
        return json.load(r)


@pytest.mark.parametrize("chemin, cles", ROUTES.items(), ids=list(ROUTES))
def test_route_du_tableau_de_bord_repond_200_avec_ses_cles(chemin, cles):
    corps = _lire(chemin)
    for cle in cles:
        assert cle in corps


def test_image_camera_est_un_jpeg():
    with urllib.request.urlopen(ATRIA_URL + "/api/camera/image", timeout=10) as r:
        assert r.headers.get("Content-Type") == "image/jpeg"
        assert r.read(2) == b"\xff\xd8"


def test_surveillance_est_armee_avec_les_modeles_charges():
    d = _lire("/api/camera/etat")
    s = d["surveillance"]
    assert s["arme"] is True
    assert s["modeles"] is True


@pytest.mark.parametrize("compartiment", ["infirmerie", "réacteur"])
def test_releve_atmospherique_est_frais_de_moins_de_120s(compartiment):
    chemin = f"/api/ambiance/{urllib.parse.quote(compartiment)}?heures=1"
    d = _lire(chemin)
    points = [p for p in d["points"] if p["temp_c"] is not None]
    assert points

    age = time.time() - points[-1]["ts"]
    assert age < 120


def test_les_vingt_quatre_membres_sont_evalues():
    p = _lire("/api/prediction")
    assert len(p["risques"]) == 24


def test_simulation_incendie_ecrit_puis_leve_la_combustion():
    if not ECRITURE:
        pytest.skip("ATRIA_E2E_ECRITURE != 1, ecriture non autorisee sur la carte")
    try:
        r = _poster("/api/surete/simulation", {"compartiment": "serre", "actif": True})
        assert r["fumee"] is True
    finally:
        r = _poster("/api/surete/simulation", {"compartiment": "serre", "actif": False})
        assert r["fumee"] is False
