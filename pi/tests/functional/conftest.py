import pytest
from fastapi.testclient import TestClient

from atria import api, briefing, db, ecoute, llm, modules, social, visage


def _etats_modules_defaut():
    return {nom: {"actif": nom in modules.PERMANENTS, "expire": None}
            for nom in modules.DEFINITIONS}


@pytest.fixture
def client(etat, monkeypatch):
    monkeypatch.setattr(api, "etat", etat)
    monkeypatch.setattr(visage, "disponible", lambda: False)
    monkeypatch.setattr(ecoute, "disponible", lambda: False)
    monkeypatch.setattr(llm, "prechauffer", lambda: None)

    async def boucle_surete_stub():
        return None

    monkeypatch.setattr(api, "boucle_surete", boucle_surete_stub)

    modules._etats.clear()
    modules._etats.update(_etats_modules_defaut())
    briefing._cache = None
    social._graphe_cache.update({"valeur": None, "ts": 0.0})
    api._prediction_cache.update({"valeur": None, "ts": 0.0})
    api._contagion_cache.update({"valeur": [], "ts": 0.0})
    api._dernier_acces_medical = 0.0
    api._spectateurs = 0

    with TestClient(api.app) as c:
        yield c

    modules._etats.clear()
    modules._etats.update(_etats_modules_defaut())


@pytest.fixture
def capitaine(etat):
    db.ouvrir_session(etat.conn, "maxime", "capitaine")
    return "maxime"
