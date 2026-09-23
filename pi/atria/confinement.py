"""Confinement : sceller un compartiment, ou isoler un membre de l'équipage.

Deux situations très différentes partagent le même mécanisme, et c'est justement leur
différence qui fait la règle du module.

Un incendie se contient en fermant la cloison. ATRIA le fait seule, sans demander, parce
que quelques secondes comptent. Mais elle ne scelle un compartiment que s'il est vide :
enfermer quelqu'un dans un feu le tue, donc tant qu'il reste un occupant la décision
devient un ordre d'évacuation, et le scellement attend le dernier sorti.

Un comportement dangereux se contient en isolant une personne. ATRIA ne le fait jamais
seule. Elle mesure, elle argumente, elle propose, et c'est le capitaine qui tranche. Le
système n'a pas d'autorité sur les corps, seulement sur les cloisons.
"""

import json
import time

from . import db, social

SEUIL_FEU_TEMP_C = 45.0
SEUIL_FEU_SUSPICION_C = 38.0
DELAI_EVACUATION_S = 120.0
"""Deux minutes annoncées à l'équipage avant que la cloison ne se ferme d'elle-même."""

DELAI_REPROPOSITION_S = 1800.0
"""Une demi-heure. Sans ce delai, un refus du capitaine est balaye au tour suivant : la
proposition se rouvre tant que le risque reste haut, et l'arbitrage humain ne veut plus
rien dire. Le compteur repart a chaque decision, donc une escalade reelle finit par
redemander."""

SEUIL_MENACE = 0.70
SEUIL_ALERTE_MENACE = 0.45
FENETRE_MENACE_S = 6 * 3600.0
DEMI_VIE_MENACE_S = 5400.0

GRAVITES_MENACE = {
    "menace": 1.0,
    "violence": 1.0,
    "arme": 1.0,
    "insulte": 0.5,
    "doigt_honneur": 0.35,
    "poing_ferme": 0.45,
    "cri": 0.3,
    "hostilite": 0.3,
    "pouce_baisse": 0.15,
}

ETATS_ACTIFS = ("propose", "attente_evacuation", "scelle", "confine")


def _enregistrer(conn, genre, cible, etat, motif, auteur, risque=None, donnees=None):
    curseur = conn.execute(
        "INSERT INTO confinement (genre, cible, etat, motif, risque, auteur, ouvert, donnees)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (genre, cible, etat, motif, risque, auteur, time.time(),
         json.dumps(donnees, ensure_ascii=False) if donnees else None))
    conn.commit()
    return curseur.lastrowid


def _ligne(l):
    d = dict(l)
    d["donnees"] = json.loads(d["donnees"]) if d["donnees"] else {}
    return d


def actifs(conn, genre=None, cible=None):
    requete = ("SELECT * FROM confinement WHERE etat IN "
               "('propose','attente_evacuation','scelle','confine')")
    parametres = []
    if genre:
        requete += " AND genre = ?"
        parametres.append(genre)
    if cible:
        requete += " AND cible = ?"
        parametres.append(cible)
    requete += " ORDER BY ouvert DESC"
    return [_ligne(l) for l in conn.execute(requete, parametres)]


def historique(conn, limite=20):
    return [_ligne(l) for l in conn.execute(
        "SELECT * FROM confinement ORDER BY ouvert DESC LIMIT ?", (limite,))]


def _changer(conn, identifiant, etat, ferme=False):
    conn.execute("UPDATE confinement SET etat = ?, ferme = ? WHERE id = ?",
                 (etat, time.time() if ferme else None, identifiant))
    conn.commit()


def niveau_feu(compartiment):
    """Lit les capteurs d'un compartiment et rend 'feu', 'suspicion' ou None.

    Les deux signaux sont independants et suffisent chacun. Exiger fumee ET chaleur
    ferait rater un depart de feu que le MQ2 voit avant que l'air du compartiment n'ait
    eu le temps de monter en temperature, c'est-a-dire exactement le cas utile.
    """
    chaud = compartiment.temp_c is not None and compartiment.temp_c >= SEUIL_FEU_TEMP_C
    tiede = compartiment.temp_c is not None and compartiment.temp_c >= SEUIL_FEU_SUSPICION_C
    if compartiment.fumee or chaud:
        return "feu"
    if tiede:
        return "suspicion"
    return None


def evaluer_feu(etat):
    """Décision de confinement pour chaque compartiment en combustion."""
    sorties = []
    ouverts = {c["cible"]: c for c in actifs(etat.conn, genre="compartiment")}
    for comp in etat.compartiments:
        niveau = niveau_feu(comp)
        courant = ouverts.get(comp.nom)
        if niveau is None and courant is None:
            continue

        occupants = list(comp.occupants)
        if niveau is None:
            decision = "lever"
        elif niveau == "suspicion":
            decision = "surveiller"
        elif occupants:
            decision = "evacuer"
        else:
            decision = "sceller"

        sorties.append({
            "compartiment": comp.nom,
            "niveau": niveau,
            "temp_c": comp.temp_c,
            "fumee": comp.fumee,
            "occupants": occupants,
            "decision": decision,
            "confinement": courant,
        })
    return sorties


def appliquer_feu(etat):
    """Exécute les décisions incendie. Rend la liste des actions réellement prises.

    Cette fonction est le seul endroit du système où ATRIA agit sans demander. La garde
    est donc explicite : elle ne scelle que si la liste des occupants est vide, relue à
    l'instant de la décision et non pas au moment de la détection.
    """
    conn = etat.conn
    actions = []
    for cas in evaluer_feu(etat):
        nom = cas["compartiment"]
        courant = cas["confinement"]
        decision = cas["decision"]

        if decision == "lever":
            if courant:
                _changer(conn, courant["id"], "leve", ferme=True)
                db.poser_ecran(conn, nom)
                db.journaliser(conn, "confinement",
                               f"combustion terminée dans {nom}, cloison rouverte",
                               acteur="atria", sujet=nom)
                actions.append({"compartiment": nom, "action": "leve"})
            continue

        if decision == "surveiller":
            continue

        if decision == "evacuer":
            if courant and courant["etat"] in ("attente_evacuation", "scelle"):
                continue
            motif = (f"combustion dans {nom}, {len(cas['occupants'])} occupant(s) "
                     f"à évacuer avant fermeture")
            _enregistrer(conn, "compartiment", nom, "attente_evacuation", motif, "atria",
                         donnees={"occupants": cas["occupants"], "temp_c": cas["temp_c"],
                                  "delai_s": DELAI_EVACUATION_S})
            db.poser_ecran(conn, nom, "!! EVACUEZ !!",
                           f"cloison {round(DELAI_EVACUATION_S)}s")
            db.journaliser(conn, "crise", motif, acteur="atria", sujet=nom,
                           donnees={"occupants": cas["occupants"]})
            actions.append({"compartiment": nom, "action": "evacuation",
                            "occupants": cas["occupants"]})
            continue

        if decision == "sceller":
            if courant and courant["etat"] == "scelle":
                continue
            if courant:
                _changer(conn, courant["id"], "scelle")
            else:
                _enregistrer(conn, "compartiment", nom, "scelle",
                             f"combustion dans {nom}, compartiment vide, cloison scellée",
                             "atria", donnees={"temp_c": cas["temp_c"]})
            db.poser_ecran(conn, nom, "COMPARTIMENT", "SCELLE")
            db.journaliser(conn, "crise",
                           f"{nom} scellé, compartiment vide au moment de la décision",
                           acteur="atria", sujet=nom,
                           donnees={"temp_c": cas["temp_c"], "automatique": True})
            actions.append({"compartiment": nom, "action": "scelle"})
    return actions


def risque_menace(conn, etat, g=None):
    """Note le risque qu'un membre représente pour les autres, entre 0 et 1.

    Trois signaux indépendants, parce qu'aucun ne suffit seul. Des gestes agressifs
    répétés et récents. Une conduite déjà effondrée. Et une hostilité concentrée sur une
    personne plutôt que diffuse, parce que c'est ce qui distingue quelqu'un d'irritable de
    quelqu'un qui en veut à quelqu'un.
    """
    g = g or social.graphe(conn)
    maintenant = time.time()
    conduites = db.conduites(conn)

    par_membre = {}
    for i in db.incidents(conn, limite=500, depuis=maintenant - FENETRE_MENACE_S):
        if not i["crew"]:
            continue
        poids = GRAVITES_MENACE.get(i["type"], 0.25)
        amorti = 0.5 ** ((maintenant - i["ts"]) / DEMI_VIE_MENACE_S)
        entree = par_membre.setdefault(i["crew"], {"charge": 0.0, "types": {}})
        entree["charge"] += poids * i["gravite"] * amorti * 4.0
        entree["types"][i["type"]] = entree["types"].get(i["type"], 0) + 1

    cibles = {}
    for l in g["liens"]:
        if l["nature"] != "hostile":
            continue
        for auteur, autre in ((l["un"], l["deux"]), (l["deux"], l["un"])):
            pire = cibles.get(auteur)
            if pire is None or l["lien"] < pire[1]:
                cibles[auteur] = (autre, l["lien"])

    sorties = []
    for nom, entree in par_membre.items():
        membre = etat.membre(nom)
        if membre is None:
            continue
        agressivite = min(1.0, entree["charge"])
        effondrement = max(0.0, (db.SEUIL_CONDUITE - conduites.get(nom, 1.0))
                           / db.SEUIL_CONDUITE)
        cible, lien = cibles.get(nom, (None, 0.0))
        fixation = min(1.0, abs(lien))

        risque = min(1.0, 0.55 * agressivite + 0.25 * effondrement + 0.20 * fixation)
        if risque < SEUIL_ALERTE_MENACE:
            continue

        motifs = []
        if agressivite > 0.2:
            detail = ", ".join(f"{n} {t.replace('_', ' ')}"
                               for t, n in sorted(entree["types"].items(),
                                                  key=lambda x: -x[1])[:3])
            motifs.append(f"{detail} en {round(FENETRE_MENACE_S / 3600)} h")
        if effondrement > 0:
            motifs.append(f"conduite {conduites.get(nom, 1.0):.2f} sous le seuil")
        if cible:
            motifs.append(f"hostilité concentrée sur {cible} (lien {lien:.2f})")

        tranche = tranche_recente(conn, nom)
        sorties.append({
            "crew": nom,
            "risque": round(risque, 3),
            "tranche": tranche["etat"] if tranche else None,
            "agressivite": round(agressivite, 3),
            "effondrement": round(effondrement, 3),
            "fixation": round(fixation, 3),
            "cible": cible,
            "compartiment": membre.compartiment,
            "motifs": motifs,
            "proposable": risque >= SEUIL_MENACE and tranche is None,
        })
    sorties.sort(key=lambda s: -s["risque"])
    return sorties


def tranche_recente(conn, crew, maintenant=None):
    """Rend la derniere decision prise sur ce membre si elle est encore fraiche."""
    maintenant = maintenant or time.time()
    ligne = conn.execute(
        "SELECT * FROM confinement WHERE genre = 'personne' AND cible = ?"
        " AND ferme IS NOT NULL AND ferme >= ? ORDER BY ferme DESC LIMIT 1",
        (crew, maintenant - DELAI_REPROPOSITION_S)).fetchone()
    return _ligne(ligne) if ligne else None


def proposer_isolement(conn, cas):
    """Ouvre une proposition d'isolement. Elle reste sans effet tant qu'elle n'est pas
    approuvée : ATRIA n'enferme personne, elle argumente devant le capitaine."""
    if actifs(conn, genre="personne", cible=cas["crew"]):
        return None
    if tranche_recente(conn, cas["crew"]):
        return None
    motif = " ; ".join(cas["motifs"]) or "comportement jugé dangereux"
    identifiant = _enregistrer(conn, "personne", cas["crew"], "propose", motif, "atria",
                               risque=cas["risque"],
                               donnees={"cible": cas["cible"],
                                        "compartiment": cas["compartiment"]})
    db.journaliser(conn, "confinement",
                   f"isolement de {cas['crew']} proposé au capitaine, "
                   f"risque {cas['risque']:.2f}",
                   acteur="atria", sujet=cas["crew"],
                   donnees={"risque": cas["risque"], "motifs": cas["motifs"]})
    return identifiant


def surveiller_menaces(conn, etat):
    """Ouvre une proposition pour chaque membre au-dessus du seuil. Rend les nouvelles."""
    ouvertes = []
    for cas in risque_menace(conn, etat):
        if not cas["proposable"]:
            continue
        identifiant = proposer_isolement(conn, cas)
        if identifiant:
            ouvertes.append({"id": identifiant, **cas})
    return ouvertes


def decider(conn, identifiant, decision, capitaine, motif=None):
    """Tranche une proposition. Seul le capitaine passe par ici."""
    ligne = conn.execute("SELECT * FROM confinement WHERE id = ?", (identifiant,)).fetchone()
    if ligne is None:
        return {"erreur": "proposition introuvable"}
    dossier = _ligne(ligne)

    if decision == "rejeter":
        _changer(conn, identifiant, "rejete", ferme=True)
        db.journaliser(conn, "confinement",
                       motif or f"isolement de {dossier['cible']} refusé par le capitaine",
                       acteur=capitaine, sujet=dossier["cible"])
        return {"etat": "rejete", "dossier": dossier}

    if decision == "lever":
        _changer(conn, identifiant, "leve", ferme=True)
        db.journaliser(conn, "confinement",
                       motif or f"confinement de {dossier['cible']} levé",
                       acteur=capitaine, sujet=dossier["cible"])
        return {"etat": "leve", "dossier": dossier}

    if decision == "confiner":
        if dossier["etat"] != "propose":
            return {"erreur": f"dossier déjà {dossier['etat']}"}
        _changer(conn, identifiant, "confine")
        db.journaliser(conn, "confinement",
                       motif or (f"{dossier['cible']} confiné sur ordre du capitaine, "
                                 f"risque {dossier['risque'] or 0:.2f}"),
                       acteur=capitaine, sujet=dossier["cible"],
                       donnees={"risque": dossier["risque"], "approuve_par": capitaine})
        return {"etat": "confine", "dossier": dossier}

    if decision == "sceller":
        _changer(conn, identifiant, "scelle")
        db.journaliser(conn, "crise",
                       motif or (f"{dossier['cible']} scellé sur ordre du capitaine "
                                 f"malgré la présence d'occupants"),
                       acteur=capitaine, sujet=dossier["cible"],
                       donnees={"derogation": True,
                                "occupants": dossier["donnees"].get("occupants", [])})
        return {"etat": "scelle", "dossier": dossier}

    return {"erreur": f"décision inconnue : {decision}"}
