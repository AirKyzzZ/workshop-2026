import json
import sys
import types

if "vosk" not in sys.modules:
    sys.modules["vosk"] = types.ModuleType("vosk")
_vosk = sys.modules["vosk"]
if not hasattr(_vosk, "KaldiRecognizer"):
    _vosk.KaldiRecognizer = lambda *a, **k: None
if not hasattr(_vosk, "Model"):
    _vosk.Model = lambda *a, **k: None
if not hasattr(_vosk, "SetLogLevel"):
    _vosk.SetLogLevel = lambda *a, **k: None

from atria import voice


def test_grammaire_inclut_le_vocabulaire_de_l_etat(etat):
    mots = json.loads(voice.grammaire(etat))
    noms = {c.nom for c in etat.equipage}
    postes = {p.nom for p in etat.postes}
    comps = {c.nom for c in etat.compartiments}

    assert mots[-1] == "[unk]"
    assert mots[:-1] == sorted(mots[:-1])
    assert noms <= set(mots)
    assert postes <= set(mots)
    assert comps <= set(mots)


def test_interpreter_sans_mots_rend_une_reponse_non_acceptee(etat):
    reponse = voice.interpreter(etat, "", capitaine=False)
    assert reponse.accepte is False
    assert reponse.titre == "AUCUNE COMMANDE"


def test_interpreter_sans_mot_reconnu_rend_commande_inconnue(etat):
    reponse = voice.interpreter(etat, "bla bla bla", capitaine=False)
    assert reponse.accepte is False
    assert reponse.titre == "COMMANDE INCONNUE"


def test_interpreter_avec_affecte_nom_et_poste_route_vers_affecter(etat, monkeypatch):
    sentinelle = object()
    monkeypatch.setattr(voice.regulator, "affecter",
                        lambda e, nom, poste: sentinelle)
    nom = next(iter({c.nom for c in etat.equipage}))
    poste = next(iter({p.nom for p in etat.postes}))
    reponse = voice.interpreter(etat, f"affecte {nom} au poste {poste}", capitaine=False)
    assert reponse is sentinelle


def test_interpreter_avec_qui_et_poste_route_vers_qui_peut(etat, monkeypatch):
    sentinelle = object()
    monkeypatch.setattr(voice.regulator, "qui_peut", lambda e, poste: sentinelle)
    poste = next(iter({p.nom for p in etat.postes}))
    reponse = voice.interpreter(etat, f"qui peut tenir le poste {poste}", capitaine=False)
    assert reponse is sentinelle


def test_interpreter_avec_situation_route_vers_situation(etat, monkeypatch):
    sentinelle = object()
    monkeypatch.setattr(voice.regulator, "situation", lambda e: sentinelle)
    reponse = voice.interpreter(etat, "donne la situation", capitaine=False)
    assert reponse is sentinelle


def test_interpreter_priorise_le_nom_sur_le_poste_seul(etat, monkeypatch):
    sentinelle_membre = object()
    monkeypatch.setattr(voice.regulator, "etat_membre",
                        lambda e, nom, capitaine: sentinelle_membre)
    monkeypatch.setattr(voice.regulator, "qui_peut",
                        lambda e, poste: (_ for _ in ()).throw(
                            AssertionError("qui_peut ne doit pas etre appele")))
    nom = next(iter({c.nom for c in etat.equipage}))
    poste = next(iter({p.nom for p in etat.postes}))
    reponse = voice.interpreter(etat, f"{nom} {poste}", capitaine=False)
    assert reponse is sentinelle_membre


def test_interpreter_avec_poste_seul_route_vers_qui_peut(etat, monkeypatch):
    sentinelle = object()
    monkeypatch.setattr(voice.regulator, "qui_peut", lambda e, poste: sentinelle)
    poste = next(iter({p.nom for p in etat.postes}))
    reponse = voice.interpreter(etat, poste, capitaine=False)
    assert reponse is sentinelle
