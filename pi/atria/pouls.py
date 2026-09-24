"""Audit cardiaque : une mesure prise sur un vrai corps, à la demande.

Les constantes physiologiques du bord sont simulées. Celle-ci ne l'est pas : quelqu'un
pose un doigt sur le capteur du nœud, la carte détecte chaque battement et renvoie
l'intervalle qui le sépare du précédent, et le relevé est écrit au dossier du membre que
la caméra reconnaît au même moment.

La variabilité compte plus que la fréquence. Un cœur en bonne santé ne bat pas comme un
métronome : l'écart quadratique entre intervalles successifs, le RMSSD, chute quand le
système nerveux est sous tension. C'est cette valeur que le régulateur utilise déjà, à
ceci près qu'elle vient désormais d'un capteur et non du simulateur.

La session transite par la base parce que le nœud appartient au terminal et le bouton à
l'API : deux processus, un seul port série. L'API ouvre la session, le terminal arme le
capteur et écrit les battements, l'API conclut quand la fenêtre est écoulée.

Une session courte ne vaut rien pour un diagnostic, et le module le dit plutôt que de
rendre un chiffre rassurant : sous une douzaine de battements, la mesure est annoncée
comme indicative.
"""

import statistics
import time

from . import db

DUREE_DEFAUT_S = 30.0
BATTEMENTS_MIN = 12
"""En deçà, la variabilité n'a pas de sens : on rend la fréquence et on le signale."""

INTERVALLE_MIN_MS = 300
INTERVALLE_MAX_MS = 1800
"""Bornes physiologiques, de 33 à 200 battements par minute. Hors de là, c'est un
mouvement du doigt et non un battement."""

RMSSD_DETENDU_MS = 60.0


def demarrer(conn, crew, duree=DUREE_DEFAUT_S):
    identifiant = db.ouvrir_audit(conn, crew, duree)
    db.journaliser(conn, "identification",
                   f"audit cardiaque demarre sur {crew or 'membre non identifie'}",
                   acteur="atria", sujet=crew)
    return etat(conn)


def arreter(conn):
    session = db.audit_actif(conn)
    if session:
        conclure(conn, session)
    return etat(conn)


def _mesurer(intervalles):
    moyenne = statistics.mean(intervalles)
    ecarts = [intervalles[i + 1] - intervalles[i] for i in range(len(intervalles) - 1)]
    rmssd = (sum(e * e for e in ecarts) / len(ecarts)) ** 0.5 if ecarts else 0.0
    sdnn = statistics.pstdev(intervalles) if len(intervalles) > 1 else 0.0
    return {
        "hr": round(60000.0 / moyenne),
        "rmssd": round(rmssd, 1),
        "sdnn": round(sdnn, 1),
        # Le stress se lit dans la variabilite, pas dans la frequence : un RMSSD eleve
        # signe un systeme nerveux detendu, un RMSSD effondre signe la tension.
        "stress": round(max(0.0, min(1.0, 1.0 - rmssd / RMSSD_DETENDU_MS)), 3),
    }


def conclure(conn, session):
    """Ferme la session, écrit le relevé au dossier du membre, rend le résultat."""
    db.fermer_audit(conn, session["id"])
    intervalles = [b["intervalle"] for b in db.battements(conn, session["id"])
                   if INTERVALLE_MIN_MS <= b["intervalle"] <= INTERVALLE_MAX_MS]

    if len(intervalles) < 3:
        return {"crew": session["crew"], "battements": len(intervalles),
                "erreur": "aucun battement exploitable : poser le doigt à plat sur le "
                          "capteur, sans appuyer, et ne plus bouger"}

    mesure = _mesurer(intervalles)
    resultat = {
        "crew": session["crew"],
        "battements": len(intervalles),
        "secondes": round(time.time() - session["debut"], 1),
        "fiable": len(intervalles) >= BATTEMENTS_MIN,
        "ts": time.time(),
        **mesure,
    }

    if session["crew"]:
        conn.execute(
            "INSERT OR REPLACE INTO vitals (crew, ts, hr, rmssd, sdnn, stress)"
            " VALUES (?,?,?,?,?,?)",
            (session["crew"], time.time(), mesure["hr"], mesure["rmssd"],
             mesure["sdnn"], mesure["stress"]))
        conn.commit()
        db.journaliser(
            conn, "identification",
            f"audit cardiaque : {mesure['hr']} bpm, RMSSD {mesure['rmssd']:.0f} ms "
            f"sur {len(intervalles)} battements"
            + ("" if resultat["fiable"] else ", mesure indicative"),
            acteur="atria", sujet=session["crew"], donnees=mesure)
    return resultat


_dernier = None


def etat(conn):
    """État courant de l'audit, en concluant la session si sa fenêtre est écoulée."""
    global _dernier

    session = db.audit_actif(conn)
    if session and time.time() - session["debut"] >= session["duree"]:
        _dernier = conclure(conn, session)
        session = None

    if session is None:
        precedent = db.dernier_audit(conn)
        return {
            "actif": False, "crew": None, "battements": 0, "reste_s": 0,
            "duree_s": DUREE_DEFAUT_S, "hr_courant": None,
            "arme": bool(precedent and precedent["arme"]),
            "resultat": _dernier,
        }

    intervalles = [b["intervalle"] for b in db.battements(conn, session["id"])
                   if INTERVALLE_MIN_MS <= b["intervalle"] <= INTERVALLE_MAX_MS]
    return {
        "actif": True,
        "crew": session["crew"],
        "battements": len(intervalles),
        "reste_s": round(max(0.0, session["duree"] - (time.time() - session["debut"])), 1),
        "duree_s": session["duree"],
        "hr_courant": (round(60000.0 / statistics.mean(intervalles))
                       if len(intervalles) >= 2 else None),
        "arme": bool(session["arme"]),
        "resultat": _dernier,
    }
