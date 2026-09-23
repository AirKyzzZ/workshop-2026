"""Remise en scène du bord avant une démonstration.

Une démonstration se rejoue plusieurs fois, et chaque passage laisse des traces : des
incidents filmés, des relevés de somnolence, un dossier de confinement ouvert, une toux
entendue. Au troisième essai l'équipage est à zéro de conduite et plus rien ne raconte
l'histoire qu'on voulait montrer.

Deux règles guident ce qui est effacé. Tout ce qu'un capteur a produit pendant les essais
disparaît, parce que c'est du bruit de répétition. L'historique de présence des sept
derniers jours reste intact, parce que c'est lui qui porte le graphe social, et qu'un
graphe reconstruit à chaque démonstration n'aurait plus ni affinités ni inimitiés.

L'équipage est ensuite réparti dans les compartiments. Ce n'est pas cosmétique : un
compartiment vide se scelle instantanément, sans ordre d'évacuation, et une toux entendue
dans une pièce déserte ne trace aucune chaîne de contact. Les deux scénarios les plus
parlants ont besoin de monde à l'intérieur.
"""

import time

from . import db

AFFECTATION = {
    "serre": ("moreau", "martin", "garcia"),
    "infirmerie": ("bernard", "rossi", "mercier"),
    "réacteur": ("weber", "durand"),
    "laboratoire": ("reyes", "lambert", "dubois"),
    "atelier": ("silva", "muller"),
    "pont": ("novak", "bianchi", "andre"),
}
"""Des trios qui se fréquentent déjà dans l'historique, pour que la chaîne de contact
tracée pendant la démonstration ait le même sens que le graphe affiché à côté."""


def _vider_traces(conn, heures=24):
    depuis = time.time() - heures * 3600
    compte = {
        "incidents": conn.execute(
            "DELETE FROM incident WHERE ts >= ? AND canal IN ('camera', 'micro')",
            (depuis,)).rowcount,
        "fatigue": conn.execute("DELETE FROM fatigue").rowcount,
        "capacite_camera": conn.execute(
            "DELETE FROM capacite WHERE source = 'camera'").rowcount,
        "confinements": conn.execute(
            "DELETE FROM confinement WHERE ouvert >= ?", (depuis,)).rowcount,
        "symptomes": conn.execute("DELETE FROM symptome").rowcount,
    }
    conn.execute("DELETE FROM ecran")
    conn.execute("UPDATE ambiance SET fumee = 0 WHERE ts >= ?", (depuis,))
    conn.commit()
    return compte


def _repartir(conn):
    """Referme les présences en cours et replace l'équipage, sans toucher à l'historique."""
    maintenant = time.time()
    conn.execute("UPDATE presence SET sortie = ? WHERE sortie IS NULL", (maintenant,))

    connus = {r["nom"] for r in conn.execute("SELECT nom FROM crew")}
    lieux = {}
    for r in conn.execute("SELECT nom FROM compartiment"):
        lieux[db._plat(r["nom"])] = r["nom"]

    places = 0
    for compartiment, membres in AFFECTATION.items():
        nom = lieux.get(db._plat(compartiment))
        if nom is None:
            continue
        for membre in membres:
            if membre not in connus:
                continue
            conn.execute(
                "INSERT INTO presence (crew, compartiment, entree) VALUES (?,?,?)",
                (membre, nom, maintenant - 1800))
            places += 1
    conn.commit()
    return places


def preparer(etat):
    """Remet le bord dans l'état de départ d'une démonstration."""
    conn = etat.conn
    efface = _vider_traces(conn)
    places = _repartir(conn)

    from . import social
    social._graphe_cache["valeur"] = None

    etat.recharger()
    db.journaliser(conn, "systeme",
                   f"bord remis en scène pour démonstration : {places} présences ouvertes",
                   acteur="systeme",
                   donnees={"efface": efface, "places": places})

    return {
        "places": places,
        "efface": efface,
        "compartiments": {c.nom: c.occupants for c in etat.compartiments},
        "conduites": db.conduites(conn),
    }
