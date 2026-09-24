import json
import os
import subprocess
import sys
import types
from pathlib import Path

if "lgpio" not in sys.modules:
    sys.modules["lgpio"] = types.ModuleType("lgpio")
_lgpio = sys.modules["lgpio"]
_lgpio.SET_PULL_UP = getattr(_lgpio, "SET_PULL_UP", 0)
_lgpio.gpiochip_open = getattr(_lgpio, "gpiochip_open", lambda chip: 0)
_lgpio.gpio_claim_input = getattr(_lgpio, "gpio_claim_input", lambda *a, **k: None)
_lgpio.gpio_read = getattr(_lgpio, "gpio_read", lambda *a, **k: 1)
_lgpio.gpio_free = getattr(_lgpio, "gpio_free", lambda *a, **k: None)
_lgpio.gpiochip_close = getattr(_lgpio, "gpiochip_close", lambda *a, **k: None)

if "vosk" not in sys.modules:
    sys.modules["vosk"] = types.ModuleType("vosk")
_vosk = sys.modules["vosk"]
if not hasattr(_vosk, "KaldiRecognizer"):
    _vosk.KaldiRecognizer = lambda *a, **k: None
if not hasattr(_vosk, "Model"):
    _vosk.Model = lambda *a, **k: None
if not hasattr(_vosk, "SetLogLevel"):
    _vosk.SetLogLevel = lambda *a, **k: None

# contournement du bug atria/theme.py:55-61, voir test_theme_est_importable_...
_existe_reel = os.path.exists


def _existe_avec_polices_truquees(chemin):
    if "/usr/share/fonts" in str(chemin):
        return True
    return _existe_reel(chemin)


os.path.exists = _existe_avec_polices_truquees
try:
    from atria import terminal
finally:
    os.path.exists = _existe_reel

import pytest


class FauxeReponseHTTP:
    def __init__(self, obj):
        self._data = json.dumps(obj).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, *_a):
        return self._data


class Avale:
    def __getattr__(self, _nom):
        return self

    def __call__(self, *_a, **_k):
        return None


class FausseLien:
    def __init__(self):
        self.beeps = []
        self.temp_c = None
        self.humidite = None
        self.mic = 0
        self.mq2 = 0

    def beep(self, motif="OK"):
        self.beeps.append(motif)


@pytest.fixture(autouse=True)
def _polices_neutres(monkeypatch):
    monkeypatch.setattr(terminal.ui, "font", lambda chemin, taille: None)


def _terminal(etat, lien=None, ecran=None):
    t = terminal.Terminal.__new__(terminal.Terminal)
    t.etat = etat
    t.ecran = ecran or Avale()
    t.lien = lien or FausseLien()
    t.vue = "accueil"
    t.retour = "accueil"
    t.curseur = 0
    t.defilement = 0
    t.selection = None
    t.identite = (None, False)
    t.badge_jusqua = 0.0
    t.badge_info = None
    t.dialogue = None
    return t


def test_porteur_rend_non_identifie_par_defaut(etat):
    t = _terminal(etat)
    assert t.porteur() == "NON IDENTIFIE"


def test_porteur_rend_le_nom_en_majuscules(etat):
    t = _terminal(etat)
    t.identite = ("moreau", False)
    assert t.porteur() == "MOREAU"


def test_lignes_menu_rend_les_sections(etat):
    t = _terminal(etat)
    t.vue = "menu"
    assert t.lignes() == terminal.SECTIONS


def test_lignes_equipage_rend_les_membres_de_l_etat(etat):
    t = _terminal(etat)
    t.vue = "equipage"
    assert [nom for nom, _ in t.lignes()] == [c.nom for c in etat.equipage]


def test_lignes_alertes_delegue_a_l_etat(etat):
    t = _terminal(etat)
    t.vue = "alertes"
    assert t.lignes() == etat.alertes()


def test_lignes_vue_inconnue_rend_une_liste_vide(etat):
    t = _terminal(etat)
    t.vue = "autrechose"
    assert t.lignes() == []


def test_revenir_depuis_badge_retourne_a_la_vue_precedente_sans_reinitialiser(etat):
    t = _terminal(etat)
    t.vue = "badge"
    t.retour = "dialogue"
    t.curseur = 3
    t.revenir()
    assert t.vue == "dialogue"
    assert t.curseur == 3


def test_revenir_depuis_fiche_va_a_equipage_et_reinitialise_le_curseur(etat):
    t = _terminal(etat)
    t.vue = "fiche"
    t.curseur = 4
    t.defilement = 2
    t.revenir()
    assert t.vue == "equipage"
    assert t.curseur == 0
    assert t.defilement == 0


def test_revenir_depuis_accueil_ne_fait_rien(etat):
    t = _terminal(etat)
    t.vue = "accueil"
    t.revenir()
    assert t.vue == "accueil"


def test_valider_depuis_badge_retourne_a_la_vue_precedente(etat):
    t = _terminal(etat)
    t.vue = "badge"
    t.retour = "fiche"
    t.valider()
    assert t.vue == "fiche"


def test_valider_depuis_accueil_ouvre_le_menu(etat):
    t = _terminal(etat)
    t.vue = "accueil"
    t.valider()
    assert (t.vue, t.curseur, t.defilement) == ("menu", 0, 0)


def test_valider_depuis_menu_ouvre_la_section_selectionnee(etat):
    t = _terminal(etat)
    t.vue = "menu"
    t.curseur = 1
    t.valider()
    assert t.vue == terminal.SECTIONS[1][0]
    assert t.curseur == 0


def test_valider_depuis_equipage_selectionne_le_membre_et_ouvre_la_fiche(etat):
    t = _terminal(etat)
    t.vue = "equipage"
    t.curseur = 0
    t.valider()
    assert t.vue == "fiche"
    assert t.selection is etat.equipage[0]


def test_valider_depuis_fiche_revient_au_menu(etat):
    t = _terminal(etat)
    t.vue = "fiche"
    t.valider()
    assert (t.vue, t.curseur, t.defilement) == ("menu", 0, 0)


def test_controle_facial_sans_gabarit_autorise_le_badge_seul(etat):
    t = _terminal(etat)
    accorde, score, motif = t.controle_facial("moreau")
    assert accorde is True
    assert score is None
    assert "aucun gabarit" in motif
    ligne = etat.conn.execute(
        "SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone()
    assert ligne["type"] == "identification"


def test_controle_facial_interroge_l_api_quand_un_gabarit_existe(etat, monkeypatch):
    t = _terminal(etat)
    monkeypatch.setattr(terminal.visage, "disponible", lambda: True)
    monkeypatch.setattr(terminal.db, "gabarits", lambda conn, nom: [[0.1] * 128])
    reponse = {"accorde": True, "score": 0.91, "motif": "visage reconnu"}
    monkeypatch.setattr(terminal.urllib.request, "urlopen",
                        lambda *a, **k: FauxeReponseHTTP(reponse))

    accorde, score, motif = t.controle_facial("moreau")
    assert accorde is True
    assert score == 0.91
    assert motif == "visage reconnu"


def test_controle_facial_ne_verrouille_pas_si_l_api_est_indisponible(etat, monkeypatch):
    t = _terminal(etat)
    monkeypatch.setattr(terminal.visage, "disponible", lambda: True)
    monkeypatch.setattr(terminal.db, "gabarits", lambda conn, nom: [[0.1] * 128])

    def _echoue(*_a, **_k):
        raise OSError("timeout")
    monkeypatch.setattr(terminal.urllib.request, "urlopen", _echoue)

    accorde, score, motif = t.controle_facial("moreau")
    assert accorde is True
    assert score is None
    assert "controle indisponible" in motif


def test_sur_badge_inconnu_refuse_et_ne_change_pas_l_identite(etat):
    t = _terminal(etat)
    t.sur_badge("00000000")
    assert t.identite == (None, False)
    assert t.lien.beeps == ["DENY"]
    assert t.vue == "badge"


def test_sur_badge_connu_avec_controle_facial_accorde_ouvre_la_session(etat, monkeypatch):
    t = _terminal(etat)
    monkeypatch.setattr(t, "controle_facial", lambda nom: (True, 0.9, "ok"))
    t.sur_badge("FC2A1B17")
    assert t.identite == ("moreau", False)
    assert t.lien.beeps == ["LISTEN", "OK"]
    session = terminal.db.session(etat.conn)
    assert session["acteur"] == "moreau"


def test_sur_badge_connu_refuse_par_le_controle_facial_ferme_la_session(etat, monkeypatch):
    t = _terminal(etat)
    terminal.db.ouvrir_session(etat.conn, "moreau", "equipage")
    monkeypatch.setattr(t, "controle_facial", lambda nom: (False, 0.1, "non reconnu"))
    t.sur_badge("FC2A1B17")
    assert t.identite == (None, False)
    assert t.lien.beeps == ["LISTEN", "DENY"]
    session = terminal.db.session(etat.conn)
    assert session["acteur"] is None


def test_ingerer_ignore_sans_mesure_de_temperature(etat):
    t = _terminal(etat)
    t.lien.temp_c = None
    t.ingerer()


def test_ingerer_enregistre_l_ambiance_locale(etat):
    t = _terminal(etat)
    t.lien.temp_c = 22.5
    t.lien.humidite = 41.0
    t.lien.mic = 10
    t.lien.mq2 = 20
    t.ingerer()
    ligne = etat.conn.execute(
        "SELECT * FROM ambiance WHERE compartiment=? ORDER BY ts DESC LIMIT 1",
        (terminal.COMPARTIMENT_LOCAL,)).fetchone()
    assert ligne["temp_c"] == 22.5
    assert ligne["humidite"] == 41.0


@pytest.mark.xfail(strict=True, reason="atria/theme.py:55-61 leve FileNotFoundError a "
                    "l'import si aucune police de /usr/share/fonts/... n'existe, ce qui "
                    "rend atria.terminal et atria.ui inimportables hors du Pi provisionne")
def test_theme_est_importable_sans_les_polices_atria_installees():
    racine = Path(__file__).resolve().parents[2]
    sans_polices = ("import os\n"
                    "existe = os.path.exists\n"
                    "os.path.exists = lambda p: False if str(p).startswith('/usr/share/fonts') "
                    "else existe(p)\n"
                    "import atria.theme\n")
    resultat = subprocess.run([sys.executable, "-c", sans_polices],
                              cwd=str(racine), capture_output=True, text=True)
    assert resultat.returncode == 0, resultat.stderr
