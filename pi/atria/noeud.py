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
PERIODE_ECRAN_S = 1.0


def _ascii(texte):
    """L'ecran HD44780 ne connait pas les accents, et le port serie parle ASCII."""
    return "".join(c for c in unicodedata.normalize("NFD", texte)
                   if unicodedata.category(c) != "Mn")


def _sans_accent(texte):
    return _ascii(texte).lower()


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
        self._prochain_ecran = 0.0
        self._ecran_pose = None
        self._stop = threading.Event()
        self._fil = threading.Thread(target=self._boucle, daemon=True)
        self._fil.start()

    def _ouvrir(self):
        self._serie = serial.Serial(self.port, BAUD, timeout=1)
        self._serie.setDTR(False)
        time.sleep(0.2)
        self._serie.setDTR(True)
        # Vider avant le boot et non apres : la carte annonce son READY pendant ces deux
        # secondes, et le purger ensuite revient a ignorer sa seule presentation.
        self._serie.reset_input_buffer()
        time.sleep(2.0)
        if self.compartiment:
            self._serie.write(f"NOM {_sans_accent(self.compartiment)}\n".encode("ascii"))
        self._ecran_pose = None
        self.connecte = True

    def _boucle(self):
        while not self._stop.is_set():
            try:
                if self._serie is None:
                    self._ouvrir()
                try:
                    self._suivre_ecran()
                except Exception as exc:
                    self.erreur = f"ecran: {str(exc)[:70]}"
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
            # L'identite du noeud ne doit pas dependre de sa sonde : sans cette resolution
            # des l'annonce, une carte dont le DHT est en defaut garde son nom ASCII et
            # rate toutes les consignes adressees au compartiment accentue.
            annonce = morceaux[1].split("=", 1)[1]
            self.compartiment = (self.compartiment
                                 or resoudre_compartiment(self.conn, annonce)
                                 or annonce)
            return
        if morceaux[0] == "ECRAN":
            if self.compartiment:
                db.confirmer_ecran(self.conn, self.compartiment)
            return
        if morceaux[0] != "AMBIANCE" or len(morceaux) < 4:
            return

        # L'identite se lit sur chaque ligne AMBIANCE, sonde en defaut ou non : la
        # resoudre avant de regarder la mesure evite qu'une carte sans capteur reste
        # anonyme et rate les consignes qui lui sont adressees.
        nom = resoudre_compartiment(self.conn, self.compartiment or morceaux[1])
        if nom is None:
            self.inconnu = self.compartiment or morceaux[1]
            return
        self.compartiment = nom

        try:
            tempX10, humX10 = int(morceaux[2]), int(morceaux[3])
        except ValueError:
            return
        if tempX10 == -9999:
            return

        self.temp_c = tempX10 / 10.0
        self.humidite = humX10 / 10.0
        self.vu_le = time.time()
        self._ecrire()

    def afficher(self, haut="", bas=""):
        """Pousse un message sur l'ecran du compartiment. Vide rend l'ecran a la mesure."""
        if self._serie is None:
            return False
        texte = f"{_ascii(haut[:16])}|{_ascii(bas[:16])}".rstrip("|")
        self._serie.write(f"ECRAN {texte}\n".encode("ascii", "ignore")
                          if texte else b"ECRAN\n")
        self._ecran_pose = (haut, bas)
        return True

    def _suivre_ecran(self):
        """Relit la consigne d'ecran en base et ne l'envoie que si elle a change.

        Le nœud n'a pas besoin de recevoir la meme ligne chaque seconde, et le port serie
        sert d'abord a remonter les mesures.
        """
        maintenant = time.time()
        if maintenant < self._prochain_ecran or not self.compartiment:
            return
        self._prochain_ecran = maintenant + PERIODE_ECRAN_S
        consigne = db.ecrans(self.conn).get(self.compartiment)
        voulu = (consigne["haut"], consigne["bas"]) if consigne else ("", "")
        if voulu != self._ecran_pose:
            self.afficher(*voulu)

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
                "ecran": self._ecran_pose,
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

    def afficher(self, compartiment, haut="", bas=""):
        for n in self.noeuds.values():
            if n.compartiment == compartiment:
                return n.afficher(haut, bas)
        return False
