"""Peuple une semaine de vie sociale à bord, pour que le graphe ait de la matière.

Les présences réelles ne couvrent que quelques heures : un graphe construit dessus
n'aurait ni assez d'arêtes ni assez de contraste pour se lire. On rejoue donc une semaine
de service plausible, avec des affinités et des inimitiés voulues, puis le graphe se
déduit de ces traces exactement comme il se déduira des vraies.

    python -m atria.seed_social
"""

import random
import sys
import time

from . import db

JOURS = 7
CRENEAUX_PAR_JOUR = 6
DUREE_CRENEAU_S = 3 * 3600

AFFINITES = [
    ("moreau", "martin"), ("moreau", "garcia"), ("martin", "garcia"),
    ("bernard", "rossi"), ("bernard", "mercier"), ("rossi", "mercier"),
    ("reyes", "lambert"), ("reyes", "dubois"), ("lambert", "dubois"),
    ("weber", "durand"), ("weber", "fontaine"), ("durand", "andre"),
    ("silva", "muller"), ("silva", "bianchi"), ("novak", "bianchi"),
]
"""Trios et paires qui se fréquentent. Ils dessinent les groupes du bord."""

INIMITIES = [("leroy", "blanc"), ("morel", "girard"), ("fournier", "roux")]
"""Paires qui travaillent ensemble mais se supportent mal. Les incidents suivront."""

ISOLES = ["lefebvre"]
"""Un membre que personne ne fréquente, pour que l'isolement se voie sur le graphe."""


def _equipage(conn):
    return [r["nom"] for r in conn.execute(
        "SELECT nom FROM crew WHERE statut != 'commandement' ORDER BY nom")]


def _compartiments(conn):
    return [r["nom"] for r in conn.execute("SELECT nom FROM compartiment ORDER BY nom")]


def peupler(conn, graine=20260923):
    alea = random.Random(graine)
    equipage = _equipage(conn)
    lieux = _compartiments(conn)
    if not equipage or not lieux:
        print("registre vide, rien à peupler")
        return 0

    conn.execute("DELETE FROM presence WHERE entree < ?", (time.time() - 600,))
    conn.commit()

    maintenant = time.time()
    debut = maintenant - JOURS * 86400
    groupes = [list(p) for p in AFFINITES]
    poses = 0
    incidents = 0

    for jour in range(JOURS):
        for creneau in range(CRENEAUX_PAR_JOUR):
            t0 = debut + jour * 86400 + creneau * (86400 / CRENEAUX_PAR_JOUR)
            t1 = t0 + DUREE_CRENEAU_S * alea.uniform(0.6, 1.0)
            if t1 > maintenant:
                continue

            restants = [m for m in equipage if m not in ISOLES]
            alea.shuffle(restants)
            occupes = set()

            # Les affinites se retrouvent dans le meme compartiment, souvent.
            for groupe in groupes:
                if alea.random() > 0.55:
                    continue
                lieu = alea.choice(lieux)
                for membre in groupe:
                    if membre in occupes or membre not in equipage:
                        continue
                    occupes.add(membre)
                    conn.execute(
                        "INSERT INTO presence (crew, compartiment, entree, sortie)"
                        " VALUES (?,?,?,?)",
                        (membre, lieu, t0 + alea.uniform(0, 600),
                         t1 - alea.uniform(0, 600)))
                    poses += 1

            # Les inimities partagent aussi un poste, et ca frotte.
            for un, deux in INIMITIES:
                if un in occupes or deux in occupes or alea.random() > 0.5:
                    continue
                lieu = alea.choice(lieux)
                for membre in (un, deux):
                    if membre not in equipage:
                        continue
                    occupes.add(membre)
                    conn.execute(
                        "INSERT INTO presence (crew, compartiment, entree, sortie)"
                        " VALUES (?,?,?,?)",
                        (membre, lieu, t0, t1))
                    poses += 1
                if alea.random() < 0.55 and un in equipage:
                    db.enregistrer_incident(
                        conn, un, "camera",
                        alea.choice(["hostilite", "poing_ferme", "doigt_honneur"]),
                        alea.uniform(0.15, 0.35),
                        "incident rejoue pour la demonstration")
                    conn.execute("UPDATE incident SET ts = ? WHERE id = last_insert_rowid()",
                                 (t0 + (t1 - t0) / 2,))
                    incidents += 1

            # Le reste de l'equipage se repartit au hasard.
            for membre in restants:
                if membre in occupes:
                    continue
                if alea.random() > 0.7:
                    continue
                conn.execute(
                    "INSERT INTO presence (crew, compartiment, entree, sortie)"
                    " VALUES (?,?,?,?)",
                    (membre, alea.choice(lieux), t0 + alea.uniform(0, 1800),
                     t1 - alea.uniform(0, 1800)))
                poses += 1

            # Les isoles passent, mais seuls et brievement.
            for membre in ISOLES:
                if membre in equipage and alea.random() < 0.3:
                    conn.execute(
                        "INSERT INTO presence (crew, compartiment, entree, sortie)"
                        " VALUES (?,?,?,?)",
                        (membre, alea.choice(lieux), t1 - 900, t1 - 300))
                    poses += 1

    conn.commit()
    return poses, incidents


def main():
    conn = db.connexion()
    poses, incidents = peupler(conn)
    db.journaliser(conn, "systeme",
                   f"{poses} presences et {incidents} incidents rejoues sur {JOURS} jours",
                   acteur="systeme")
    print(f"{poses} présences, {incidents} incidents, sur {JOURS} jours")

    from . import social
    g = social.graphe(conn)
    hostiles = [l for l in g["liens"] if l["nature"] == "hostile"]
    amicaux = [l for l in g["liens"] if l["nature"] == "amical"]
    print(f"graphe : {len(g['noeuds'])} membres, {len(g['liens'])} liens, "
          f"{len(amicaux)} amicaux, {len(hostiles)} hostiles")
    for l in hostiles[:5]:
        print(f"  hostile  {l['un']} / {l['deux']}  lien {l['lien']}  "
              f"{l['frictions']} frictions  {l['compartiment']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
