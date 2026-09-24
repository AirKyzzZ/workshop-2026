import json

import pytest

from atria import chat, llm, modules


class FauxeReponseHTTP:
    def __init__(self, obj):
        self._data = json.dumps(obj).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, *_a):
        return self._data


def _repondre_avec(monkeypatch, texte):
    monkeypatch.setattr(llm, "ACTIF", True)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    paquet = {"choices": [{"message": {"content": texte}}]}
    monkeypatch.setattr(llm.urllib.request, "urlopen",
                        lambda *a, **k: FauxeReponseHTTP(paquet))


def test_chiffres_inventes_detecte_un_nombre_absent_du_releve():
    releve = "température: 23.5 °C\nhumidité: 40 %"
    reponse = "Il fait 23.5 °C et 99 % d'humidité."
    assert llm.chiffres_inventes(reponse, releve) == ["99"]


def test_chiffres_inventes_ignore_une_notation_differente_du_meme_nombre():
    releve = "température: 23.50 °C"
    reponse = "Il fait 23,5 °C."
    assert llm.chiffres_inventes(reponse, releve) == []


def test_chiffres_inventes_rend_vide_quand_tout_est_couvert():
    releve = "niveau sonore: 61 dB"
    reponse = "61 dB, rien d'autre."
    assert llm.chiffres_inventes(reponse, releve) == []


def test_causalite_detecte_les_connecteurs_de_cause():
    assert llm.causalite("Pas de fumée, car le niveau sonore est de 43 dB.") == ["car"]
    assert llm.causalite("Il fait chaud donc humide.") == ["donc"]


def test_causalite_absente_ne_declenche_rien():
    assert llm.causalite("Il fait 23.5 °C, pour 41 % d'humidité.") == []


def test_lexique_absent_desactive_le_garde_de_mots(monkeypatch):
    monkeypatch.setattr(llm, "_lexique", None)
    monkeypatch.setattr(llm, "LEXIQUE", "/inexistant/francais.txt")
    assert llm.lexique() == frozenset()
    assert llm.mots_inventes("plusau est present", "moreau est present") == []


def test_mots_inventes_detecte_un_mot_hors_releve_et_hors_lexique(monkeypatch):
    monkeypatch.setattr(llm, "lexique", lambda: frozenset({"present", "est", "moreau"}))
    releve = "occupants: moreau"
    reponse = "plusau est present"
    assert llm.mots_inventes(reponse, releve) == ["plusau"]


def test_mots_inventes_accepte_un_mot_du_releve(monkeypatch):
    monkeypatch.setattr(llm, "lexique", lambda: frozenset({"present"}))
    releve = "occupants: moreau"
    reponse = "moreau est present"
    assert llm.mots_inventes(reponse, releve) == []


def test_reformuler_est_desactive_par_defaut():
    assert llm.ACTIF is False
    assert llm.reformuler("quelle température ?", {"température": "23.5 °C"}) is None


def test_reformuler_desactive_si_le_module_est_desarme(monkeypatch):
    monkeypatch.setattr(llm, "ACTIF", True)
    monkeypatch.setattr(modules, "actif", lambda nom: False)
    assert llm.reformuler("q", {"a": "b"}) is None


def test_reformuler_accepte_une_reponse_conforme(monkeypatch):
    texte = "Il fait 23.5 °C."
    _repondre_avec(monkeypatch, texte)
    resultat = llm.reformuler("quelle température ?", {"température": "23.5 °C"})
    assert resultat == texte


def test_reformuler_rejette_un_nombre_invente(monkeypatch):
    _repondre_avec(monkeypatch, "Il fait 99.0 °C.")
    resultat = llm.reformuler("quelle température ?", {"température": "23.5 °C"})
    assert resultat is None


def test_reformuler_rejette_un_connecteur_de_cause(monkeypatch):
    _repondre_avec(monkeypatch, "Il fait 23.5 °C car il fait beau.")
    resultat = llm.reformuler("quelle température ?", {"température": "23.5 °C"})
    assert resultat is None


def test_reformuler_rejette_un_mot_invente(monkeypatch):
    monkeypatch.setattr(llm, "lexique", lambda: frozenset({"fait", "chaud", "beau"}))
    _repondre_avec(monkeypatch, "Il fait treschaud.")
    resultat = llm.reformuler("quelle température ?", {"température": "23.5 °C"})
    assert resultat is None


def test_reformuler_rejette_un_nom_interdit(monkeypatch):
    _repondre_avec(monkeypatch, "martin est present.")
    resultat = llm.reformuler("qui est present ?", {"occupants": "moreau"},
                              interdits=("martin",))
    assert resultat is None


def test_reformuler_rend_none_si_le_serveur_ne_repond_pas(monkeypatch):
    monkeypatch.setattr(llm, "ACTIF", True)
    monkeypatch.setattr(modules, "actif", lambda nom: True)

    def _echoue(*_a, **_k):
        raise OSError("connexion refusee")
    monkeypatch.setattr(llm.urllib.request, "urlopen", _echoue)
    assert llm.reformuler("q", {"a": "b"}) is None


def test_disponible_rend_faux_si_le_serveur_ne_repond_pas(monkeypatch):
    def _echoue(*_a, **_k):
        raise OSError("connexion refusee")
    monkeypatch.setattr(llm.urllib.request, "urlopen", _echoue)
    assert llm.disponible() is False


def test_catalogue_des_outils_ne_contient_aucun_outil_d_ecriture():
    outils = chat.catalogue()
    assert outils
    assert all(o["ecriture"] is False for o in outils)


def test_toutes_les_implementations_sont_declarees_dans_le_catalogue():
    assert set(chat.IMPLEMENTATIONS) == set(chat.OUTILS)
