import json
import types

import pytest

from atria import ecoute, modules


class Horloge:
    def __init__(self, t):
        self.t = t

    def time(self):
        return self.t


class FauxVosk:
    def __init__(self, texte):
        self._texte = texte

    def AcceptWaveform(self, _brut):
        return True

    def FinalResult(self):
        return json.dumps({"text": self._texte})

    def Reset(self):
        pass


def _classe(nom, score):
    return types.SimpleNamespace(category_name=nom, score=score)


def _resultat(categories):
    classification = types.SimpleNamespace(
        categories=[_classe(n, s) for n, s in categories])
    return [types.SimpleNamespace(classifications=[classification])]


def test_disponible_rend_faux_sans_modele_installe():
    assert ecoute.disponible() is False


def test_fond_initial_prend_le_premier_niveau(conn):
    e = ecoute.Ecoute(conn)
    e.niveau = 0.02
    e._suivre_fond()
    assert e._fond == 0.02


def test_fond_ignore_un_pic_au_dessus_du_multiple_cri(conn):
    e = ecoute.Ecoute(conn)
    e._fond = 0.02
    e.niveau = 0.02 * ecoute.MULTIPLE_CRI + 0.01
    e._suivre_fond()
    assert e._fond == 0.02


def test_fond_suit_lentement_les_niveaux_sous_le_seuil(conn):
    e = ecoute.Ecoute(conn)
    e._fond = 0.02
    e.niveau = 0.03
    e._suivre_fond()
    assert e._fond == pytest.approx(0.9 * 0.02 + 0.1 * 0.03)


def test_crie_faux_sans_fond_mesure(conn):
    e = ecoute.Ecoute(conn)
    e.niveau = 1.0
    assert e.crie() is False


def test_crie_vrai_au_dessus_du_multiple_et_du_plancher(conn):
    e = ecoute.Ecoute(conn)
    e._fond = 0.02
    e.niveau = 0.02 * ecoute.MULTIPLE_CRI + 0.001
    assert e.crie() is True


def test_crie_faux_sous_le_plancher_malgre_un_fond_tres_bas(conn):
    e = ecoute.Ecoute(conn)
    e._fond = 0.001
    e.niveau = e._fond * ecoute.MULTIPLE_CRI + 0.0001
    assert e.niveau < ecoute.NIVEAU_CRI_MIN
    assert e.crie() is False


def test_parle_faux_si_transcription_desarmee(conn, monkeypatch):
    e = ecoute.Ecoute(conn)
    monkeypatch.setattr(modules, "actif", lambda nom: False)
    e.niveau = 0.1
    e.classes = [{"nom": "Speech", "score": 0.9}]
    assert e._parle() is False


def test_parle_faux_sous_le_plancher_de_niveau(conn, monkeypatch):
    e = ecoute.Ecoute(conn)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    e.niveau = ecoute.NIVEAU_PAROLE_MIN - 0.001
    e.classes = [{"nom": "Speech", "score": 0.9}]
    assert e._parle() is False


def test_parle_vrai_avec_une_classe_de_parole_au_dessus_du_seuil(conn, monkeypatch):
    e = ecoute.Ecoute(conn)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    e.niveau = 0.1
    e.classes = [{"nom": "Speech", "score": ecoute.SEUIL_PAROLE}]
    assert e._parle() is True


def test_parle_faux_sans_classe_de_parole_correspondante(conn, monkeypatch):
    e = ecoute.Ecoute(conn)
    monkeypatch.setattr(modules, "actif", lambda nom: True)
    e.niveau = 0.1
    e.classes = [{"nom": "Dog barking", "score": 0.99}]
    assert e._parle() is False


def test_injure_repetee_dans_la_fenetre_de_repos_ne_compte_qu_une_fois(conn, monkeypatch):
    e = ecoute.Ecoute(conn)
    horloge = Horloge(1000.0)
    monkeypatch.setattr(ecoute, "time", horloge)

    e._injurier("connard", 0.35, "espece de connard")
    assert e.compteur == 1

    horloge.t = 1000.0 + ecoute.REPOS_EVENEMENT_S - 1
    e._injurier("connard", 0.35, "connard encore")
    assert e.compteur == 1

    horloge.t = 1000.0 + ecoute.REPOS_EVENEMENT_S + 1
    e._injurier("connard", 0.35, "connard une troisieme fois")
    assert e.compteur == 2


def test_insulte_est_distinguee_de_la_menace(conn):
    e = ecoute.Ecoute(conn)
    e._injurier("connard", 0.35, "espece de connard")
    ligne = conn.execute("SELECT type FROM incident ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["type"] == "insulte"


def test_menace_est_distinguee_de_l_insulte(conn):
    e = ecoute.Ecoute(conn)
    e._injurier("je vais te tuer", 0.90, "je vais te tuer")
    ligne = conn.execute("SELECT type FROM incident ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["type"] == "menace"


def test_transcrire_retient_le_mot_le_plus_grave_de_la_phrase(conn):
    e = ecoute.Ecoute(conn)
    e._vosk = FauxVosk("putain je vais te tuer")
    e._transcrire(b"")
    assert e.transcription == "putain je vais te tuer"
    ligne = conn.execute("SELECT type FROM incident ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["type"] == "menace"


def test_transcrire_sans_vosk_ne_fait_rien(conn):
    e = ecoute.Ecoute(conn)
    e._vosk = None
    e._transcrire(b"peu importe")
    assert e.transcription == ""


def test_transcrire_sans_mot_du_lexique_ne_cree_pas_d_incident(conn):
    e = ecoute.Ecoute(conn)
    e._vosk = FauxVosk("bonjour tout le monde")
    e._transcrire(b"")
    assert e.transcription == "bonjour tout le monde"
    n = conn.execute("SELECT COUNT(*) AS n FROM incident").fetchone()["n"]
    assert n == 0


def test_traiter_retient_les_cinq_meilleures_classes(conn):
    e = ecoute.Ecoute(conn)
    categories = [("A", 0.9), ("B", 0.8), ("C", 0.7), ("D", 0.6), ("E", 0.5), ("F", 0.4)]
    e._traiter(_resultat(categories))
    assert [c["nom"] for c in e.classes] == ["A", "B", "C", "D", "E"]


def test_traiter_emet_une_toux_quand_la_classe_depasse_le_seuil(etat):
    e = ecoute.Ecoute(etat.conn, compartiment="infirmerie")
    e._traiter(_resultat([("Cough", ecoute.SEUIL_CLASSE + 0.1)]))
    n = etat.conn.execute("SELECT COUNT(*) AS n FROM symptome").fetchone()["n"]
    assert n == 1


def test_traiter_ignore_une_classe_sous_le_seuil(etat):
    e = ecoute.Ecoute(etat.conn, compartiment="infirmerie")
    e._traiter(_resultat([("Cough", ecoute.SEUIL_CLASSE - 0.1)]))
    n = etat.conn.execute("SELECT COUNT(*) AS n FROM symptome").fetchone()["n"]
    assert n == 0


def test_traiter_emet_un_cri_par_le_niveau_sans_etiquette_yamnet(etat, monkeypatch):
    e = ecoute.Ecoute(etat.conn, compartiment="infirmerie")
    e._fond = 0.02
    e.niveau = 0.02 * ecoute.MULTIPLE_CRI + 0.01
    e._traiter(_resultat([("Dog barking", 0.9)]))
    n = etat.conn.execute(
        "SELECT COUNT(*) AS n FROM incident WHERE type='cri'").fetchone()["n"]
    assert n == 1


def test_emettre_respecte_le_repos_par_famille(etat, monkeypatch):
    e = ecoute.Ecoute(etat.conn, compartiment="infirmerie")
    horloge = Horloge(1000.0)
    monkeypatch.setattr(ecoute, "time", horloge)

    e._emettre("toux", "Cough", 0.9)
    assert e.compteur == 1

    horloge.t = 1000.0 + ecoute.REPOS_EVENEMENT_S - 1
    e._emettre("toux", "Cough", 0.9)
    assert e.compteur == 1

    horloge.t = 1000.0 + ecoute.REPOS_EVENEMENT_S + 1
    e._emettre("toux", "Cough", 0.9)
    assert e.compteur == 2
