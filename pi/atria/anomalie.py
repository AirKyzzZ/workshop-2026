"""Anomalie comportementale : chacun est comparé à lui-même, pas à l'équipage.

Un équipage de vingt-quatre personnes n'a pas de comportement normal commun. Le mécanicien
passe ses journées au réacteur, la biologiste dans la serre, quelqu'un parle beaucoup,
quelqu'un ne parle jamais. Noter tout le monde sur une même échelle reviendrait à signaler
les gens atypiques plutôt que les gens qui changent.

Chaque membre sert donc de référence à lui-même. On décrit son comportement par quelques
grandeurs mesurées sur sept jours, on estime la dispersion habituelle de chacune, et on
mesure à quelle distance la journée en cours se trouve de cette habitude. C'est une
distance de Mahalanobis à une seule personne, et elle ne demande aucune étiquette : rien
n'est annoté, rien n'est supervisé, on mesure un écart à soi.

Ce que ça attrape, et que rien d'autre ici n'attrape : quelqu'un qui commence à éviter son
groupe, à changer de compartiment, à se taire, avant tout incident et sans jamais
enfreindre un seuil.
"""

import time

import numpy as np

from . import db, social

FENETRE_S = 7 * 86400.0
JOUR_S = 86400.0
SEUIL_ANOMALIE = 2.5
"""Distance à partir de laquelle le comportement du jour s'écarte franchement de
l'habitude du membre. Sous une loi normale à quatre dimensions, on est déjà loin dans la
queue de la distribution."""

VARIABLES = (
    ("heures_presence", "heures de présence enregistrées"),
    ("compartiments", "compartiments fréquentés"),
    ("compagnie", "personnes côtoyées"),
    ("solitude", "part du temps passée seul"),
)


def _journees(conn, crew, fin=None):
    """Découpe l'historique de présence du membre en journées décrites par ses variables."""
    fin = fin or time.time()
    debut = fin - FENETRE_S
    lignes = [dict(r) for r in conn.execute(
        "SELECT compartiment, entree, COALESCE(sortie, ?) AS sortie FROM presence"
        " WHERE crew = ? AND entree >= ? ORDER BY entree", (fin, crew, debut))]
    if not lignes:
        return []

    partage, _ = social.co_presences(conn, debut)
    voisins = {}
    for (a, b), secondes in partage.items():
        if a == crew:
            voisins[b] = secondes
        elif b == crew:
            voisins[a] = secondes

    journees = {}
    for l in lignes:
        jour = int(l["entree"] // JOUR_S)
        d = journees.setdefault(jour, {"secondes": 0.0, "lieux": set()})
        d["secondes"] += max(0.0, l["sortie"] - l["entree"])
        d["lieux"].add(l["compartiment"])

    compagnie = len(voisins)
    partage_total = sum(voisins.values())

    sorties = []
    for jour in sorted(journees):
        d = journees[jour]
        seul = max(0.0, d["secondes"] - partage_total / max(1, len(journees)))
        sorties.append({
            "jour": jour,
            "variables": [
                d["secondes"] / 3600.0,
                float(len(d["lieux"])),
                float(compagnie),
                seul / max(1.0, d["secondes"]),
            ],
        })
    return sorties


def profil(conn, crew):
    """Habitude du membre : moyenne et dispersion de ses variables sur la fenêtre."""
    journees = _journees(conn, crew)
    if len(journees) < 3:
        return None
    X = np.array([j["variables"] for j in journees], dtype=float)
    reference = X[:-1] if len(X) > 3 else X
    return {
        "moyenne": reference.mean(axis=0),
        "ecart": np.maximum(reference.std(axis=0), 0.15),
        "journees": len(journees),
        "dernier": X[-1],
    }


def ecart(conn, crew):
    """Distance de la journée en cours à l'habitude du membre, variable par variable."""
    p = profil(conn, crew)
    if p is None:
        return None

    z = (p["dernier"] - p["moyenne"]) / p["ecart"]
    distance = float(np.sqrt(np.sum(z ** 2)))

    axes = sorted(
        ({"variable": VARIABLES[i][0], "libelle": VARIABLES[i][1],
          "ecart": round(float(z[i]), 2),
          "valeur": round(float(p["dernier"][i]), 2),
          "habitude": round(float(p["moyenne"][i]), 2)}
         for i in range(len(z))),
        key=lambda a: -abs(a["ecart"]))

    return {
        "crew": crew,
        "distance": round(distance, 2),
        "anormal": distance >= SEUIL_ANOMALIE,
        "journees_observees": p["journees"],
        "axes": axes,
    }


def ecarts(conn, etat):
    """Écart de chaque membre à sa propre habitude, du plus marqué au moins marqué."""
    sorties = []
    for membre in etat.equipage:
        e = ecart(conn, membre.nom)
        if e is None:
            continue
        e["role"] = membre.role
        e["capacite"] = round(membre.cognitive, 3)
        e["conduite"] = round(db.conduite(conn, membre.nom), 3)
        sorties.append(e)
    sorties.sort(key=lambda s: -s["distance"])
    return sorties
