"""Prédiction de rupture d'aptitude : un modèle entraîné sur les données du bord.

La question posée est simple et datée : ce membre passera-t-il sous le seuil d'aptitude
dans les six heures ? Le régulateur sait déjà refuser un poste à quelqu'un qui est
au-dessous ; ici on cherche à le voir venir pendant qu'il est encore au-dessus.

C'est une régression logistique, écrite ici plutôt qu'importée. Deux raisons. La carte est
déjà fragile et n'a pas besoin d'une dépendance de plus. Et surtout, une régression
logistique donne un poids par variable, donc chaque prédiction peut être décomposée en
contributions lisibles : ATRIA ne dit pas « risque 0.78 », elle dit quelles mesures ont
fait monter ce chiffre. Un modèle qu'on ne peut pas interroger n'a rien à faire dans une
boucle de décision qui touche des gens.

La droiture des chiffres compte plus que leur valeur : les métriques sont calculées sur
des membres que l'entraînement n'a jamais vus, et non sur un découpage au hasard des
lignes. Découper au hasard laisserait le même membre des deux côtés, et le modèle serait
noté sur des gens qu'il connaît déjà.
"""

import json
import os
import time

import numpy as np

from . import db

MODELE = os.path.expanduser("~/atria/models/aptitude.json")

HORIZON_S = 6 * 3600.0
SEUIL_APTITUDE = 0.60

VARIABLES = (
    ("capacite", "capacité actuelle"),
    ("pente_6h", "pente sur 6 heures"),
    ("sommeil", "sommeil de la nuit"),
    ("dette_sommeil", "dette de sommeil"),
)
"""Quatre variables retenues sur sept candidates, et le tri s'est fait par validation
croisee groupee par membre plutot qu'au jugé.

La variabilite cardiaque, le stress et le score de conduite ont ete ecartes parce qu'ils
faisaient redescendre l'aire sous la courbe : 0.962 avec ces quatre variables, 0.957 avec
les sept. Le stress et la conduite ne correlaient qu'a 0.085 et 0.052 avec l'evenement a
predire, mais a 0.133 et 0.302 avec la capacite, et servaient donc surtout de variables de
suppression : leur poids etait grand, de signe contre-intuitif, et ne portait aucune
information propre.

Une variable qui ne gagne pas sa place ne reste pas. Elle degraderait la prediction et,
plus grave pour un systeme qui doit s'expliquer, elle brouillerait la decomposition des
contributions."""

ABLATION = (
    ("capacité seule", [0]),
    ("+ pente sur 6 heures", [0, 1]),
    ("+ sommeil de la nuit", [0, 1, 2]),
    ("+ dette de sommeil", [0, 1, 2, 3]),
)


def _serie(conn, crew):
    return [dict(r) for r in conn.execute(
        "SELECT ts, cognitive, sommeil_h, dette_sociale FROM capacite"
        " WHERE crew = ? AND (source IS NULL OR source = 'seed') ORDER BY ts", (crew,))]


def _vitaux(conn, crew):
    return [dict(r) for r in conn.execute(
        "SELECT ts, rmssd, stress FROM vitals WHERE crew = ? ORDER BY ts", (crew,))]


def _proche(serie, ts):
    """Dernière mesure connue avant ts. Aucune mesure future ne doit entrer ici."""
    candidat = None
    for r in serie:
        if r["ts"] <= ts:
            candidat = r
        else:
            break
    return candidat


def exemples(conn, crew):
    """Construit les couples (variables, étiquette) d'un membre.

    L'étiquette regarde devant, les variables uniquement derrière : c'est la seule façon
    d'éviter qu'une information du futur ne fuite dans l'entraînement et ne gonfle les
    métriques.
    """
    serie = _serie(conn, crew)
    if len(serie) < 10:
        return [], []

    lignes, etiquettes = [], []

    for i, point in enumerate(serie):
        ts = point["ts"]
        suite = [p for p in serie[i + 1:] if p["ts"] <= ts + HORIZON_S]
        if not suite:
            continue
        if point["cognitive"] < SEUIL_APTITUDE:
            continue

        passe = [p for p in serie[:i + 1] if p["ts"] >= ts - HORIZON_S]
        if len(passe) >= 3:
            x = np.array([p["ts"] for p in passe])
            y = np.array([p["cognitive"] for p in passe])
            pente = float(np.polyfit((x - x[0]) / 3600.0, y, 1)[0])
        else:
            pente = 0.0

        lignes.append([
            point["cognitive"],
            pente,
            (point["sommeil_h"] or 0.0) / 8.0,
            (point["dette_sociale"] or 0) / 8.0,
        ])
        etiquettes.append(1 if any(p["cognitive"] < SEUIL_APTITUDE for p in suite) else 0)

    return lignes, etiquettes


def rassembler(conn):
    """Rend (X, y, groupes) où groupes porte le nom du membre de chaque ligne."""
    X, y, groupes = [], [], []
    for r in conn.execute("SELECT nom FROM crew WHERE statut != 'commandement'"):
        lignes, etiquettes = exemples(conn, r["nom"])
        X.extend(lignes)
        y.extend(etiquettes)
        groupes.extend([r["nom"]] * len(lignes))
    return np.array(X, dtype=float), np.array(y, dtype=float), groupes


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def entrainer(X, y, pas=0.35, iterations=4000, regularisation=1e-3):
    """Descente de gradient sur la vraisemblance, avec pénalité L2.

    Les classes sont déséquilibrées : les ruptures sont rares, et un modèle qui répond
    toujours « pas de rupture » aurait déjà raison la plupart du temps. Chaque classe est
    donc pondérée par l'inverse de sa fréquence, sans quoi le modèle apprend à se taire.
    """
    moyenne = X.mean(axis=0)
    ecart = X.std(axis=0)
    ecart[ecart < 1e-9] = 1.0
    Z = (X - moyenne) / ecart
    Z = np.hstack([Z, np.ones((len(Z), 1))])

    positifs = max(1.0, y.sum())
    negatifs = max(1.0, len(y) - y.sum())
    poids = np.where(y > 0.5, len(y) / (2 * positifs), len(y) / (2 * negatifs))

    theta = np.zeros(Z.shape[1])
    for _ in range(iterations):
        p = _sigmoide(Z @ theta)
        gradient = Z.T @ (poids * (p - y)) / len(y)
        gradient[:-1] += regularisation * theta[:-1]
        theta -= pas * gradient

    return {"theta": theta.tolist(), "moyenne": moyenne.tolist(),
            "ecart": ecart.tolist()}


def predire(modele, lignes):
    theta = np.array(modele["theta"])
    moyenne = np.array(modele["moyenne"])
    ecart = np.array(modele["ecart"])
    Z = (np.array(lignes, dtype=float) - moyenne) / ecart
    Z = np.hstack([Z, np.ones((len(Z), 1))])
    return _sigmoide(Z @ theta)


def contributions(modele, ligne):
    """Décompose une prédiction en apport de chaque variable, en unités de log-cote."""
    theta = np.array(modele["theta"])
    moyenne = np.array(modele["moyenne"])
    ecart = np.array(modele["ecart"])
    z = (np.array(ligne, dtype=float) - moyenne) / ecart
    apports = theta[:-1] * z
    return sorted(
        ({"variable": VARIABLES[i][0], "libelle": VARIABLES[i][1],
          "apport": round(float(apports[i]), 3), "valeur": round(float(ligne[i]), 3)}
         for i in range(len(apports))),
        key=lambda a: -abs(a["apport"]))


def _auc(y, p):
    """Aire sous la courbe ROC, par comptage de paires concordantes."""
    positifs = p[y > 0.5]
    negatifs = p[y < 0.5]
    if not len(positifs) or not len(negatifs):
        return None
    comparaisons = positifs[:, None] - negatifs[None, :]
    return float((np.sum(comparaisons > 0) + 0.5 * np.sum(comparaisons == 0))
                 / (len(positifs) * len(negatifs)))


def evaluer(y, p, seuil=0.5):
    predit = (p >= seuil).astype(float)
    vp = float(np.sum((predit == 1) & (y == 1)))
    fp = float(np.sum((predit == 1) & (y == 0)))
    vn = float(np.sum((predit == 0) & (y == 0)))
    fn = float(np.sum((predit == 0) & (y == 1)))
    return {
        "vrais_positifs": vp, "faux_positifs": fp,
        "vrais_negatifs": vn, "faux_negatifs": fn,
        "precision": round(vp / (vp + fp), 3) if vp + fp else None,
        "rappel": round(vp / (vp + fn), 3) if vp + fn else None,
        "exactitude": round((vp + vn) / len(y), 3) if len(y) else None,
        "auc": None if _auc(y, p) is None else round(_auc(y, p), 3),
    }


def valider(conn, plis=5):
    """Entraîne et évalue par validation croisée groupée par membre.

    Un découpage unique laissait le lot de test sans aucune rupture : avec trente et une
    ruptures réparties sur dix-sept membres, tirer cinq membres au hasard peut n'en
    attraper aucune, et la métrique ne veut alors plus rien dire. Chaque membre passe donc
    une fois par le lot de test, et les prédictions retenues sont toujours celles d'un
    modèle qui n'avait jamais vu ce membre.
    """
    X, y, groupes = rassembler(conn)
    if len(X) < 50:
        return None

    membres = sorted(set(groupes))
    alea = np.random.default_rng(20260923)
    alea.shuffle(membres)
    paquets = [set(membres[i::plis]) for i in range(plis)]

    retenues = np.zeros(len(y))
    evalue = np.zeros(len(y), dtype=bool)
    for paquet in paquets:
        masque = np.array([g in paquet for g in groupes])
        if masque.all() or not masque.any():
            continue
        partiel = entrainer(X[~masque], y[~masque])
        retenues[masque] = predire(partiel, X[masque])
        evalue[masque] = True

    if not evalue.any():
        return None

    mesures = evaluer(y[evalue], retenues[evalue])
    mesures.update({
        "plis": plis,
        "membres": len(membres),
        "lignes_evaluees": int(evalue.sum()),
        "ruptures_evaluees": int(y[evalue].sum()),
    })

    final = entrainer(X, y)
    final.update({
        "variables": [v[0] for v in VARIABLES],
        "libelles": [v[1] for v in VARIABLES],
        "horizon_h": HORIZON_S / 3600,
        "seuil_aptitude": SEUIL_APTITUDE,
        "mesures": mesures,
        "entraine_le": time.time(),
        "lignes": len(X),
        "ruptures": int(y.sum()),
    })
    return final


def ablation(conn, plis=5):
    """Ce que chaque variable ajoute, mesure une par une.

    Une aire sous la courbe seule ne dit pas d'ou elle vient. Quelqu'un a 0.61 tombera sous
    0.60 plus souvent que quelqu'un a 0.95, et un modele qui n'aurait appris que cela
    afficherait deja un bon score. Mesurer l'apport de chaque variable est le seul moyen de
    savoir si le modele apprend quelque chose ou s'il recopie une evidence.
    """
    X, y, groupes = rassembler(conn)
    if len(X) < 50:
        return None

    membres = sorted(set(groupes))
    alea = np.random.default_rng(20260923)
    alea.shuffle(membres)
    paquets = [set(membres[i::plis]) for i in range(plis)]

    sorties = []
    for libelle, colonnes in ABLATION:
        sous = X[:, colonnes]
        retenues = np.zeros(len(y))
        evalue = np.zeros(len(y), dtype=bool)
        for paquet in paquets:
            masque = np.array([g in paquet for g in groupes])
            if masque.all() or not masque.any():
                continue
            partiel = entrainer(sous[~masque], y[~masque])
            retenues[masque] = predire(partiel, sous[masque])
            evalue[masque] = True
        mesures = evaluer(y[evalue], retenues[evalue])
        sorties.append({"jeu": libelle, "variables": len(colonnes),
                        "auc": mesures["auc"], "rappel": mesures["rappel"],
                        "precision": mesures["precision"]})
    return sorties


def sauver(modele, chemin=MODELE):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(modele, f, ensure_ascii=False)


def charger(chemin=MODELE):
    try:
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def variables_courantes(conn, crew, etat):
    """Variables d'un membre à l'instant présent, dans l'ordre d'entraînement."""
    membre = etat.membre(crew)
    if membre is None:
        return None
    serie = _serie(conn, crew)
    if not serie:
        return None

    maintenant = time.time()
    passe = [p for p in serie if p["ts"] >= maintenant - HORIZON_S]
    if len(passe) >= 3:
        x = np.array([p["ts"] for p in passe])
        y = np.array([p["cognitive"] for p in passe])
        pente = float(np.polyfit((x - x[0]) / 3600.0, y, 1)[0])
    else:
        pente = 0.0

    return [
        membre.cognitive,
        pente,
        (membre.sommeil_h or 0.0) / 8.0,
        (membre.dette_sociale or 0) / 8.0,
    ]


def risques(conn, etat, modele=None):
    """Risque de rupture d'aptitude de chaque membre, avec sa décomposition."""
    modele = modele or charger()
    if modele is None:
        return []

    lignes, noms, deja = [], [], []
    for membre in etat.equipage:
        # Le modele n'a appris que sur des membres au-dessus du seuil : lui demander si
        # quelqu'un a 0.34 va descendre sous 0.60 revient a l'interroger hors de son
        # domaine, et il repondait 1.00 avec une contribution de +15, tres loin de tout ce
        # qu'il a vu. Un membre deja sous le seuil releve du regulateur, pas de la
        # prediction.
        if membre.cognitive < SEUIL_APTITUDE:
            deja.append({"crew": membre.nom, "role": membre.role,
                         "capacite": round(membre.cognitive, 3),
                         "risque": None, "deja_sous_seuil": True,
                         "contributions": []})
            continue
        v = variables_courantes(conn, membre.nom, etat)
        if v is None:
            continue
        lignes.append(v)
        noms.append(membre.nom)

    sorties = []
    if lignes:
        probabilites = predire(modele, lignes)
        for nom, ligne, p in zip(noms, lignes, probabilites):
            membre = etat.membre(nom)
            sorties.append({
                "crew": nom,
                "role": membre.role,
                "capacite": round(membre.cognitive, 3),
                "risque": round(float(p), 3),
                "deja_sous_seuil": False,
                "contributions": contributions(modele, ligne)[:4],
            })
        sorties.sort(key=lambda s: -s["risque"])
    return sorties + sorted(deja, key=lambda s: s["capacite"])
