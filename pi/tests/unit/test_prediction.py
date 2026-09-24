import numpy as np
import pytest

from atria import anomalie, apprentissage, predict


def _serie_lineaire(pente_par_heure, points=10, depart=0.9, pas_h=1.0):
    t0 = 1_700_000_000.0
    return [(t0 + i * pas_h * 3600, depart + i * pente_par_heure * pas_h) for i in range(points)]


def test_ajuster_detecte_une_pente_negative_fiable():
    serie = _serie_lineaire(-0.02, points=10)
    tendance = predict.ajuster(serie)

    assert tendance.fiable is True
    assert tendance.baisse is True
    assert tendance.pente_h == pytest.approx(-0.02, abs=1e-9)
    assert tendance.r2 == pytest.approx(1.0, abs=1e-6)


def test_ajuster_pente_positive_n_est_pas_une_baisse():
    serie = _serie_lineaire(0.01, points=10)
    tendance = predict.ajuster(serie)

    assert tendance.baisse is False


def test_ajuster_peu_de_points_n_est_pas_fiable():
    serie = _serie_lineaire(-0.05, points=3)
    tendance = predict.ajuster(serie)

    assert tendance.points < predict.MIN_POINTS
    assert tendance.fiable is False


def test_ajuster_rend_none_avec_moins_de_deux_points():
    assert predict.ajuster([(1_700_000_000.0, 0.8)]) is None


def test_ajuster_rend_none_si_tous_les_points_ont_le_meme_horodatage():
    serie = [(1_700_000_000.0, 0.5), (1_700_000_000.0, 0.9)]
    assert predict.ajuster(serie) is None


def test_heures_avant_rend_none_si_la_pente_est_positive():
    serie = _serie_lineaire(0.01, points=10)
    tendance = predict.ajuster(serie)
    assert tendance.heures_avant(0.5) is None


def test_heures_avant_rend_none_si_deja_sous_le_seuil():
    serie = _serie_lineaire(-0.01, points=10, depart=0.4)
    tendance = predict.ajuster(serie)
    assert tendance.heures_avant(0.5) is None


def test_heures_avant_calcule_le_temps_restant_avant_le_seuil():
    serie = _serie_lineaire(-0.02, points=10, depart=0.9)
    tendance = predict.ajuster(serie)
    attendu = (tendance.derniere - 0.6) / 0.02
    assert tendance.heures_avant(0.6) == pytest.approx(attendu)


def test_heures_avant_rend_none_au_dela_de_l_horizon_maximal():
    serie = _serie_lineaire(-0.0001, points=10, depart=0.9)
    tendance = predict.ajuster(serie)
    assert tendance.heures_avant(0.05) is None


def test_projection_rend_la_derniere_valeur_a_horizon_nul():
    serie = _serie_lineaire(-0.01, points=10, depart=0.9)
    tendance = predict.ajuster(serie)
    assert tendance.projection(0) == pytest.approx(tendance.derniere)


def test_projection_se_clampe_a_zero_pour_une_chute_extreme():
    serie = _serie_lineaire(-0.5, points=10, depart=0.9)
    tendance = predict.ajuster(serie)
    assert tendance.projection(1000) == 0.0


def test_ecart_ligne_de_base_mesure_un_saut_recent():
    stable = [(1_700_000_000.0 + i * 3600, 0.80 + (0.01 if i % 2 else -0.01))
              for i in range(predict.MIN_POINTS)]
    saut = [(1_700_000_000.0 + (predict.MIN_POINTS + i) * 3600, 0.30) for i in range(4)]
    serie = stable + saut

    ecart = predict.ecart_ligne_de_base(serie, fenetre_recente=4)

    assert ecart < -2.0


def test_ecart_ligne_de_base_rend_none_avec_pas_assez_de_points():
    serie = [(1_700_000_000.0 + i * 3600, 0.8) for i in range(predict.MIN_POINTS)]
    assert predict.ecart_ligne_de_base(serie, fenetre_recente=4) is None


def test_ecart_ligne_de_base_rend_none_si_aucune_variance_de_reference():
    serie = [(1_700_000_000.0 + i * 3600, 0.8) for i in range(predict.MIN_POINTS + 4)]
    assert predict.ecart_ligne_de_base(serie, fenetre_recente=4) is None


def _donnees_separables(n=200, graine=0):
    rng = np.random.default_rng(graine)
    x_pos = rng.normal(2.0, 0.4, size=(n // 2, 1))
    x_neg = rng.normal(-2.0, 0.4, size=(n // 2, 1))
    X = np.vstack([x_pos, x_neg])
    y = np.concatenate([np.ones(n // 2), np.zeros(n // 2)])
    ordre = rng.permutation(n)
    return X[ordre], y[ordre]


def test_entrainer_separe_bien_des_donnees_lineairement_separables():
    X, y = _donnees_separables()
    modele = apprentissage.entrainer(X, y)
    p = apprentissage.predire(modele, X)
    mesures = apprentissage.evaluer(y, p)

    assert mesures["auc"] > 0.95


def test_predire_est_croissante_avec_la_variable_discriminante():
    X, y = _donnees_separables()
    modele = apprentissage.entrainer(X, y)

    p_bas = apprentissage.predire(modele, [[-3.0]])[0]
    p_haut = apprentissage.predire(modele, [[3.0]])[0]

    assert p_haut > p_bas


def test_contributions_ont_le_signe_du_theta_pour_une_valeur_au_dessus_de_la_moyenne():
    X, y = _donnees_separables()
    modele = apprentissage.entrainer(X, y)

    apports = apprentissage.contributions(modele, [3.0])

    assert apports[0]["apport"] > 0


def test_evaluer_calcule_precision_rappel_et_exactitude_sur_une_matrice_connue():
    y = np.array([1, 1, 1, 0, 0, 0])
    p = np.array([0.9, 0.8, 0.4, 0.6, 0.2, 0.1])

    mesures = apprentissage.evaluer(y, p, seuil=0.5)

    assert mesures["vrais_positifs"] == 2
    assert mesures["faux_negatifs"] == 1
    assert mesures["vrais_negatifs"] == 2
    assert mesures["faux_positifs"] == 1
    assert mesures["precision"] == pytest.approx(2 / 3, abs=1e-3)
    assert mesures["rappel"] == pytest.approx(2 / 3, abs=1e-3)
    assert mesures["exactitude"] == pytest.approx(4 / 6, abs=1e-3)


def test_roc_est_bornee_et_extreme_aux_bouts():
    y = np.array([1, 1, 0, 0])
    p = np.array([0.9, 0.6, 0.4, 0.1])
    courbe = apprentissage.roc(y, p)

    for point in courbe:
        assert 0.0 <= point["fpr"] <= 1.0
        assert 0.0 <= point["tpr"] <= 1.0
    assert courbe[0]["seuil"] == 1.0
    assert courbe[-1]["seuil"] == 0.0
    assert courbe[-1]["tpr"] == 1.0
    assert courbe[-1]["fpr"] == 1.0


def _crew(conn, nom):
    conn.execute("INSERT INTO crew (nom, role, competences) VALUES (?,?,?)",
                (nom, "technicien", "maintenance"))
    conn.commit()


def _capacite(conn, crew, ts, cognitive, sommeil=7.0, dette=0):
    conn.execute(
        "INSERT INTO capacite (crew, ts, cognitive, sommeil_h, dette_sociale, source)"
        " VALUES (?,?,?,?,?,?)",
        (crew, ts, cognitive, sommeil, dette, "seed"))


def test_exemples_etiquette_positivement_une_rupture_dans_l_horizon(conn):
    _crew(conn, "moreau")
    t0 = 1_700_000_000.0
    pas = 1800
    valeurs = [0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.55, 0.50, 0.45, 0.40, 0.35]
    for i, v in enumerate(valeurs):
        _capacite(conn, "moreau", t0 + i * pas, v)
    conn.commit()

    lignes, etiquettes = apprentissage.exemples(conn, "moreau")

    assert len(lignes) == len(etiquettes)
    assert any(e == 1 for e in etiquettes)
    for ligne, etiquette in zip(lignes, etiquettes):
        assert ligne[0] >= apprentissage.SEUIL_APTITUDE


def test_exemples_exclut_les_points_deja_sous_le_seuil(conn):
    _crew(conn, "moreau")
    t0 = 1_700_000_000.0
    pas = 1800
    valeurs = [0.50] * 12
    for i, v in enumerate(valeurs):
        _capacite(conn, "moreau", t0 + i * pas, v)
    conn.commit()

    lignes, etiquettes = apprentissage.exemples(conn, "moreau")

    assert lignes == []
    assert etiquettes == []


def test_exemples_ne_regarde_jamais_au_dela_de_l_horizon(conn):
    _crew(conn, "moreau")
    t0 = 1_700_000_000.0
    horizon_pas = apprentissage.HORIZON_S / 1800.0
    valeurs = [0.90] * 11 + [0.10]
    for i, v in enumerate(valeurs):
        ts = t0 + i * 1800 if i <= 10 else t0 + (10 * 1800) + apprentissage.HORIZON_S + 3600
        _capacite(conn, "moreau", ts, v)
    conn.commit()

    lignes, etiquettes = apprentissage.exemples(conn, "moreau")

    assert all(e == 0 for e in etiquettes)


def test_rassembler_regroupe_les_exemples_par_membre(conn):
    _crew(conn, "moreau")
    _crew(conn, "blanc")
    t0 = 1_700_000_000.0
    for i in range(11):
        _capacite(conn, "moreau", t0 + i * 1800, 0.9 - i * 0.02)
        _capacite(conn, "blanc", t0 + i * 1800, 0.9 - i * 0.02)
    conn.commit()

    X, y, groupes = apprentissage.rassembler(conn)

    assert set(groupes) == {"moreau", "blanc"}
    assert len(X) == len(y) == len(groupes)


def _presence(conn, crew, compartiment, entree, sortie):
    conn.execute("INSERT INTO presence (crew, compartiment, entree, sortie) VALUES (?,?,?,?)",
                (crew, compartiment, entree, sortie))


def _compartiment(conn, nom, ordre=0):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES (?,?)", (nom, ordre))


def test_anomalie_ecart_est_faible_quand_la_journee_ressemble_a_l_habitude(conn):
    maintenant = 1_700_000_000.0
    _compartiment(conn, "pont")
    for nom in ("testeur", "compagnon"):
        _crew(conn, nom)

    for j in range(1, 7):
        debut = maintenant - j * anomalie.JOUR_S
        _presence(conn, "testeur", "pont", debut + 3600, debut + 3600 + 3 * 3600)
        _presence(conn, "compagnon", "pont", debut + 3600, debut + 3600 + 3 * 3600)
    conn.commit()

    resultat = anomalie.ecart(conn, "testeur", maintenant=maintenant)

    assert resultat["anormal"] is False
    assert resultat["distance"] == 0.0


def test_anomalie_ecart_journee_trop_courte_n_est_pas_jugee(conn):
    maintenant = 1_700_000_000.0
    _compartiment(conn, "pont")
    _crew(conn, "testeur")
    _crew(conn, "compagnon")

    for j in range(2, 7):
        debut = maintenant - j * anomalie.JOUR_S
        _presence(conn, "testeur", "pont", debut + 3600, debut + 3600 + 3 * 3600)
        _presence(conn, "compagnon", "pont", debut + 3600, debut + 3600 + 3 * 3600)

    debut_courant = maintenant - anomalie.JOUR_S
    _presence(conn, "testeur", "pont", debut_courant + 3600, debut_courant + 3600 + 600)
    conn.commit()

    resultat = anomalie.ecart(conn, "testeur", maintenant=maintenant)

    assert resultat["distance"] is None
    assert resultat["anormal"] is False
    assert "pas assez" in resultat["motif"]


def test_anomalie_ecart_rend_none_sans_assez_de_jours_de_reference(conn):
    maintenant = 1_700_000_000.0
    _compartiment(conn, "pont")
    _crew(conn, "testeur")
    _crew(conn, "compagnon")

    debut_courant = maintenant - anomalie.JOUR_S
    _presence(conn, "testeur", "pont", debut_courant + 3600, debut_courant + 3600 + 3 * 3600)
    _presence(conn, "compagnon", "pont", debut_courant + 3600, debut_courant + 3600 + 3 * 3600)
    conn.commit()

    assert anomalie.ecart(conn, "testeur", maintenant=maintenant) is None


@pytest.mark.xfail(strict=True, reason=(
    "anomalie.profil() construit ses six 'jours de reference' avec"
    " j allant de 6 a 1, et le jour j=1 est exactement la fenetre"
    " [maintenant-JOUR_S, maintenant], c'est-a-dire la meme fenetre que"
    " 'courant'. Le jour en cours est donc toujours l'un de ses propres"
    " jours de reference. Consequence mesuree : si les 5 autres jours"
    " sont parfaitement identiques, la distance ne peut jamais depasser"
    " sqrt(5) ~= 2.236, meme pour une journee absurdement anormale, donc"
    " un cas isole ne peut jamais franchir SEUIL_ANOMALIE = 2.5."))
def test_anomalie_ecart_detecte_un_isolement_extreme_et_inedit(conn):
    maintenant = 1_700_000_000.0
    for i, nom in enumerate(
            ("pont", "serre", "atelier", "laboratoire", "infirmerie", "reacteur")):
        conn.execute("INSERT INTO compartiment (nom, ordre) VALUES (?,?)", (nom, i))
    for nom in ("testeur", "compagnon"):
        _crew(conn, nom)

    for j in range(2, 7):
        debut = maintenant - j * anomalie.JOUR_S
        _presence(conn, "testeur", "pont", debut + 3600, debut + 3600 + 3 * 3600)
        _presence(conn, "compagnon", "pont", debut + 3600, debut + 3600 + 3 * 3600)

    debut_courant = maintenant - anomalie.JOUR_S
    t = debut_courant + 3600
    for compartiment in ("pont", "serre", "atelier", "laboratoire", "infirmerie", "reacteur"):
        _presence(conn, "testeur", compartiment, t, t + 20 * 3600)
        t += 20 * 3600
    conn.commit()

    resultat = anomalie.ecart(conn, "testeur", maintenant=maintenant)

    assert resultat["anormal"] is True
