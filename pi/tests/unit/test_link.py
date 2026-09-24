import queue
import threading

from atria import link


class FausseSerie:
    def __init__(self, lignes, stop):
        self._lignes = list(lignes)
        self._stop = stop
        self.ecrits = []

    def readline(self):
        if self._lignes:
            return self._lignes.pop(0)
        self._stop.set()
        return b""

    def write(self, data):
        self.ecrits.append(data)


def _link(lignes):
    l = link.Link.__new__(link.Link)
    l.evenements = queue.Queue(maxsize=64)
    l.mic = 0
    l.mq2 = 0
    l.temp_c = None
    l.humidite = None
    l.connecte = False
    l._port = "test"
    l._baud = link.BAUD
    l._stop = threading.Event()
    l._serie = FausseSerie(lignes, l._stop)
    l._verrou = threading.Lock()
    return l


def test_resoudre_port_priorise_la_signature_usb(monkeypatch):
    candidats = ["/dev/serial/by-id/usb-Arduino_Mega_ADK_0044-if00",
                 "/dev/serial/by-id/usb-autre-carte"]
    monkeypatch.setattr(link.glob, "glob", lambda motif: candidats)
    assert link.resoudre_port() == "/dev/serial/by-id/usb-Arduino_Mega_ADK_0044-if00"


def test_resoudre_port_rend_le_defaut_si_rien_ne_correspond(monkeypatch):
    monkeypatch.setattr(link.glob, "glob", lambda motif: ["/dev/serial/by-id/usb-autre"])
    assert link.resoudre_port(defaut="/dev/ttyACM3") == "/dev/ttyACM3"


def test_sense_met_a_jour_micro_mq2_temperature_humidite():
    l = _link([b"SENSE 120 45 235 410\n"])
    l._boucle()
    assert l.mic == 120
    assert l.mq2 == 45
    assert l.temp_c == 23.5
    assert l.humidite == 41.0


def test_sense_avec_sonde_en_defaut_laisse_la_temperature_absente():
    l = _link([b"SENSE 120 45 -9999 -9999\n"])
    l._boucle()
    assert l.mic == 120
    assert l.mq2 == 45
    assert l.temp_c is None
    assert l.humidite is None


def test_sense_court_ne_touche_pas_la_temperature():
    l = _link([b"SENSE 5 6\n"])
    l._boucle()
    assert l.mic == 5
    assert l.mq2 == 6
    assert l.temp_c is None


def test_sense_invalide_est_ignoree_sans_lever():
    l = _link([b"SENSE abc def\n"])
    l._boucle()
    assert l.mic == 0
    assert l.mq2 == 0


def test_badge_publie_un_evenement():
    l = _link([b"BADGE FC2A1B17\n"])
    l._boucle()
    assert l.prochain() == ("badge", "FC2A1B17")
    assert l.prochain() is None


def test_ready_publie_un_evenement():
    l = _link([b"READY compartiment=passerelle\n"])
    l._boucle()
    assert l.prochain() == ("ready", "READY compartiment=passerelle")


def test_ligne_vide_est_ignoree():
    l = _link([b"\n", b"BADGE ABC\n"])
    l._boucle()
    assert l.prochain() == ("badge", "ABC")


def test_publier_abandonne_silencieusement_si_la_file_est_pleine():
    l = _link([])
    l.evenements = queue.Queue(maxsize=1)
    l._publier(("badge", "A"))
    l._publier(("badge", "B"))
    assert l.prochain() == ("badge", "A")
    assert l.prochain() is None


def test_beep_envoie_le_motif_par_defaut():
    l = _link([])
    l.beep()
    assert l._serie.ecrits == [b"BEEP OK\n"]


def test_beep_envoie_le_motif_demande():
    l = _link([])
    l.beep("DENY")
    assert l._serie.ecrits == [b"BEEP DENY\n"]


def test_beep_sans_port_ouvert_ne_leve_pas():
    l = _link([])
    l._serie = None
    l.beep()


def test_beep_marque_deconnecte_si_l_ecriture_echoue():
    l = _link([])
    l.connecte = True

    def _echoue(data):
        raise OSError("port ferme")
    l._serie.write = _echoue

    l.beep()
    assert l.connecte is False
    assert l._serie is None


def test_fermer_arrete_le_fil_et_ferme_le_port():
    l = _link([])
    l.fermer()
    assert l._stop.is_set() is True
