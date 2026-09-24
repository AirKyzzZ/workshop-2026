import random
import time

from atria import physiologie


def test_trajectoire_finit_exactement_sur_la_cible():
    alea = random.Random(1)
    serie = physiologie.trajectoire(alea, cible=0.72)
    assert serie[-1]["capacite"] == 0.72


def test_trajectoire_reste_dans_les_bornes_du_plancher_et_du_plafond():
    alea = random.Random(2)
    serie = physiologie.trajectoire(alea, cible=0.5)
    for point in serie:
        assert physiologie.PLANCHER <= point["capacite"] <= physiologie.PLAFOND


def test_trajectoire_est_deterministe_pour_une_meme_graine():
    serie_a = physiologie.trajectoire(random.Random(42), cible=0.6)
    serie_b = physiologie.trajectoire(random.Random(42), cible=0.6)
    assert serie_a == serie_b


def test_trajectoire_differe_selon_la_cible():
    alea_a = random.Random(7)
    alea_b = random.Random(7)
    serie_haute = physiologie.trajectoire(alea_a, cible=0.9)
    serie_basse = physiologie.trajectoire(alea_b, cible=0.3)
    assert serie_haute[-1]["capacite"] != serie_basse[-1]["capacite"]


def test_trajectoire_produit_le_nombre_de_points_attendu():
    alea = random.Random(3)
    serie = physiologie.trajectoire(alea, cible=0.6, heures=48, pas_minutes=60)
    assert len(serie) == int(48 / 1.0) + 1


def test_regenerer_conserve_la_derniere_capacite_de_chaque_membre(conn):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES ('moreau','officier','chirurgie')")
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES ('moreau', ?, 0.68, 'seed')",
        (time.time(),))
    conn.commit()

    refaits = physiologie.regenerer(conn, graine=1)

    assert refaits == 1
    dernier = conn.execute(
        "SELECT cognitive FROM capacite WHERE crew = 'moreau' AND source = 'seed'"
        " ORDER BY ts DESC LIMIT 1").fetchone()
    assert dernier["cognitive"] == 0.68


def test_regenerer_ignore_les_membres_sans_aucun_historique(conn):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES ('moreau','officier','chirurgie')")
    conn.commit()

    refaits = physiologie.regenerer(conn, graine=1)

    assert refaits == 0


def test_regenerer_remplace_l_historique_seed_par_une_nouvelle_trajectoire(conn):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES ('moreau','officier','chirurgie')")
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, source) VALUES ('moreau', ?, 0.68, 'seed')",
        (time.time(),))
    conn.commit()

    physiologie.regenerer(conn, graine=1)

    lignes = conn.execute(
        "SELECT COUNT(*) AS n FROM capacite WHERE crew = 'moreau'").fetchone()
    assert lignes["n"] > 1
