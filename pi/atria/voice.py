import io
import json
import os
import re
import wave

from vosk import KaldiRecognizer, Model, SetLogLevel

import console

from . import model, regulator

MODEL_DIR = os.path.expanduser("~/atria/models/vosk/vosk-model-small-fr-0.22")
RATE = 16000
LEAD_IN = 1.2

MOTS_OUTILS = ["etat", "état", "de", "qui", "peut", "tenir", "le", "la", "au", "a",
               "poste", "affecte", "situation", "statut", "rapport",
               "équipage", "alerte", "montre", "donne", "liste"]

_model = None


def charger():
    global _model
    if _model is None:
        SetLogLevel(-1)
        _model = Model(MODEL_DIR)
    return _model


def grammaire(etat):
    mots = set(MOTS_OUTILS)
    mots.update(c.nom for c in etat.equipage)
    mots.update(p.nom for p in etat.postes)
    mots.update(c.nom for c in etat.compartiments)
    return json.dumps(sorted(mots) + ["[unk]"], ensure_ascii=False)


def ecouter(etat, secondes=5.0):
    audio = console.listen(seconds=secondes + LEAD_IN, rate=RATE)
    with wave.open(io.BytesIO(audio)) as w:
        frames = w.readframes(w.getnframes())
        rate = w.getframerate()

    rec = KaldiRecognizer(charger(), rate, grammaire(etat))
    rec.AcceptWaveform(frames)
    texte = json.loads(rec.FinalResult()).get("text", "").strip()
    return re.sub(r"\s*\[unk\]\s*", " ", texte).strip()


def interpreter(etat, texte, capitaine=False):
    mots = texte.split()
    if not mots:
        return regulator.Reponse("Je n ai pas compris.", "AUCUNE COMMANDE",
                                 "repete plus pres du micro", False)

    noms = {c.nom for c in etat.equipage}
    postes = {p.nom for p in etat.postes}
    nom = next((m for m in mots if m in noms), None)
    poste = next((m for m in mots if m in postes), None)

    if "affecte" in mots and nom and poste:
        return regulator.affecter(etat, nom, poste)
    if "qui" in mots or ("peut" in mots and poste):
        if poste:
            return regulator.qui_peut(etat, poste)
    if "situation" in mots or "rapport" in mots or "statut" in mots:
        return regulator.situation(etat)
    if nom:
        return regulator.etat_membre(etat, nom, capitaine)
    if poste:
        return regulator.qui_peut(etat, poste)

    return regulator.Reponse(f"Commande non reconnue: {texte}.", "COMMANDE INCONNUE", texte, False)


def repondre(reponse):
    console.say(reponse.parole)
