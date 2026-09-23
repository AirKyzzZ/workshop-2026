"""Modules coûteux, armés à la demande et désarmés tout seuls.

Le SoC de cette carte repose à cinquante-quatre degrés sans refroidissement actif et
n'accepte qu'une petite dizaine de degrés de charge avant que ses fréquences ne soient
bridées. Faire tourner en permanence la détection de visage, la géométrie des mains, la
classification sonore et la transcription du français revient à dépenser ce budget sans
rien regarder : la plupart du temps il n'y a personne devant l'objectif.

Chaque module s'arme donc pour une durée, et se désarme seul à l'échéance. Oublier d'en
éteindre un ne coûte rien, ce qui est la seule façon réaliste de tenir un budget thermique
pendant une démonstration où l'on a autre chose à surveiller.

Le badge et la reconnaissance faciale ne figurent pas ici : ils gardent la porte, et une
porte qui s'arme à la demande ne garde rien.
"""

import time

DUREE_DEFAUT_MIN = 5

DEFINITIONS = {
    "surveillance": {
        "libelle": "Surveillance comportementale",
        "detail": "MediaPipe visage et mains, une image par seconde",
        "cout": "élevé",
    },
    "ecoute": {
        "libelle": "Écoute du bord",
        "detail": "YAMNet, 521 classes sonores par fenêtre de trois secondes",
        "cout": "faible",
    },
    "transcription": {
        "libelle": "Transcription du français",
        "detail": "Vosk, uniquement quand YAMNet entend de la parole",
        "cout": "moyen",
    },
    "modele": {
        "libelle": "Modèle de langage",
        "detail": "Qwen 1.5B local, console et reformulation du briefing",
        "cout": "élevé",
    },
}

_etats = {nom: {"actif": False, "expire": None} for nom in DEFINITIONS}


def armer(nom, minutes=DUREE_DEFAUT_MIN):
    if nom not in _etats:
        return None
    _etats[nom] = {"actif": True, "expire": time.time() + minutes * 60}
    return etat(nom)


def desarmer(nom):
    if nom not in _etats:
        return None
    _etats[nom] = {"actif": False, "expire": None}
    return etat(nom)


def actif(nom):
    """Vrai si le module est armé et pas encore arrivé à échéance."""
    e = _etats.get(nom)
    if not e or not e["actif"]:
        return False
    if e["expire"] and time.time() >= e["expire"]:
        _etats[nom] = {"actif": False, "expire": None}
        return False
    return True


def etat(nom):
    e = _etats[nom]
    reste = None
    if e["actif"] and e["expire"]:
        reste = max(0, round(e["expire"] - time.time()))
    return {"nom": nom, "actif": actif(nom), "reste_s": reste, **DEFINITIONS[nom]}


def tous():
    return [etat(nom) for nom in DEFINITIONS]
