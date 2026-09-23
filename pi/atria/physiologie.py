"""Physiologie simulée de l'équipage : d'où vient la capacité cognitive.

Le premier jeu de données du bord posait la capacité comme une droite par personne, puis
en déduisait tout le reste : le sommeil valait 2.5 plus six fois la capacité, le stress
valait un moins la capacité, la variabilité cardiaque suivait la même règle. Ces trois
mesures étaient donc des copies de la capacité, et un modèle entraîné dessus ne pouvait
rien apprendre de plus que ce que la capacité disait déjà. L'étude d'ablation l'a montré
sans ambiguïté : la capacité seule faisait mieux que la capacité accompagnée des six
autres variables.

Ce module renverse la dépendance, dans le sens où la physiologie la pose. Le sommeil de
chaque nuit varie, sa dette s'accumule, le stress suit sa propre marche aléatoire, et la
capacité du lendemain se déduit de ces deux-là plus les incidents de la veille. Les
mesures redeviennent des causes plutôt que des reflets, et prédire devient un vrai
problème.

Ce qui est simulé doit être dit comme tel : cette physiologie est un modèle plausible, pas
une loi mesurée sur des humains. Ce qui n'est pas simulé, en revanche, c'est que le modèle
d'apprentissage ne voit que les traces et doit retrouver la règle tout seul, sur des
membres qu'il n'a jamais vus. C'est cela qu'on évalue.
"""

import math
import random
import time

SOMMEIL_CIBLE_H = 8.0
PAS_MINUTES = 60
HEURES = 48

POIDS_DETTE = 0.020
"""Perte de capacite par heure et par heure de dette de sommeil accumulee."""

POIDS_STRESS = 0.012
RECUPERATION = 0.035
"""Regain horaire vers le plafond personnel quand la dette est nulle et le stress bas."""

PLANCHER = 0.05
PLAFOND = 0.99


def _nuits(alea, jours):
    """Heures de sommeil par nuit. Certaines nuits sont mauvaises, et ça se paye après."""
    nuits = []
    for _ in range(jours + 1):
        if alea.random() < 0.25:
            nuits.append(alea.uniform(3.0, 5.5))
        else:
            nuits.append(alea.uniform(6.5, 8.5))
    return nuits


def trajectoire(alea, cible, heures=HEURES, pas_minutes=PAS_MINUTES):
    """Rejoue une trajectoire physiologique qui aboutit à la capacité voulue.

    La simulation avance dans le temps, puis l'ensemble est décalé pour que le dernier
    point tombe sur la capacité actuelle du membre. Décaler après coup préserve la forme
    de la trajectoire, qui est la seule chose qu'un modèle peut apprendre.
    """
    pas_h = pas_minutes / 60.0
    points = int(heures / pas_h)
    jours = int(heures / 24) + 1
    nuits = _nuits(alea, jours)

    plafond = min(PLAFOND, cible + alea.uniform(0.05, 0.25))
    capacite = plafond
    dette = 0.0
    stress = alea.uniform(0.15, 0.45)
    serie = []

    for k in range(points + 1):
        heure_du_jour = (k * pas_h) % 24
        jour = int(k * pas_h // 24)

        if 1.0 <= heure_du_jour < 2.0:
            sommeil = nuits[min(jour, len(nuits) - 1)]
            dette = max(0.0, dette + (SOMMEIL_CIBLE_H - sommeil))
        else:
            sommeil = nuits[min(jour, len(nuits) - 1)]

        stress = min(1.0, max(0.0, stress + alea.gauss(0, 0.05)
                              + 0.01 * min(dette, 6.0)))

        usure = POIDS_DETTE * min(dette, 8.0) + POIDS_STRESS * stress * 4.0
        regain = RECUPERATION * (plafond - capacite)
        capacite = min(plafond, max(PLANCHER,
                                    capacite - usure * pas_h + regain * pas_h
                                    + alea.gauss(0, 0.006)))

        # La recuperation nocturne efface une partie de la dette.
        if 2.0 <= heure_du_jour < 3.0:
            dette = max(0.0, dette - 1.5)

        serie.append({
            "capacite": capacite,
            "sommeil_h": round(sommeil, 1),
            "dette_h": round(dette, 2),
            "stress": round(stress, 3),
        })

    decalage = cible - serie[-1]["capacite"]
    for point in serie:
        point["capacite"] = round(min(PLAFOND, max(PLANCHER,
                                                   point["capacite"] + decalage)), 3)
    return serie


def regenerer(conn, graine=20260923):
    """Réécrit l'historique physiologique de l'équipage, en gardant les valeurs actuelles.

    Le dernier point de chaque membre est conservé tel quel : le tableau de bord, les
    seuils de poste et les refus en cours ne bougent pas. Seul le chemin qui mène à cette
    valeur est reconstruit, et c'est lui que le modèle apprend.
    """
    alea = random.Random(graine)
    maintenant = time.time()
    pas = PAS_MINUTES * 60
    refaits = 0

    for r in conn.execute(
            "SELECT nom FROM crew WHERE statut != 'commandement' ORDER BY nom"):
        nom = r["nom"]
        dernier = conn.execute(
            "SELECT cognitive FROM capacite WHERE crew = ? AND (source IS NULL"
            " OR source = 'seed') ORDER BY ts DESC LIMIT 1", (nom,)).fetchone()
        if dernier is None:
            continue
        cible = dernier["cognitive"]

        serie = trajectoire(alea, cible)
        conn.execute("DELETE FROM capacite WHERE crew = ? AND (source IS NULL"
                     " OR source = 'seed')", (nom,))
        conn.execute("DELETE FROM vitals WHERE crew = ?", (nom,))

        for i, point in enumerate(serie):
            ts = maintenant - (len(serie) - 1 - i) * pas
            conn.execute(
                "INSERT OR REPLACE INTO capacite (crew, ts, cognitive, fatigue,"
                " sommeil_h, dette_sociale, source) VALUES (?,?,?,?,?,?,?)",
                (nom, ts, point["capacite"], round(1 - point["capacite"], 3),
                 point["sommeil_h"], int(point["dette_h"]), "seed"))

            hr = int(58 + point["stress"] * 34 + alea.gauss(0, 3))
            rmssd = max(8.0, 55 - point["stress"] * 34 + alea.gauss(0, 4))
            conn.execute(
                "INSERT OR REPLACE INTO vitals (crew, ts, hr, rmssd, sdnn, stress)"
                " VALUES (?,?,?,?,?,?)",
                (nom, ts, hr, round(rmssd, 1), round(rmssd * 1.4, 1), point["stress"]))
        refaits += 1

    conn.commit()
    return refaits
