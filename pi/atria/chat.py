import re
import time

from . import db, predict

OUTILS = {
    "etat_membre": {
        "description": "Etat physiologique et poste d'un membre d'equipage",
        "parametres": {"nom": "nom du membre"},
    },
    "qui_peut": {
        "description": "Membres aptes a tenir un poste, classes par capacite",
        "parametres": {"poste": "nom du poste"},
    },
    "situation": {
        "description": "Synthese: effectif, postes decouverts, alertes actives",
        "parametres": {},
    },
    "tendance": {
        "description": "Evolution de la capacite d'un membre et projection",
        "parametres": {"nom": "nom du membre"},
    },
    "contacts": {
        "description": "Membres ayant partage un compartiment avec quelqu'un",
        "parametres": {"nom": "nom du membre", "heures": "fenetre en heures"},
    },
    "journal": {
        "description": "Dernieres decisions, refus et derogations",
        "parametres": {"limite": "nombre d'entrees"},
    },
    "compartiment": {
        "description": "Atmosphere et occupants d'un compartiment",
        "parametres": {"nom": "nom du compartiment"},
    },
}


def catalogue():
    return [{"nom": k, **v, "ecriture": False} for k, v in OUTILS.items()]


def _etat_membre(etat, nom, capitaine):
    m = etat.membre(nom)
    if m is None:
        return f"{nom} ne figure pas au registre d'équipage.", {}
    if capitaine:
        texte = (f"{m.nom}, {m.role}. "
                 f"{'Apte' if m.cognitive >= 0.60 else 'Aptitude réduite'}. "
                 f"Poste : {m.poste or 'aucun'}. Compartiment : {m.compartiment}. "
                 f"Les données physiologiques ne sont pas communiquées au commandement.")
        return texte, {"cognitive": m.cognitive, "poste": m.poste}
    texte = (f"{m.nom}, {m.role}. Capacité cognitive {m.cognitive:.2f}. "
             f"Fréquence cardiaque {m.hr} bpm, RMSSD {m.rmssd:.0f} ms, "
             f"stress estimé {m.stress:.2f}. {m.sommeil_h:.1f} h de sommeil, "
             f"dette sociale {m.dette_sociale} jours. "
             f"Poste : {m.poste or 'aucun'}, compartiment {m.compartiment}.")
    return texte, {"cognitive": m.cognitive, "hr": m.hr, "rmssd": m.rmssd}


def _qui_peut(etat, poste_nom):
    p = etat.poste(poste_nom)
    if p is None:
        return f"Le poste {poste_nom} n'existe pas à bord.", {}
    aptes = sorted((c for c in etat.equipage
                    if p.competence in c.competences and c.cognitive >= p.seuil),
                   key=lambda c: c.cognitive, reverse=True)
    if not aptes:
        qualifies = [c for c in etat.equipage if p.competence in c.competences]
        meilleur = max(qualifies, key=lambda c: c.cognitive, default=None)
        texte = (f"Aucun membre n'atteint le seuil {p.seuil:.2f} requis pour {p.nom}.")
        if meilleur:
            texte += (f" Le plus proche est {meilleur.nom} à {meilleur.cognitive:.2f}, "
                      f"soit {p.seuil - meilleur.cognitive:.2f} sous le seuil.")
        return texte, {"aptes": 0, "seuil": p.seuil}
    liste = ", ".join(f"{c.nom} ({c.cognitive:.2f})" for c in aptes[:5])
    texte = (f"{len(aptes)} membres aptes au poste {p.nom}, seuil {p.seuil:.2f} : {liste}."
             f" Titulaire actuel : {p.titulaire or 'aucun'}.")
    return texte, {"aptes": len(aptes), "seuil": p.seuil}


def _situation(etat):
    decouverts = etat.postes_decouverts()
    alertes = etat.alertes()
    critiques = [c for c in etat.equipage if c.cognitive < 0.45]
    morceaux = [f"{sum(1 for c in etat.equipage if c.statut == 'actif')} membres en service actif."]
    if decouverts:
        morceaux.append("Postes sans titulaire : " + ", ".join(p.nom for p in decouverts) + ".")
    else:
        morceaux.append("Tous les postes sont couverts.")
    if critiques:
        morceaux.append(f"{len(critiques)} membres en capacité réduite : "
                        + ", ".join(c.nom for c in critiques[:4]) + ".")
    if alertes:
        morceaux.append(f"{len(alertes)} alertes actives.")
    morceaux.append("Aucun lien avec la Terre.")
    return " ".join(morceaux), {"alertes": len(alertes), "decouverts": len(decouverts)}


def _tendance(etat, nom):
    m = etat.membre(nom)
    if m is None:
        return f"{nom} ne figure pas au registre.", {}
    t = predict.ajuster(etat.serie(nom))
    if t is None or not t.fiable:
        return f"Pas assez d'historique fiable pour établir une tendance sur {nom}.", {}
    sens = "baisse" if t.pente_h < 0 else "hausse"
    texte = (f"La capacité de {m.nom} est en {sens} de {abs(t.pente_h):.3f} par heure "
             f"(R² {t.r2:.2f}). Actuellement {m.cognitive:.2f}, "
             f"projection à six heures {t.projection(6):.2f}.")
    eligibles = [p for p in etat.postes
                 if p.competence in m.competences and m.cognitive >= p.seuil]
    if eligibles and t.baisse:
        cible = max(eligibles, key=lambda p: p.seuil)
        h = t.heures_avant(cible.seuil)
        if h:
            texte += (f" Il passera sous le seuil {cible.nom} ({cible.seuil:.2f}) "
                      f"dans environ {h:.1f} heures.")
    return texte, {"pente_h": round(t.pente_h, 4), "r2": round(t.r2, 2)}


def _contacts(etat, nom, heures=24):
    m = etat.membre(nom)
    if m is None:
        return f"{nom} ne figure pas au registre.", {}
    liste = db.contacts(etat.conn, nom, time.time() - heures * 3600)
    if not liste:
        return (f"{m.nom} n'a partagé aucun compartiment avec un autre membre "
                f"sur les {heures} dernières heures. Isolement à surveiller."), {"contacts": 0}
    detail = ", ".join(f"{a} ({s/60:.0f} min)" for a, s in liste[:6])
    return (f"{m.nom} a croisé {len(liste)} membres sur {heures} h : {detail}."), \
           {"contacts": len(liste)}


def _journal(etat, limite=8):
    entrees = db.journal(etat.conn, limite)
    if not entrees:
        return "Le journal est vide.", {}
    lignes = []
    for e in entrees:
        quand = time.strftime("%H:%M", time.localtime(e["ts"]))
        cible = f" {e['sujet']}" if e["sujet"] else ""
        lignes.append(f"{quand} [{e['type']}]{cible} : {e['motif']}")
    return "\n".join(lignes), {"entrees": len(entrees)}


def _compartiment(etat, nom):
    c = etat.compartiment(nom)
    if c is None:
        return f"Le compartiment {nom} n'existe pas.", {}
    morceaux = [f"{c.nom} :"]
    if c.humidite is not None:
        morceaux.append(f"{c.temp_c:.1f} °C, {c.humidite:.0f} % d'humidité,")
    morceaux.append(f"{c.bruit_db} dB.")
    if c.fumee:
        morceaux.append("COMBUSTION DÉTECTÉE.")
    if c.occupants:
        morceaux.append(f"Occupants : {', '.join(c.occupants)}.")
    else:
        morceaux.append("Aucun occupant.")
    return " ".join(morceaux), {"occupants": len(c.occupants)}


IMPLEMENTATIONS = {
    "etat_membre": lambda etat, args, cap: _etat_membre(etat, args.get("nom", ""), cap),
    "qui_peut": lambda etat, args, cap: _qui_peut(etat, args.get("poste", "")),
    "situation": lambda etat, args, cap: _situation(etat),
    "tendance": lambda etat, args, cap: _tendance(etat, args.get("nom", "")),
    "contacts": lambda etat, args, cap: _contacts(etat, args.get("nom", ""),
                                                  int(args.get("heures", 24))),
    "journal": lambda etat, args, cap: _journal(etat, int(args.get("limite", 8))),
    "compartiment": lambda etat, args, cap: _compartiment(etat, args.get("nom", "")),
}


def router(etat, question):
    """Analyseur deterministe. Sera double par un LLM contraint par grammaire."""
    q = question.lower()
    noms = {c.nom for c in etat.equipage}
    postes = {p.nom for p in etat.postes}
    comps = {c.nom for c in etat.compartiments}

    mots = re.findall(r"[a-zà-ÿ]+", q)
    nom = next((m for m in mots if m in noms), None)
    poste = next((m for m in mots if m in postes), None)
    comp = next((m for m in mots if m in comps), None)

    if any(k in q for k in ("journal", "décision", "decision", "dérogation", "derogation",
                            "refus", "historique")):
        return "journal", {"limite": 8}
    if any(k in q for k in ("contact", "croisé", "croise", "isolé", "isole", "isolement")) and nom:
        return "contacts", {"nom": nom, "heures": 24}
    if any(k in q for k in ("tendance", "évolution", "evolution", "baisse", "prévision",
                            "prevision", "projection", "dans combien")) and nom:
        return "tendance", {"nom": nom}
    if any(k in q for k in ("qui peut", "qui pourrait", "aptes", "disponible")) and poste:
        return "qui_peut", {"poste": poste}
    if comp and not nom:
        return "compartiment", {"nom": comp}
    if poste and not nom:
        return "qui_peut", {"poste": poste}
    if nom:
        return "etat_membre", {"nom": nom}
    if any(k in q for k in ("situation", "résumé", "resume", "état du vaisseau",
                            "etat du vaisseau", "rapport", "ça va", "ca va")):
        return "situation", {}
    return None, {}


MAX_QUESTION = 180


def assainir(texte):
    """Neutralise le balisage et borne la longueur avant journalisation."""
    return re.sub(r"[<>&\"\']", " ", texte)[:MAX_QUESTION].strip()


def repondre(etat, question, capitaine=False, medical=False):
    etat.recharger()
    outil, args = router(etat, question)

    if outil is None:
        return {
            "reponse": ("Je n'ai pas compris la question. Je peux renseigner l'état d'un "
                        "membre, les aptes à un poste, une tendance, les contacts récents, "
                        "un compartiment, le journal des décisions, ou la situation générale."),
            "outils": [], "erreur": True,
        }

    texte, donnees = IMPLEMENTATIONS[outil](etat, args, not medical)
    db.journaliser(etat.conn, "question", assainir(question),
                   acteur="capitaine" if capitaine else "equipage",
                   donnees={"outil": outil, "args": args})
    return {"reponse": texte, "outils": [{"nom": outil, "args": args, "ecriture": False}],
            "donnees": donnees, "erreur": False}
