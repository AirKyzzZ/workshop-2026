import threading

import pytest

from atria import db, noeud


class Horloge:
    def __init__(self, t):
        self.t = t

    def time(self):
        return self.t


class FausseSerie:
    def __init__(self):
        self.ecrits = []

    def write(self, data):
        self.ecrits.append(data)


def _noeud(conn, compartiment=None, serie=None):
    n = noeud.Noeud.__new__(noeud.Noeud)
    n.port = "test"
    n.conn = conn
    n.compartiment = compartiment
    n.temp_c = None
    n.humidite = None
    n.vu_le = 0.0
    n.connecte = False
    n.inconnu = None
    n.erreur = None
    n._serie = serie
    n._prochaine_ecriture = 0.0
    n._prochain_ecran = 0.0
    n._ecran_pose = None
    n._prochain_pouls = 0.0
    n._audit = None
    n._stop = threading.Event()
    return n


def _avec_reacteur(conn):
    conn.execute("INSERT INTO compartiment (nom, ordre) VALUES ('réacteur', 0)")
    conn.commit()


def test_resoudre_compartiment_retire_les_accents_et_la_casse(conn):
    _avec_reacteur(conn)
    assert noeud.resoudre_compartiment(conn, "reacteur") == "réacteur"
    assert noeud.resoudre_compartiment(conn, "REACTEUR") == "réacteur"


def test_resoudre_compartiment_rend_none_si_inconnu(conn):
    _avec_reacteur(conn)
    assert noeud.resoudre_compartiment(conn, "cantine") is None


def test_ambiance_resout_le_compartiment_accentue_annonce_en_ascii(conn):
    _avec_reacteur(conn)
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("AMBIANCE reacteur 235 410")
    assert n.compartiment == "réacteur"
    assert n.temp_c == 23.5
    assert n.humidite == 41.0
    ligne = conn.execute(
        "SELECT * FROM ambiance WHERE compartiment='réacteur'").fetchone()
    assert ligne is not None


def test_ambiance_vers_compartiment_inconnu_est_signalee_sans_lever(conn):
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("AMBIANCE salleinconnue 235 410")
    assert n.inconnu == "salleinconnue"
    assert n.compartiment is None
    assert n.temp_c is None


def test_capteur_en_defaut_ne_met_pas_a_jour_la_mesure(conn):
    _avec_reacteur(conn)
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("AMBIANCE reacteur -9999 410")
    assert n.compartiment == "réacteur"
    assert n.temp_c is None
    assert n.vu_le == 0.0


def test_ready_annonce_un_compartiment_connu(conn):
    _avec_reacteur(conn)
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("READY compartiment=reacteur")
    assert n.compartiment == "réacteur"


def test_ready_avec_compartiment_non_resolu_garde_l_annonce_brute(conn):
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("READY compartiment=cantine")
    assert n.compartiment == "cantine"


def test_ready_ne_remplace_pas_un_compartiment_deja_connu(conn):
    _avec_reacteur(conn)
    n = _noeud(conn, compartiment="réacteur", serie=FausseSerie())
    n._traiter("READY compartiment=cantine")
    assert n.compartiment == "réacteur"


def test_ecran_confirme_declenche_confirmer_ecran(conn):
    _avec_reacteur(conn)
    db.poser_ecran(conn, "réacteur", "haut", "bas")
    n = _noeud(conn, compartiment="réacteur", serie=FausseSerie())
    n._traiter("ECRAN")
    ligne = conn.execute(
        "SELECT applique FROM ecran WHERE compartiment='réacteur'").fetchone()
    assert ligne["applique"] is not None


def test_ecran_sans_compartiment_connu_ne_leve_pas(conn):
    n = _noeud(conn, compartiment=None, serie=FausseSerie())
    n._traiter("ECRAN")


def test_battement_ignore_sans_audit_actif(conn):
    n = _noeud(conn, serie=FausseSerie())
    n._audit = None
    n._traiter("BATTEMENT 812 450")
    n_battements = conn.execute("SELECT COUNT(*) AS n FROM battement").fetchone()["n"]
    assert n_battements == 0


def test_battement_enregistre_avec_un_audit_actif(conn):
    audit = db.ouvrir_audit(conn, None, 60)
    n = _noeud(conn, serie=FausseSerie())
    n._audit = audit
    n._traiter("BATTEMENT 812 450")
    ligne = conn.execute(
        "SELECT * FROM battement WHERE audit = ?", (audit,)).fetchone()
    assert ligne["intervalle"] == 812
    assert ligne["amplitude"] == 450


def test_battement_sans_amplitude_est_accepte(conn):
    audit = db.ouvrir_audit(conn, None, 60)
    n = _noeud(conn, serie=FausseSerie())
    n._audit = audit
    n._traiter("BATTEMENT 812")
    ligne = conn.execute(
        "SELECT * FROM battement WHERE audit = ?", (audit,)).fetchone()
    assert ligne["intervalle"] == 812
    assert ligne["amplitude"] is None


def test_battement_invalide_est_ignore(conn):
    audit = db.ouvrir_audit(conn, None, 60)
    n = _noeud(conn, serie=FausseSerie())
    n._audit = audit
    n._traiter("BATTEMENT abc")
    n_battements = conn.execute("SELECT COUNT(*) AS n FROM battement").fetchone()["n"]
    assert n_battements == 0


def test_pouls_est_ignore_sans_effet(conn):
    n = _noeud(conn, serie=FausseSerie())
    n._traiter("POULS 1")


def test_afficher_neutralise_les_accents_et_tronque(conn):
    serie = FausseSerie()
    n = _noeud(conn, serie=serie)
    ok = n.afficher("Titre accentué trop long pour seize", "Sous-titre")
    assert ok is True
    assert serie.ecrits == [b"ECRAN Titre accentue t|Sous-titre\n"]
    assert n._ecran_pose == ("Titre accentué trop long pour seize", "Sous-titre")


def test_afficher_vide_envoie_ecran_seul(conn):
    serie = FausseSerie()
    n = _noeud(conn, serie=serie)
    n.afficher("", "")
    assert serie.ecrits == [b"ECRAN\n"]


def test_afficher_sans_port_ouvert_rend_faux(conn):
    n = _noeud(conn, serie=None)
    assert n.afficher("x", "y") is False


def test_suivre_ecran_envoie_la_consigne_puis_ne_la_repete_pas(conn, monkeypatch):
    _avec_reacteur(conn)
    db.poser_ecran(conn, "réacteur", "haut1", "bas1")
    n = _noeud(conn, compartiment="réacteur", serie=FausseSerie())
    horloge = Horloge(1000.0)
    monkeypatch.setattr(noeud, "time", horloge)

    n._suivre_ecran()
    assert n._serie.ecrits == [b"ECRAN haut1|bas1\n"]
    assert n._ecran_pose == ("haut1", "bas1")

    horloge.t = 1000.0 + noeud.PERIODE_ECRAN_S
    n._suivre_ecran()
    assert n._serie.ecrits == [b"ECRAN haut1|bas1\n"]


def test_suivre_ecran_renvoie_seulement_si_la_consigne_change(conn, monkeypatch):
    _avec_reacteur(conn)
    db.poser_ecran(conn, "réacteur", "haut1", "bas1")
    n = _noeud(conn, compartiment="réacteur", serie=FausseSerie())
    horloge = Horloge(1000.0)
    monkeypatch.setattr(noeud, "time", horloge)
    n._suivre_ecran()

    db.poser_ecran(conn, "réacteur", "haut2", "bas2")
    horloge.t = 1000.0 + noeud.PERIODE_ECRAN_S
    n._suivre_ecran()

    assert n._serie.ecrits == [b"ECRAN haut1|bas1\n", b"ECRAN haut2|bas2\n"]
    assert n._ecran_pose == ("haut2", "bas2")


def test_suivre_ecran_avant_la_periode_ne_relit_pas_la_base(conn, monkeypatch):
    _avec_reacteur(conn)
    db.poser_ecran(conn, "réacteur", "haut1", "bas1")
    n = _noeud(conn, compartiment="réacteur", serie=FausseSerie())
    horloge = Horloge(1000.0)
    monkeypatch.setattr(noeud, "time", horloge)
    n._suivre_ecran()

    db.poser_ecran(conn, "réacteur", "haut2", "bas2")
    n._suivre_ecran()

    assert n._serie.ecrits == [b"ECRAN haut1|bas1\n"]


def test_suivre_ecran_sans_compartiment_ne_fait_rien(conn):
    n = _noeud(conn, compartiment=None, serie=FausseSerie())
    n._suivre_ecran()
    assert n._serie.ecrits == []


def test_ports_disponibles_ne_retient_que_les_signatures_de_noeud(monkeypatch):
    candidats = [
        "/dev/serial/by-id/usb-1a86_USB2.0-Ser_A",
        "/dev/serial/by-id/usb-Arduino_ADK_0044-if00",
        "/dev/serial/by-id/usb-autre-0099",
    ]
    monkeypatch.setattr(noeud.glob, "glob", lambda motif: candidats)
    trouves = noeud.ports_disponibles()
    assert trouves == ["/dev/serial/by-id/usb-1a86_USB2.0-Ser_A"]


def test_ports_disponibles_exclut_les_ports_deja_pris(monkeypatch):
    candidats = [
        "/dev/serial/by-id/usb-1a86_USB2.0-Ser_A",
        "/dev/serial/by-id/usb-CH340_B",
    ]
    monkeypatch.setattr(noeud.glob, "glob", lambda motif: candidats)
    trouves = noeud.ports_disponibles(exclure=("/dev/serial/by-id/usb-1a86_USB2.0-Ser_A",))
    assert trouves == ["/dev/serial/by-id/usb-CH340_B"]
