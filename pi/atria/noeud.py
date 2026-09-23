"""Nœuds de compartiment : les cartes qui ne font que mesurer une atmosphère.

La passerelle, elle, porte les badges, le buzzer et le micro. Un nœud ne sait rien de
l'équipage : il annonce son compartiment et sa mesure, et le Pi décide quoi en faire.
Séparer les deux rôles permet d'en ajouter un par compartiment sans toucher au reste.
"""

import glob
import threading
import time
import unicodedata

import serial

from . import db, link

BAUD = 115200
SIGNATURE_NOEUD = ("CH340", "1a86", "0042", "USB2.0-Ser")
"""Signatures USB des cartes candidates : clones CH340 et Mega 2560 authentiques."""

PERIODE_ECRITURE_S = 20.0
DELAI_RECONNEXION_S = 5.0


def _sans_accent(texte):
    return "".join(c for c in unicodedata.normalize("NFD", texte)
                   if unicodedata.category(c) != "Mn").lower()


def resoudre_compartiment(conn, annonce):
    """Rend le nom du compartiment tel qu'il existe en base.

    Une carte annonce son compartiment en ASCII sur le port serie, donc « reacteur »
    quand la base contient « reacteur » accentue. Sans cette resolution, l'insertion viole
    la cle etrangere et le fil du noeud meurt en silence.
    """
    cible = _sans_accent(annonce)
    for ligne in conn.execute("SELECT nom FROM compartiment"):
        if _sans_accent(ligne["nom"]) == cible:
            return ligne["nom"]
    return None


def ports_disponibles(exclure=()):
    """Ports série qui ne sont pas déjà pris par la passerelle."""
    trouves = []
    for chemin in sorted(glob.glob(link.BY_ID + "*")):
        if chemin in exclure or link.SIGNATURE_ADK in chemin:
            continue
        if any(s.lower() in chemin.lower() for s in SIGNATURE_NOEUD):
            trouves.append(chemin)
    return trouves


class Noeud:
    """Un nœud, un port série, un compartiment."""

    def __init__(self, port, conn, compartiment=None):
        self.port = port
        self.conn = conn
        self.compartiment = compartiment
        self.temp_c = None
        self.humidite = None
        self.vu_le = 0.0
        self.connecte = False
        self.inconnu = None
        self.erreur = None
        self._serie = None
        self._prochaine_ecriture = 0.0
        self._stop = threading.Event()
        self._fil = threading.Thread(target=self._boucle, daemon=True)
        self._fil.start()

    def _ouvrir(self):
        self._serie = serial.Serial(self.port, BAUD, timeout=1)
        self._serie.setDTR(False)
        time.sleep(0.2)
        self._serie.setDTR(True)
        time.sleep(2.0)
        self._serie.reset_input_buffer()
        if self.compartiment:
            self._serie.write(f"NOM {self.compartiment}\n".encode())
        self.connecte = True

    def _boucle(self):
        while not self._stop.is_set():
            try:
                if self._serie is None:
                    self._ouvrir()
                ligne = self._serie.readline().decode("ascii", "ignore").strip()
                if ligne:
                    try:
                        self._traiter(ligne)
                    except Exception as exc:
                        # Un defaut de traitement ne doit jamais tuer le fil : la carte
                        # continuerait d'emettre dans le vide sans que rien ne le signale.
                        self.erreur = str(exc)[:80]
            except (serial.SerialException, OSError):
                self.connecte = False
                if self._serie is not None:
                    try:
                        self._serie.close()
                    except OSError:
                        pass
                self._serie = None
                time.sleep(DELAI_RECONNEXION_S)

    def _traiter(self, ligne):
        morceaux = ligne.split()
        if morceaux[0] == "READY" and len(morceaux) > 1 and "=" in morceaux[1]:
            self.compartiment = self.compartiment or morceaux[1].split("=", 1)[1]
            return
        if morceaux[0] != "AMBIANCE" or len(morceaux) < 4:
            return

        annonce = self.compartiment or morceaux[1]
        try:
            tempX10, humX10 = int(morceaux[2]), int(morceaux[3])
        except ValueError:
            return
        if tempX10 == -9999:
            return

        nom = resoudre_compartiment(self.conn, annonce)
        if nom is None:
            self.inconnu = annonce
            return

        self.compartiment = nom
        self.temp_c = tempX10 / 10.0
        self.humidite = humX10 / 10.0
        self.vu_le = time.time()
        self._ecrire()

    def _ecrire(self):
        maintenant = time.time()
        if maintenant < self._prochaine_ecriture:
            return
        self._prochaine_ecriture = maintenant + PERIODE_ECRITURE_S
        db.enregistrer_ambiance(self.conn, self.compartiment, 0, 0,
                                self.temp_c, self.humidite)

    def etat(self):
        return {"port": self.port, "compartiment": self.compartiment,
                "connecte": self.connecte, "temp_c": self.temp_c,
                "humidite": self.humidite, "inconnu": self.inconnu,
                "erreur": self.erreur,
                "age": round(time.time() - self.vu_le, 1) if self.vu_le else None}

    def fermer(self):
        self._stop.set()


class Reseau:
    """Découvre les nœuds branchés et les tient ouverts."""

    def __init__(self, conn, affectation=None):
        self.conn = conn
        self.affectation = affectation or {}
        self.noeuds = {}

    def scruter(self):
        for port in ports_disponibles(exclure=tuple(self.noeuds)):
            self.noeuds[port] = Noeud(port, self.conn, self.affectation.get(port))
        return list(self.noeuds)

    def etat(self):
        return [n.etat() for n in self.noeuds.values()]

    def fermer(self):
        for n in self.noeuds.values():
            n.fermer()
