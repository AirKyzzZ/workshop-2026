import os
import tempfile

# les chemins de la base et des modèles sont calculés depuis HOME à l'import des modules
os.environ["HOME"] = tempfile.mkdtemp(prefix="atria-tests-")

import pytest

from atria import db, model


@pytest.fixture
def conn(tmp_path, monkeypatch):
    chemin = str(tmp_path / "atria.db")
    monkeypatch.setattr(db, "CHEMIN", chemin)
    # connexion() a figé l'ancien CHEMIN comme valeur par défaut au moment de sa définition
    monkeypatch.setattr(db.connexion, "__defaults__", (chemin,))
    connexion = db.connexion(chemin)
    yield connexion
    connexion.close()


@pytest.fixture
def etat(conn):
    return model.Etat(conn)
