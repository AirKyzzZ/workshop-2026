"""Enrôlement et contrôle des gabarits faciaux.

    python -m atria.enroler ajouter maxime
    python -m atria.enroler verifier maxime
    python -m atria.enroler comparer maxime melih
    python -m atria.enroler liste
    python -m atria.enroler oublier melih
"""

import sys
import time

from . import db, visage


def ajouter(conn, nom):
    if conn.execute("SELECT 1 FROM crew WHERE nom = ?", (nom,)).fetchone() is None:
        print(f"{nom} ne figure pas au registre d'équipage.")
        return 1

    print(f"Enrôlement de {nom}. Regardez la caméra, bougez légèrement la tête "
          f"entre chaque prise.")
    pris = 0
    with visage.Camera() as camera:
        while pris < visage.GABARITS_PAR_MEMBRE:
            print(f"  prise {pris + 1}/{visage.GABARITS_PAR_MEMBRE} dans 2 s...", flush=True)
            time.sleep(2)
            empreinte, surface = visage.capturer_empreinte(camera)
            if empreinte is None:
                print("  aucun visage détecté, on recommence")
                continue
            db.enregistrer_gabarit(conn, nom, empreinte)
            pris += 1
            print(f"  gabarit {pris} enregistré, surface {surface} px")

    db.journaliser(conn, "biometrie", f"{pris} gabarits faciaux enrôlés",
                   acteur="systeme", sujet=nom)
    print(f"{nom} : {len(db.gabarits(conn, nom))} gabarits en base.")
    return 0


def verifier(conn, nom):
    gabarits = db.gabarits(conn, nom)
    if not gabarits:
        print(f"{nom} n'a aucun gabarit enrôlé.")
        return 1

    with visage.Camera() as camera:
        empreinte, surface = visage.capturer_empreinte(camera)

    if empreinte is None:
        print("Aucun visage détecté.")
        return 1

    score = visage.comparer(empreinte, gabarits)
    accepte = score >= visage.SEUIL_COSINUS
    print(f"{nom} : similarité {score:.3f} (seuil {visage.SEUIL_COSINUS}), "
          f"surface {surface} px -> {'ACCEPTE' if accepte else 'REFUSE'}")
    return 0 if accepte else 2


def comparer(conn, a, b):
    """Mesure la marge entre deux personnes enrôlées, pour régler le seuil."""
    ga, gb = db.gabarits(conn, a), db.gabarits(conn, b)
    if not ga or not gb:
        print("Les deux membres doivent être enrôlés.")
        return 1

    interne_a = max(visage.similarite(x, y) for i, x in enumerate(ga)
                    for y in ga[i + 1:]) if len(ga) > 1 else float("nan")
    interne_b = max(visage.similarite(x, y) for i, x in enumerate(gb)
                    for y in gb[i + 1:]) if len(gb) > 1 else float("nan")
    croise = max(visage.similarite(x, y) for x in ga for y in gb)

    print(f"{a} contre lui-même : {interne_a:.3f}")
    print(f"{b} contre lui-même : {interne_b:.3f}")
    print(f"{a} contre {b}      : {croise:.3f}")
    print(f"seuil                : {visage.SEUIL_COSINUS}")
    print("marge" if croise < visage.SEUIL_COSINUS else "COLLISION",
          f": {visage.SEUIL_COSINUS - croise:+.3f}")
    return 0


def liste(conn):
    enroles = db.membres_enroles(conn)
    if not enroles:
        print("Aucun gabarit enrôlé.")
        return 0
    for nom, n in enroles:
        badge = conn.execute("SELECT badge FROM crew WHERE nom = ?", (nom,)).fetchone()
        print(f"{nom:12} {n} gabarits   badge {badge['badge'] or 'aucun'}")
    return 0


def oublier(conn, nom):
    n = db.oublier_gabarits(conn, nom)
    db.journaliser(conn, "biometrie", f"{n} gabarits faciaux effaces",
                   acteur="systeme", sujet=nom)
    print(f"{n} gabarits supprimés pour {nom}.")
    return 0


def main(argv):
    if not visage.disponible():
        print(f"Modèles absents de {visage.MODELES}.")
        return 1

    conn = db.connexion()
    commande = argv[1] if len(argv) > 1 else "liste"

    if commande == "ajouter" and len(argv) > 2:
        return ajouter(conn, argv[2])
    if commande == "verifier" and len(argv) > 2:
        return verifier(conn, argv[2])
    if commande == "comparer" and len(argv) > 3:
        return comparer(conn, argv[2], argv[3])
    if commande == "oublier" and len(argv) > 2:
        return oublier(conn, argv[2])
    if commande == "liste":
        return liste(conn)

    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
