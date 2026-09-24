"""Anomalie comportementale : chacun est comparé à lui-même, pas à l'équipage.

Un équipage de vingt-quatre personnes n'a pas de comportement normal commun. Le mécanicien
passe ses journées au réacteur, la biologiste dans la serre, quelqu'un parle beaucoup,
quelqu'un ne parle jamais. Noter tout le monde sur une même échelle reviendrait à signaler
les gens atypiques plutôt que les gens qui changent.

Chaque membre sert donc de référence à lui-même. On décrit sa journée par quatre grandeurs
lues dans les présences, on estime la dispersion habituelle de chacune sur les jours
précédents, et on mesure à quelle distance la journée en cours se trouve de cette habitude.
Rien n'est annoté, rien n'est supervisé : on mesure un écart à soi.

Ce que ça attrape, et que rien d'autre ici n'attrape : quelqu'un qui commence à éviter son
groupe, à changer de compartiment, à s'isoler, avant tout incident et sans jamais franchir
un seuil.
"""

import time

import numpy as np

from . import db

JOURS_REFERENCE = 6
FENETRE_S = (JOURS_REFERENCE + 1) * 86400.0
JOUR_S = 86400.0
PRESENCE_MIN_H = 1.0
"""Sous une heure de présence enregistrée, la journée n'est pas décrite, elle est vide.
La signaler comme anormale dirait seulement que le capteur n'a rien vu."""

SEUIL_ANOMALIE = 2.5
"""Écart au-delà duquel la journée s'écarte franchement de l'habitude du membre."""

VARIABLES = (
    ("heures", "heures de présence"),
    ("compartiments", "compartiments fréquentés"),
    ("cotoyees", "personnes côtoyées"),
    ("solitude", "part du temps passée seul"),
)


def _presences(conn, depuis, jusqu):
    return [dict(r) for r in conn.execute(
        "SELECT crew, compartiment, entree, COALESCE(sortie, ?) AS sortie FROM presence"
        " WHERE entree < ? AND COALESCE(sortie, ?) > ? ORDER BY entree",
        (jusqu, jusqu, jusqu, depuis))]


def _decrire(lignes, crew, debut, fin):
    """Les quatre variables d'un membre sur une tranche de temps.

    Les personnes côtoyées et le temps passé seul se calculent par recouvrement réel des
    présences, tranche par tranche. Les compter sur toute la fenêtre en donnait une valeur
    constante par membre, donc une variable sans variance, qui ne pouvait rien détecter.
    """
    siennes = [l for l in lignes if l["crew"] == crew]
    if not siennes:
        return None

    secondes = 0.0
    lieux = set()
    partagees = 0.0
    cotoyees = set()

    for l in siennes:
        a = max(l["entree"], debut)
        b = min(l["sortie"], fin)
        if b <= a:
            continue
        secondes += b - a
        lieux.add(l["compartiment"])

        for autre in lignes:
            if autre["crew"] == crew or autre["compartiment"] != l["compartiment"]:
                continue
            c = max(autre["entree"], a)
            d = min(autre["sortie"], b)
            if d > c:
                partagees += d - c
                cotoyees.add(autre["crew"])

    if secondes <= 0:
        return None
    seul = max(0.0, secondes - min(secondes, partagees)) / secondes
    return [secondes / 3600.0, float(len(lieux)), float(len(cotoyees)), seul]


def profil(conn, crew, maintenant=None):
    """Habitude du membre sur les jours précédents, et sa journée en cours."""
    maintenant = maintenant or time.time()
    lignes = _presences(conn, maintenant - FENETRE_S, maintenant)
    if not lignes:
        return None

    reference = []
    for j in range(JOURS_REFERENCE, 0, -1):
        debut = maintenant - j * JOUR_S
        v = _decrire(lignes, crew, debut, debut + JOUR_S)
        if v and v[0] >= PRESENCE_MIN_H:
            reference.append(v)

    courant = _decrire(lignes, crew, maintenant - JOUR_S, maintenant)
    if len(reference) < 3 or courant is None:
        return None
    if courant[0] < PRESENCE_MIN_H:
        return {"insuffisant": True, "heures": round(courant[0], 2),
                "journees": len(reference)}

    X = np.array(reference, dtype=float)
    return {
        "moyenne": X.mean(axis=0),
        "ecart": np.maximum(X.std(axis=0), 0.25),
        "journees": len(reference),
        "courant": np.array(courant, dtype=float),
    }


def ecart(conn, crew, maintenant=None):
    """Distance de la journée en cours à l'habitude du membre, variable par variable."""
    p = profil(conn, crew, maintenant)
    if p is None:
        return None
    if p.get("insuffisant"):
        return {"crew": crew, "distance": None, "anormal": False,
                "motif": f"{p['heures']} h de présence aujourd'hui, pas assez pour juger",
                "journees_observees": p["journees"], "axes": []}

    z = (p["courant"] - p["moyenne"]) / p["ecart"]
    distance = float(np.sqrt(np.sum(z ** 2) / len(z)))

    axes = sorted(
        ({"variable": VARIABLES[i][0], "libelle": VARIABLES[i][1],
          "ecart": round(float(z[i]), 2),
          "valeur": round(float(p["courant"][i]), 2),
          "habitude": round(float(p["moyenne"][i]), 2)}
         for i in range(len(z))),
        key=lambda a: -abs(a["ecart"]))

    return {
        "crew": crew,
        "distance": round(distance, 2),
        "anormal": distance >= SEUIL_ANOMALIE,
        "motif": None,
        "journees_observees": p["journees"],
        "axes": axes,
    }


def ecarts(conn, etat):
    """Écart de chaque membre à sa propre habitude, du plus marqué au moins marqué."""
    maintenant = time.time()
    sorties = []
    for membre in etat.equipage:
        e = ecart(conn, membre.nom, maintenant)
        if e is None:
            continue
        e["role"] = membre.role
        e["capacite"] = round(membre.cognitive, 3)
        e["conduite"] = round(db.conduite(conn, membre.nom), 3)
        sorties.append(e)
    sorties.sort(key=lambda s: -(s["distance"] or 0))
    return sorties
