import glob
import queue
import threading
import time

import serial

BAUD = 115200
BY_ID = "/dev/serial/by-id/"
SIGNATURE_ADK = "0044"
"""Identifiant produit USB du Mega ADK, present dans son nom by-id."""


def resoudre_port(signature=SIGNATURE_ADK, defaut="/dev/ttyACM0"):
    """Chemin stable d'une carte, par signature USB plutot que par ordre d'enumeration.

    Avec deux Arduino branches, /dev/ttyACM0 et ACM1 s'echangent d'un demarrage a
    l'autre : la passerelle se retrouverait alors a parler au noeud de compartiment.
    """
    for chemin in sorted(glob.glob(BY_ID + "*")):
        if signature in chemin:
            return chemin
    return defaut


PORT = None


class Link:
    def __init__(self, port=None, baud=BAUD):
        self.evenements = queue.Queue(maxsize=64)
        self.mic = 0
        self.mq2 = 0
        self.temp_c = None
        self.humidite = None
        self.connecte = False
        self._port = port or resoudre_port()
        self._baud = baud
        self._serie = None
        self._verrou = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._boucle, daemon=True)
        self._thread.start()

    def _ouvrir(self):
        self._serie = serial.Serial(self._port, self._baud, timeout=1)
        self._serie.setDTR(False)
        time.sleep(0.2)
        self._serie.setDTR(True)
        time.sleep(2.0)
        self._serie.reset_input_buffer()
        self.connecte = True

    def _boucle(self):
        while not self._stop.is_set():
            try:
                if self._serie is None:
                    self._ouvrir()
                ligne = self._serie.readline().decode(errors="replace").strip()
            except Exception:
                self.connecte = False
                self._serie = None
                time.sleep(2.0)
                continue

            if not ligne:
                continue
            if ligne.startswith("SENSE "):
                parts = ligne.split()
                try:
                    if len(parts) >= 3:
                        self.mic, self.mq2 = int(parts[1]), int(parts[2])
                    if len(parts) >= 5:
                        t, h = int(parts[3]), int(parts[4])
                        self.temp_c = t / 10.0 if t > -9000 else None
                        self.humidite = h / 10.0 if h > -9000 else None
                except ValueError:
                    pass
            elif ligne.startswith("BADGE "):
                self._publier(("badge", ligne[6:].strip()))
            elif ligne.startswith("READY"):
                self._publier(("ready", ligne))

    def _publier(self, evenement):
        try:
            self.evenements.put_nowait(evenement)
        except queue.Full:
            pass

    def beep(self, motif="OK"):
        with self._verrou:
            if self._serie is None:
                return
            try:
                self._serie.write(f"BEEP {motif}\n".encode())
            except Exception:
                self.connecte = False
                self._serie = None

    def prochain(self):
        try:
            return self.evenements.get_nowait()
        except queue.Empty:
            return None

    def fermer(self):
        self._stop.set()
        if self._serie is not None:
            try:
                self._serie.close()
            except Exception:
                pass
