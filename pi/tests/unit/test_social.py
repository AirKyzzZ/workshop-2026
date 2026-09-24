import time

import pytest

from atria import db, social

T0 = 1_700_000_000.0
DEPUIS = T0 - 100_000.0


@pytest.fixture(autouse=True)
def _graphe_sans_cache():
    social._graphe_cache["valeur"] = None
    social._graphe_cache["ts"] = 0.0
    yield
    social._graphe_cache["valeur"] = None
    social._graphe_cache["ts"] = 0.0


def _compartiment(conn, nom):
    ordre = conn.execute("SELECT COUNT(*) AS n FROM compartiment").fetchone()["n"]
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES (?,?)", (nom, ordre))


def _crew(conn, nom):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES (?,?,?)",
                (nom, "technicien", "maintenance"))


def _presence(conn, crew, compartiment, entree, sortie):
    conn.execute("INSERT INTO presence (crew, compartiment, entree, sortie) VALUES (?,?,?,?)",
                (crew, compartiment, entree, sortie))


def _incident(conn, crew, ts, type_="cri", gravite=0.5):
    conn.execute(
        "INSERT INTO incident (crew, ts, canal, type, gravite, detail) VALUES (?,?,?,?,?,?)",
        (crew, ts, "vision", type_, gravite, None))


def test_frictions_partage_le_credit_entre_temoins_a_parts_egales(conn):
    _compartiment(conn, "serre")
    for nom in ("d", "e", "f"):
        _crew(conn, nom)
        _presence(conn, nom, "serre", T0, T0 + 4 * 3600)
    _incident(conn, "d", T0 + 3600)
    conn.commit()

    compte = social.frictions(conn, depuis=DEPUIS)

    assert compte[("d", "e")] == pytest.approx(0.5)
    assert compte[("d", "f")] == pytest.approx(0.5)


def test_un_seul_incident_ne_suffit_pas_a_rendre_un_lien_hostile(conn):
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _presence(conn, "a", "pont", T0, T0 + 4 * 3600)
    _presence(conn, "b", "pont", T0, T0 + 4 * 3600)
    _incident(conn, "a", T0 + 3600)
    conn.commit()

    g = social.graphe(conn, depuis=DEPUIS)
    lien = g["liens"][0]

    assert lien["nature"] != "hostile"


def test_la_repetition_de_frictions_avec_la_meme_personne_rend_le_lien_hostile(conn):
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _presence(conn, "a", "pont", T0, T0 + 4 * 3600)
    _presence(conn, "b", "pont", T0, T0 + 4 * 3600)
    for decalage in (3600, 3700, 3800):
        _incident(conn, "a", T0 + decalage)
    conn.commit()

    g = social.graphe(conn, depuis=DEPUIS)
    lien = g["liens"][0]

    assert lien["nature"] == "hostile"
    assert lien["lien"] <= social.SEUIL_HOSTILE


def test_co_presence_sous_le_minimum_ne_produit_aucun_lien(conn):
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    minutes_courtes = social.MINUTES_LIEN_MIN - 10
    _presence(conn, "a", "pont", T0, T0 + minutes_courtes * 60)
    _presence(conn, "b", "pont", T0, T0 + minutes_courtes * 60)
    conn.commit()

    g = social.graphe(conn, depuis=DEPUIS)

    assert g["liens"] == []


def test_co_presence_au_dessus_du_minimum_produit_un_lien(conn):
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    minutes_longues = social.MINUTES_LIEN_MIN + 10
    _presence(conn, "a", "pont", T0, T0 + minutes_longues * 60)
    _presence(conn, "b", "pont", T0, T0 + minutes_longues * 60)
    conn.commit()

    g = social.graphe(conn, depuis=DEPUIS)

    assert len(g["liens"]) == 1
    assert g["liens"][0]["nature"] == "amical"


def test_sans_partage_de_compartiment_aucune_co_presence(conn):
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _crew(conn, "c")
    _presence(conn, "a", "pont", T0, T0 + 4 * 3600)
    _presence(conn, "c", "pont", T0, T0 + 4 * 3600)
    conn.commit()

    partage, _ = social.co_presences(conn, depuis=DEPUIS)

    assert ("a", "c") in partage
    assert ("a", "b") not in partage
    assert ("b", "c") not in partage


def test_proximite_est_relative_a_la_paire_la_plus_presente(conn):
    _compartiment(conn, "pont")
    _compartiment(conn, "serre")
    for nom in ("a", "b", "c", "d"):
        _crew(conn, nom)
    _presence(conn, "a", "pont", T0, T0 + 4 * 3600)
    _presence(conn, "b", "pont", T0, T0 + 4 * 3600)
    _presence(conn, "c", "serre", T0, T0 + 2 * 3600)
    _presence(conn, "d", "serre", T0, T0 + 2 * 3600)
    conn.commit()

    g = social.graphe(conn, depuis=DEPUIS)
    liens = {(l["un"], l["deux"]): l for l in g["liens"]}

    assert liens[("a", "b")]["proximite"] == 1.0
    assert liens[("c", "d")]["proximite"] == pytest.approx(0.5)
    assert liens[("c", "d")]["lien"] < liens[("a", "b")]["lien"]


def test_confiance_par_defaut_sans_incident_est_haute(conn):
    agora = time.time()
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _presence(conn, "a", "pont", agora - 4 * 3600, agora - 60)
    _presence(conn, "b", "pont", agora - 4 * 3600, agora - 60)
    conn.commit()

    valeur = social.confiance(conn, "a")

    assert valeur > social.SEUIL_CONFIANCE


def test_confiance_baisse_avec_une_conduite_effondree(conn):
    agora = time.time()
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _presence(conn, "a", "pont", agora - 4 * 3600, agora - 60)
    _presence(conn, "b", "pont", agora - 4 * 3600, agora - 60)
    for decalage in (3600, 3500, 3400, 3300):
        _incident(conn, "a", agora - decalage, gravite=1.0)
    conn.commit()

    confiances = social.confiances(conn)

    assert confiances["a"]["conduite"] < db.SEUIL_CONDUITE
    assert confiances["a"]["confiance"] < confiances["b"]["confiance"]


def test_conflits_probables_rend_la_paire_hostile_avec_son_compartiment(conn):
    agora = time.time()
    _compartiment(conn, "pont")
    _crew(conn, "a")
    _crew(conn, "b")
    _presence(conn, "a", "pont", agora - 4 * 3600, agora - 60)
    _presence(conn, "b", "pont", agora - 4 * 3600, agora - 60)
    for decalage in (3600, 3500, 3400):
        _incident(conn, "a", agora - decalage)
    conn.commit()

    conflits = social.conflits_probables(conn)

    assert conflits[0]["paire"] == ["a", "b"]
    assert conflits[0]["compartiment"] == "pont"


def test_exposition_distingue_le_premier_et_le_second_rang(conn):
    agora = time.time()
    _compartiment(conn, "pont")
    _compartiment(conn, "serre")
    for nom in ("source", "proche", "lointain"):
        _crew(conn, nom)
    _presence(conn, "source", "pont", agora - 10 * 3600, agora - 6 * 3600)
    _presence(conn, "proche", "pont", agora - 10 * 3600, agora - 6 * 3600)
    _presence(conn, "proche", "serre", agora - 5 * 3600, agora - 4 * 3600)
    _presence(conn, "lointain", "serre", agora - 5 * 3600, agora - 4 * 3600)
    conn.commit()

    resultat = social.exposition(conn, "source", heures=24)

    assert [r["nom"] for r in resultat["rang1"]] == ["proche"]
    assert [r["nom"] for r in resultat["rang2"]] == ["lointain"]
