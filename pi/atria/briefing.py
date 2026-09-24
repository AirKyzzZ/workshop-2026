"""Briefing de quart : ce qu'ATRIA a remarqué en croisant ses relevés.

Chaque sous-système du bord mesure bien une chose et ne regarde que la sienne. La capacité
ignore la conduite, la conduite ignore le graphe social, le graphe social ignore qui tousse.
Le briefing est le seul endroit où ces mesures sont posées côte à côte, et où le
rapprochement devient visible : deux membres hostiles affectés au même compartiment, un
isolé dont la capacité baisse, une toux entendue là où six personnes ont travaillé.

Le texte est produit sans modèle de langage. Le modèle local, quand il est allumé, ne fait
que le reformuler en français plus fluide, et sa sortie passe les mêmes gardes que le
reste : un nombre absent du relevé, un nom inventé ou un lien de causalité la font
rejeter, et le texte déterministe reprend sa place. Un briefing faux serait pire
qu'aucun briefing.
"""

import threading
import time

from . import confinement, db, llm, predict, social

CONSIGNE = """Tu es ATRIA, le système de bord d'un vaisseau interstellaire.

On te donne des CONSTATS déjà rédigés par les outils de bord. Réécris-les en un briefing
de quart en français courant, de quatre à six phrases.

Règles absolues :
- Chaque nombre et chaque nom doit apparaître tel quel dans les constats.
- N'ajoute aucun constat, aucune cause, aucune recommandation qui n'y figure pas.
- N'explique rien : n'écris ni « car », ni « parce que », ni « donc ».
- Tu ne décides rien. Tu rapportes.
- Pas de formule de politesse, pas de titre, pas de liste à puces."""

SEUIL_CAPACITE_BASSE = 0.50

FRAICHEUR_S = 60.0
"""Un briefing de quart ne change pas toutes les trois secondes, mais la vue de bord se
redessine a chaque push. Sans ce cache, le graphe social etait reconstruit trois fois par
briefing et jusqu'a vingt fois par minute, pour un texte identique."""

_cache = None
_reformule = None
_en_cours = threading.Lock()


def _reformuler_en_fond(brut):
    """Prepare la reformulation pour le briefing suivant, sans bloquer celui-ci.

    Un seul fil a la fois. Sans ce verrou, chaque sondage du tableau de bord en lancait un
    nouveau tant que le premier n'avait pas fini : dix appels simultanes au modele, et le
    SoC est monte a 86 °C en bridage. Le verrou est pris sans attendre, donc un appel qui
    arrive pendant qu'un autre travaille repart immediatement.
    """
    global _reformule, _cache
    if not _en_cours.acquire(blocking=False):
        return
    try:
        _reformule = (brut, *_reformuler(brut))
        _cache = None
    finally:
        _en_cours.release()


def _postes(etat):
    decouverts = etat.postes_decouverts()
    if not decouverts:
        return "Tous les postes sont couverts."
    vitaux = [p.nom for p in decouverts if p.criticite == "vital"]
    texte = f"{len(decouverts)} postes sans titulaire : " + ", ".join(
        p.nom for p in decouverts) + "."
    if vitaux:
        texte += f" Dont {len(vitaux)} vital(aux) : " + ", ".join(vitaux) + "."
    return texte


def _capacites(etat):
    bas = sorted((c for c in etat.equipage if c.cognitive < SEUIL_CAPACITE_BASSE),
                 key=lambda c: c.cognitive)
    if not bas:
        return None
    detail = ", ".join(f"{c.nom} à {c.cognitive:.2f}" for c in bas[:4])
    return f"{len(bas)} membres sous {SEUIL_CAPACITE_BASSE:.2f} de capacité : {detail}."


def _previsions(etat):
    previsions = []
    for membre in etat.equipage:
        tendance = predict.ajuster(etat.serie(membre.nom))
        if tendance is None or not tendance.fiable or not tendance.baisse:
            continue
        previsions.append((membre.nom, tendance.pente_h))
    if not previsions:
        return None
    previsions.sort(key=lambda x: x[1])
    detail = ", ".join(f"{n} à {p:.3f} par heure" for n, p in previsions[:3])
    return f"{len(previsions)} capacités en baisse mesurée : {detail}."


def _conduite(conn):
    incidents = db.incidents(conn, limite=200, depuis=time.time() - 86400)
    par_membre = {}
    for i in incidents:
        if i["crew"]:
            par_membre.setdefault(i["crew"], []).append(i)
    if not par_membre:
        return None
    lignes = []
    for nom, liste in sorted(par_membre.items(), key=lambda x: -len(x[1]))[:3]:
        canaux = sorted({i["canal"] for i in liste})
        lignes.append(f"{nom}, {len(liste)} incidents par {' et '.join(canaux)}, "
                      f"conduite à {db.conduite(conn, nom):.2f}")
    return "Conduite relevée sur 24 heures : " + " ; ".join(lignes) + "."


def _social(conn, etat, g):
    lignes = []

    hostiles = [l for l in g["liens"] if l["nature"] == "hostile"]
    ensemble = []
    for l in hostiles:
        un = etat.membre(l["un"])
        deux = etat.membre(l["deux"])
        if un and deux and un.compartiment == deux.compartiment != "inconnu":
            ensemble.append((l["un"], l["deux"], un.compartiment))
    if ensemble:
        detail = ", ".join(f"{a} et {b} en {lieu}" for a, b, lieu in ensemble[:3])
        lignes.append(f"{len(ensemble)} paires hostiles partagent un compartiment : "
                      f"{detail}.")
    elif hostiles:
        lignes.append(f"{len(hostiles)} paires hostiles au registre, aucune affectée "
                      f"au même compartiment.")

    isoles = [n["nom"] for n in g["noeuds"] if n["isolement"] >= 0.9]
    if isoles:
        lignes.append(f"{len(isoles)} membres sans lien d'équipage : "
                      + ", ".join(isoles[:4]) + ".")
    return lignes


def _contagion(conn):
    chaines = social.contagion_physique(conn)
    if not chaines:
        return None
    c = chaines[0]
    texte = f"{c['type']} entendue en {c['compartiment']}"
    if c["foyer"]:
        texte += f", {len(c['foyer'])} personnes présentes : " + ", ".join(c["foyer"][:4])
    if c["rang2"]:
        texte += f", puis {len(c['rang2'])} au second rang de contact"
    return texte + "."


def _mental(conn, etat, g):
    propagations = social.contagion_mentale(conn, etat, g)
    if not propagations:
        return None
    c = propagations[0]
    return (f"Stress projeté de {c['nom']} à {c['projete']:.2f} contre {c['stress']:.2f} "
            f"mesuré, au contact de " + ", ".join(c["voisins"][:3]) + ".")


def _somnolence(conn):
    releves = db.fatigues(conn, limite=6, heures=12)
    if not releves:
        return None
    r = releves[0]
    return (f"Somnolence observée chez {r['crew']} : PERCLOS à {r['perclos']:.2f} "
            f"sur {r['echantillons']} images, {r['baillements']} bâillements.")


def _confinements(conn):
    dossiers = confinement.actifs(conn)
    if not dossiers:
        return None
    lignes = []
    for d in dossiers[:3]:
        lignes.append(f"{d['cible']} {d['etat'].replace('_', ' ')}")
    return f"{len(dossiers)} dossiers de confinement ouverts : " + ", ".join(lignes) + "."


def constats(etat):
    """Les phrases factuelles du briefing, chacune produite par un outil déterministe."""
    conn = etat.conn
    lignes = [
        f"{sum(1 for c in etat.equipage if c.statut == 'actif')} membres en service actif.",
        _postes(etat),
    ]
    for producteur in (_capacites, _previsions):
        texte = producteur(etat)
        if texte:
            lignes.append(texte)
    for producteur in (_conduite, _contagion, _somnolence, _confinements):
        texte = producteur(conn)
        if texte:
            lignes.append(texte)
    g = social.graphe(conn)
    lignes.extend(_social(conn, etat, g))
    texte = _mental(conn, etat, g)
    if texte:
        lignes.append(texte)
    return lignes


def rediger(etat, force=False):
    """Rend le briefing sans jamais attendre le modèle.

    Le modèle met dix à trente secondes à reformuler, et la route bloquait d'autant : le
    tableau de bord semblait fige, et l'audit rendait un depassement de delai. Les
    constats sont deterministes et immediats, donc ils partent tels quels ; la
    reformulation se fait en fond et prendra place au briefing suivant.
    """
    global _cache

    if not force and _cache and time.time() - _cache["ts"] < FRAICHEUR_S:
        return _cache

    lignes = constats(etat)
    brut = " ".join(lignes)

    from . import modules

    rendu, rejet = None, None
    if not llm.ACTIF:
        rejet = "modèle éteint"
    elif not modules.actif("modele"):
        rejet = "module de langage non armé"
    elif not llm.disponible():
        rejet = "modèle injoignable"
    elif _reformule and _reformule[0] == brut:
        rendu, rejet = _reformule[1], _reformule[2]
    else:
        rejet = "reformulation en cours"
        threading.Thread(target=_reformuler_en_fond, args=(brut,), daemon=True).start()

    _cache = {
        "ts": time.time(),
        "constats": lignes,
        "texte": rendu or brut,
        "source": "modèle local" if rendu else "outils de bord",
        "rejet": rejet,
        "modele_actif": llm.ACTIF,
    }
    return _cache


def _reformuler(brut):
    """Passe les constats au modèle, et ne garde sa sortie que si elle tient les gardes.

    Rend (texte, motif de rejet). Le motif est affiché tel quel : un briefing qu'ATRIA a
    refusé d'elle-même en dit plus long sur le système qu'un briefing accepté.
    """
    import json
    import urllib.error
    import urllib.request

    charge = json.dumps({
        "messages": [
            {"role": "system", "content": CONSIGNE},
            {"role": "user", "content": f"CONSTATS :\n{brut}"},
        ],
        "temperature": 0.2,
        "max_tokens": 320,
        "stream": False,
    }).encode()

    try:
        requete = urllib.request.Request(
            f"{llm.HOTE}/v1/chat/completions", data=charge,
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(requete, timeout=llm.DELAI_S + 15) as r:
            paquet = json.load(r)
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError) as exc:
        return None, f"appel en échec : {type(exc).__name__}"

    texte = (paquet.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    if not texte:
        return None, "réponse vide"

    chiffres = llm.chiffres_inventes(texte, brut)
    if chiffres:
        return None, f"chiffres absents des constats : {', '.join(chiffres[:4])}"
    mots = llm.mots_inventes(texte, brut)
    if mots:
        return None, f"mots inventés : {', '.join(mots[:4])}"
    liens = llm.causalite(texte)
    if liens:
        return None, f"lien de causalité que les constats ne donnent pas : {liens[0]}"
    return texte, None
