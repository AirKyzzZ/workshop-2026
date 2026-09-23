"""Graphe social de l'équipage : qui se fréquente, qui s'évite, qui se supporte mal.

Rien n'est déclaré par personne. Tout se déduit de trois traces déjà enregistrées : les
présences par compartiment, les incidents de conduite et l'état de santé. Le graphe sert
trois usages, et c'est ce qui justifie de le construire une fois pour toutes.

Prévenir les conflits, en refusant d'affecter au même compartiment deux membres dont le
lien est hostile. Prévenir la contagion physique, en remontant les expositions le long des
arêtes de co-présence. Et prévenir la contagion mentale, parce que le stress se propage
d'abord entre gens qui se fréquentent, ce que les arêtes d'affinité décrivent exactement.
"""

import time

from . import db

FENETRE_S = 7 * 86400.0
"""Une semaine. Assez pour qu'un lien se dessine, assez court pour qu'il puisse changer."""

MINUTES_LIEN_MIN = 90.0
"""En deçà, deux personnes se sont croisées, elles ne se fréquentent pas."""

SEUIL_HOSTILE = -0.20
SEUIL_AMICAL = 0.40
SATURATION_FRICTION = 1.5
"""Proximite et hostilite ne sont pas le meme axe, et les soustraire est une erreur.

Deux personnes qui se detestent peuvent passer beaucoup de temps ensemble : c'est meme
souvent la condition du conflit. Retrancher les frictions du temps partage laisserait donc
la proximite ecraser l'hostilite. Les deux se calculent separement, et l'hostilite tire le
lien vers le negatif quelle que soit la proximite.

L'hostilite sature : un incident isole, deja divise entre les temoins presents, ne peut pas
franchir le seuil a lui seul. Il faut qu'il se repete avec la meme personne."""
DEMI_VIE_MENTALE_S = 43200.0


def _paire(a, b):
    return (a, b) if a <= b else (b, a)


def co_presences(conn, depuis=None):
    """Temps partagé par paire, en secondes, sur la fenêtre."""
    depuis = depuis if depuis is not None else time.time() - FENETRE_S
    maintenant = time.time()
    lignes = conn.execute(
        """
        SELECT a.crew AS un, b.crew AS deux, a.compartiment AS lieu,
               SUM(MIN(COALESCE(a.sortie, ?), COALESCE(b.sortie, ?))
                   - MAX(a.entree, b.entree)) AS secondes
        FROM presence a
        JOIN presence b
          ON a.compartiment = b.compartiment
         AND b.crew > a.crew
         AND MAX(a.entree, b.entree) < MIN(COALESCE(a.sortie, ?), COALESCE(b.sortie, ?))
        WHERE a.entree >= ?
        GROUP BY a.crew, b.crew, a.compartiment
        HAVING secondes > 0
        """,
        (maintenant, maintenant, maintenant, maintenant, depuis)).fetchall()

    partage = {}
    lieux = {}
    for l in lignes:
        cle = _paire(l["un"], l["deux"])
        partage[cle] = partage.get(cle, 0.0) + float(l["secondes"])
        lieux.setdefault(cle, {})
        lieux[cle][l["lieu"]] = lieux[cle].get(l["lieu"], 0.0) + float(l["secondes"])
    return partage, lieux


def frictions(conn, depuis=None):
    """Incidents survenus pendant qu'une paire partageait un compartiment.

    Un incident seul ne dit rien d'une relation. Un incident qui tombe systématiquement
    quand deux personnes sont ensemble en dit beaucoup, et c'est ce qu'on compte ici.
    """
    depuis = depuis if depuis is not None else time.time() - FENETRE_S
    maintenant = time.time()
    lignes = conn.execute(
        """
        SELECT i.id AS incident, i.crew AS auteur, p2.crew AS temoin
        FROM incident i
        JOIN presence p1
          ON p1.crew = i.crew
         AND i.ts BETWEEN p1.entree AND COALESCE(p1.sortie, ?)
        JOIN presence p2
          ON p2.compartiment = p1.compartiment
         AND p2.crew != i.crew
         AND i.ts BETWEEN p2.entree AND COALESCE(p2.sortie, ?)
        WHERE i.ts >= ? AND i.crew IS NOT NULL
        """,
        (maintenant, maintenant, depuis)).fetchall()

    temoins = {}
    for l in lignes:
        temoins.setdefault(l["incident"], (l["auteur"], []))[1].append(l["temoin"])

    # Un eclat de voix devant six personnes ne cree pas six inimities : chaque temoin
    # ne recoit qu'une part de l'incident, et seule la repetition avec la meme personne
    # finit par peser.
    compte = {}
    for auteur, presents in temoins.values():
        part = 1.0 / len(presents)
        for temoin in presents:
            cle = _paire(auteur, temoin)
            compte[cle] = compte.get(cle, 0.0) + part
    return compte


FRAICHEUR_GRAPHE_S = 30.0
"""Le graphe repose sur deux jointures de sept jours de presences. La boucle de surete le
reconstruisait toutes les cinq secondes pour un resultat qui bouge a l'echelle de l'heure,
et le SoC n'a pas la marge thermique pour ce genre de gaspillage."""

_graphe_cache = {"ts": 0.0, "valeur": None}


def graphe(conn, depuis=None):
    """Rend les nœuds et les arêtes du graphe social, avec un cache de trente secondes."""
    if depuis is None and _graphe_cache["valeur"] is not None \
            and time.time() - _graphe_cache["ts"] < FRAICHEUR_GRAPHE_S:
        return _graphe_cache["valeur"]
    resultat = _graphe(conn, depuis)
    if depuis is None:
        _graphe_cache["valeur"] = resultat
        _graphe_cache["ts"] = time.time()
    return resultat


def _graphe(conn, depuis=None):
    """Rend les nœuds et les arêtes du graphe social.

    Le lien va de -1, franchement hostile, à +1, franchement amical. Il part du temps
    partagé, normalisé sur la paire la plus proche, et retranche les frictions observées.
    """
    partage, lieux = co_presences(conn, depuis)
    friction = frictions(conn, depuis)
    if not partage:
        return {"noeuds": [], "liens": [], "fenetre_jours": FENETRE_S / 86400}

    reference = max(partage.values()) or 1.0
    liens = []
    for cle, secondes in partage.items():
        minutes = secondes / 60.0
        if minutes < MINUTES_LIEN_MIN:
            continue
        proximite = min(1.0, secondes / reference)
        heurts = friction.get(cle, 0.0)
        taux = heurts / max(1.0, secondes / 3600.0)
        hostilite = heurts / (heurts + SATURATION_FRICTION)
        lien = max(-1.0, min(1.0, proximite * (1.0 - hostilite) - hostilite))
        principal = max(lieux[cle].items(), key=lambda x: x[1])[0] if lieux.get(cle) else None
        liens.append({
            "un": cle[0], "deux": cle[1],
            "lien": round(lien, 3),
            "minutes": round(minutes),
            "frictions": round(heurts, 2),
            "taux_friction": round(taux, 2),
            "proximite": round(proximite, 3),
            "hostilite": round(hostilite, 3),
            "nature": "hostile" if lien <= SEUIL_HOSTILE
                      else "amical" if lien >= SEUIL_AMICAL else "neutre",
            "compartiment": principal,
        })

    degres = {}
    for l in liens:
        for n in (l["un"], l["deux"]):
            d = degres.setdefault(n, {"liens": 0, "amical": 0, "hostile": 0, "minutes": 0})
            d["liens"] += 1
            d["minutes"] += l["minutes"]
            if l["nature"] == "amical":
                d["amical"] += 1
            elif l["nature"] == "hostile":
                d["hostile"] += 1

    noeuds = []
    for m in conn.execute("SELECT nom, role, compartiment FROM crew WHERE statut != 'commandement'"
                          if _a_colonne(conn, "crew", "compartiment")
                          else "SELECT nom, role FROM crew WHERE statut != 'commandement'"):
        d = degres.get(m["nom"], {"liens": 0, "amical": 0, "hostile": 0, "minutes": 0})
        noeuds.append({"nom": m["nom"], "role": m["role"], **d,
                       "isolement": round(_isolement(d), 3)})

    liens.sort(key=lambda l: l["lien"])
    return {"noeuds": noeuds, "liens": liens, "fenetre_jours": FENETRE_S / 86400,
            "seuil_hostile": SEUIL_HOSTILE, "seuil_amical": SEUIL_AMICAL}


def _a_colonne(conn, table, colonne):
    return any(r["name"] == colonne
               for r in conn.execute(f"PRAGMA table_info({table})"))


def _isolement(degre):
    """0 quand le membre est bien entouré, 1 quand il ne l'est pas du tout."""
    if degre["liens"] == 0:
        return 1.0
    return max(0.0, min(1.0, 1.0 - (degre["amical"] + 0.4 * degre["liens"]) / 5.0))


def conflits_probables(conn, limite=5):
    """Paires hostiles, classées par risque, avec le compartiment où ça se produit."""
    g = graphe(conn)
    sorties = []
    for l in g["liens"]:
        if l["nature"] != "hostile":
            continue
        sorties.append({
            "paire": [l["un"], l["deux"]],
            "lien": l["lien"],
            "frictions": l["frictions"],
            "compartiment": l["compartiment"],
            "motif": (f"{l['frictions']} incidents imputés sur "
                      f"{round(l['minutes'] / 60)} h de co-présence, "
                      f"hostilité {l['hostilite']}"),
        })
    return sorties[:limite]


def exposition(conn, source, heures=24):
    """Qui a été exposé à `source`, directement puis au second rang.

    Sert au traçage d'une contamination : le premier rang a partagé un compartiment avec
    la source, le second l'a partagé avec le premier rang.
    """
    depuis = time.time() - heures * 3600
    partage, _ = co_presences(conn, depuis)
    voisins = {}
    for (a, b), s in partage.items():
        voisins.setdefault(a, {})[b] = s
        voisins.setdefault(b, {})[a] = s

    rang1 = voisins.get(source, {})
    rang2 = {}
    for proche in rang1:
        for suivant, s in voisins.get(proche, {}).items():
            if suivant != source and suivant not in rang1:
                rang2[suivant] = max(rang2.get(suivant, 0.0), s)

    return {
        "source": source,
        "heures": heures,
        "rang1": sorted(({"nom": n, "minutes": round(s / 60)} for n, s in rang1.items()),
                        key=lambda x: -x["minutes"]),
        "rang2": sorted(({"nom": n, "minutes": round(s / 60)} for n, s in rang2.items()),
                        key=lambda x: -x["minutes"]),
    }


def contagion_mentale(conn, etat, g=None):
    """Stress attendu de chacun, propagé le long des arêtes amicales.

    L'humeur se transmet d'abord entre gens qui se fréquentent. Un membre entouré de
    collègues sous tension est plus exposé que son propre relevé ne le montre, et c'est
    précisément ce qu'on veut voir venir.
    """
    g = g or graphe(conn)
    stress = {c.nom: getattr(c, "stress", None) for c in etat.equipage}
    stress = {n: v for n, v in stress.items() if v is not None}
    if not stress:
        return []

    voisins = {}
    for l in g["liens"]:
        if l["lien"] <= 0:
            continue
        voisins.setdefault(l["un"], []).append((l["deux"], l["lien"]))
        voisins.setdefault(l["deux"], []).append((l["un"], l["lien"]))

    sorties = []
    for nom, propre in stress.items():
        autour = voisins.get(nom, [])
        if not autour:
            continue
        poids = sum(p for _, p in autour)
        ambiant = sum(stress.get(v, propre) * p for v, p in autour) / poids
        projete = min(1.0, propre + 0.35 * max(0.0, ambiant - propre))
        if projete - propre >= 0.05:
            sorties.append({
                "nom": nom,
                "stress": round(propre, 3),
                "ambiant": round(ambiant, 3),
                "projete": round(projete, 3),
                "voisins": [v for v, _ in sorted(autour, key=lambda x: -x[1])[:3]],
            })
    sorties.sort(key=lambda x: -(x["projete"] - x["stress"]))
    return sorties


SEUIL_CONFIANCE = 0.55
"""En dessous, ATRIA refuse un poste vital. La conduite dit si quelqu'un se tient
correctement maintenant ; la confiance dit si l'equipage peut compter sur lui demain."""

POIDS_CONFIANCE = {"conduite": 0.45, "regularite": 0.25, "appui": 0.30}


def _regularite(conn, crew, heures=168):
    """Predictibilite de la capacite : un membre en dents de scie inspire moins confiance.

    Ce n'est pas la meme chose qu'une capacite basse. Quelqu'un de constamment moyen est
    plus sur a bord que quelqu'un d'excellent un jour sur deux, parce qu'on peut le
    planifier.
    """
    depuis = time.time() - heures * 3600
    valeurs = [r["cognitive"] for r in conn.execute(
        "SELECT cognitive FROM capacite WHERE crew = ? AND ts >= ?", (crew, depuis))]
    if len(valeurs) < 4:
        return None
    moyenne = sum(valeurs) / len(valeurs)
    ecart = (sum((v - moyenne) ** 2 for v in valeurs) / len(valeurs)) ** 0.5
    return max(0.0, min(1.0, 1.0 - ecart / 0.20))


def _appui(noeud):
    """Ce que l'equipage renvoie a quelqu'un : des affinites, des hostilites, ou rien."""
    if noeud["liens"] == 0:
        return 0.35
    brut = (noeud["amical"] - 1.5 * noeud["hostile"]) / 4.0
    return max(0.0, min(1.0, 0.5 + brut))


def confiances(conn, g=None):
    """Confiance de tout l'equipage, entre 0 et 1, avec le detail de ce qui la compose."""
    g = g or graphe(conn)
    scores = db.conduites(conn)
    sorties = {}
    for n in g["noeuds"]:
        conduite = scores.get(n["nom"], 1.0)
        regularite = _regularite(conn, n["nom"])
        appui = _appui(n)
        parts = {"conduite": conduite, "appui": appui}
        if regularite is not None:
            parts["regularite"] = regularite
        poids = sum(POIDS_CONFIANCE[k] for k in parts)
        valeur = sum(POIDS_CONFIANCE[k] * v for k, v in parts.items()) / poids
        sorties[n["nom"]] = {
            "confiance": round(valeur, 3),
            "conduite": round(conduite, 3),
            "regularite": None if regularite is None else round(regularite, 3),
            "appui": round(appui, 3),
            "sous_seuil": valeur < SEUIL_CONFIANCE,
        }
    return sorties


def confiance(conn, crew):
    return confiances(conn).get(crew, {}).get("confiance", 1.0)


def contagion_physique(conn, heures=12):
    """Qui a ete expose aux symptomes recents, par compartiment puis de proche en proche.

    Le graphe de co-presence sert ici tel quel : un symptome entendu dans un compartiment
    contamine d'abord ceux qui y etaient, puis ceux qui ont ensuite partage un lieu avec
    eux. Le second rang est le plus utile, parce que c'est celui qu'on ne voit pas venir.

    Les co-presences se calculent une seule fois pour tous les foyers. Les recalculer par
    membre revenait a rejouer une jointure lourde autant de fois qu'il y avait de monde
    dans la piece, sur une route que le dashboard sonde chaque seconde.
    """
    symptomes = db.symptomes(conn, heures=heures)
    if not symptomes:
        return []

    partage, _ = co_presences(conn, time.time() - heures * 3600)
    voisins = {}
    for (a, b), secondes in partage.items():
        voisins.setdefault(a, {})[b] = secondes
        voisins.setdefault(b, {})[a] = secondes

    sorties = []
    vus = set()
    maintenant = time.time()
    for s in symptomes:
        cle = (s["compartiment"], s["type"])
        if cle in vus:
            continue
        vus.add(cle)

        presents = db.occupants(conn, s["compartiment"])
        passes = [r["crew"] for r in conn.execute(
            "SELECT DISTINCT crew FROM presence WHERE compartiment = ?"
            " AND COALESCE(sortie, ?) >= ?",
            (s["compartiment"], maintenant, s["ts"] - 3600))]
        foyer = sorted(set(presents) | set(passes))

        rang2 = {}
        for nom in foyer:
            for suivant, secondes in voisins.get(nom, {}).items():
                if suivant not in foyer:
                    rang2[suivant] = max(rang2.get(suivant, 0.0), secondes)

        sorties.append({
            "compartiment": s["compartiment"],
            "type": s["type"],
            "ts": s["ts"],
            "source": s["source"],
            "foyer": foyer,
            "rang2": sorted(({"nom": n, "minutes": round(v / 60)}
                             for n, v in rang2.items()),
                            key=lambda x: -x["minutes"])[:8],
        })
    return sorties
