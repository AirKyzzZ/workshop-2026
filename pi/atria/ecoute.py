"""Écoute du bord : ce que le micro entend, et ce qu'ATRIA en fait.

Le micro ne servait qu'à mesurer un niveau sonore en décibels. YAMNet classe 521 sons en
dix-huit millisecondes pour trois secondes d'audio, ce qui ouvre une seconde modalité
sensorielle pour un coût négligeable, sans reconnaissance de parole ni modèle français.

Trois familles de sons intéressent le bord, et chacune se branche sur un mécanisme qui
existe déjà. Un cri alimente la conduite, comme un geste filmé. Une toux alimente le
traçage de contagion, parce que le graphe social sait déjà qui partageait le compartiment.
Un bris ou une alarme alimente les incidents de compartiment.

Une limite assumée : un micro ne sait pas qui parle. Un cri n'est attribué à quelqu'un que
si la caméra l'a identifié au même moment ; sinon il reste rattaché au compartiment. Une
toux, elle, est toujours rattachée au compartiment, parce que c'est le lieu qui contamine
et non l'individu nommé.
"""

import os
import subprocess
import threading
import time

from . import db

MODELE = os.path.expanduser("~/atria/models/mediapipe/yamnet.tflite")
PERIPHERIQUE = os.environ.get("ATRIA_MICRO", "plughw:0,0")
COMPARTIMENT = os.environ.get("ATRIA_COMPARTIMENT_MICRO", "infirmerie")

RATE = 16000
FENETRE_S = 3.0
SEUIL_CLASSE = 0.35

FAMILLES = {
    "cri": ("Shout", "Screaming", "Yell", "Children shouting", "Battle cry"),
    "toux": ("Cough", "Sneeze", "Throat clearing", "Sniff"),
    "choc": ("Glass", "Shatter", "Breaking", "Smash, crash", "Crack",
             "Alarm", "Smoke detector, smoke alarm", "Fire alarm", "Explosion"),
}

GRAVITE_CRI = 0.20
REPOS_EVENEMENT_S = 12.0
"""Une quinte de toux ne doit pas compter dix fois."""


def disponible():
    return os.path.exists(MODELE)


class Ecoute:
    """Capture le micro en continu et classe ce qu'il entend."""

    def __init__(self, conn, compartiment=COMPARTIMENT):
        self.conn = conn
        self.compartiment = db.resoudre(conn, compartiment) or compartiment
        self.actif = False
        self.fil = None
        self.erreur = None
        self.classes = []
        self.niveau = 0.0
        self.vu_le = 0.0
        self.latence_ms = None
        self.compteur = 0
        self._derniers = {}
        self._classifieur = None
        self._auteur = lambda: None

    def brancher_identite(self, fonction):
        """La camera sait qui est devant elle ; le micro ne le sait pas."""
        self._auteur = fonction

    def demarrer(self):
        if self.actif or not disponible():
            return
        self.actif = True
        self.fil = threading.Thread(target=self._boucle, daemon=True)
        self.fil.start()

    def arreter(self):
        self.actif = False
        if self.fil:
            self.fil.join(timeout=3)

    def _charger(self):
        from mediapipe.tasks import python as mpp
        from mediapipe.tasks.python import audio

        self._audio = audio
        self._classifieur = audio.AudioClassifier.create_from_options(
            audio.AudioClassifierOptions(
                base_options=mpp.BaseOptions(model_asset_path=MODELE),
                running_mode=audio.RunningMode.AUDIO_CLIPS,
                max_results=6, score_threshold=0.05))

    def _boucle(self):
        import numpy as np
        from mediapipe.tasks.python.components import containers

        try:
            self._charger()
        except Exception as exc:
            self.erreur = str(exc)[:120]
            self.actif = False
            return

        octets = int(RATE * FENETRE_S) * 2
        while self.actif:
            try:
                brut = subprocess.run(
                    ["arecord", "-D", PERIPHERIQUE, "-f", "S16_LE", "-r", str(RATE),
                     "-c", "1", "-d", str(int(FENETRE_S)), "-t", "raw", "-q"],
                    capture_output=True, timeout=FENETRE_S + 5).stdout
            except (OSError, subprocess.SubprocessError) as exc:
                self.erreur = str(exc)[:80]
                time.sleep(3)
                continue
            if len(brut) < octets // 2:
                time.sleep(1)
                continue

            echantillons = np.frombuffer(brut, dtype=np.int16).astype(np.float32) / 32768.0
            self.niveau = round(float(np.sqrt((echantillons ** 2).mean())), 4)

            debut = time.time()
            try:
                clip = containers.AudioData.create_from_array(echantillons, RATE)
                resultats = self._classifieur.classify(clip)
            except Exception as exc:
                self.erreur = str(exc)[:80]
                time.sleep(1)
                continue
            self.latence_ms = round((time.time() - debut) * 1000)
            self.vu_le = time.time()
            self._traiter(resultats)

    def _traiter(self, resultats):
        """Retient la meilleure occurrence de chaque classe sur la fenêtre."""
        meilleurs = {}
        for r in resultats:
            for c in r.classifications[0].categories:
                if c.score > meilleurs.get(c.category_name, 0.0):
                    meilleurs[c.category_name] = c.score

        self.classes = [{"nom": n, "score": round(s, 3)}
                        for n, s in sorted(meilleurs.items(), key=lambda x: -x[1])[:5]]

        for famille, etiquettes in FAMILLES.items():
            retenu = max(((n, s) for n, s in meilleurs.items() if n in etiquettes),
                         key=lambda x: x[1], default=None)
            if retenu and retenu[1] >= SEUIL_CLASSE:
                self._emettre(famille, retenu[0], retenu[1])

    def _emettre(self, famille, classe, score):
        maintenant = time.time()
        if maintenant - self._derniers.get(famille, 0.0) < REPOS_EVENEMENT_S:
            return
        self._derniers[famille] = maintenant
        self.compteur += 1
        auteur = self._auteur()

        if famille == "cri":
            db.enregistrer_incident(self.conn, auteur, "micro", "cri",
                                    GRAVITE_CRI * score, f"{classe} {score:.2f}")
            db.journaliser(self.conn, "conduite",
                           f"cri detecte dans {self.compartiment}"
                           + (f", attribue a {auteur}" if auteur else ", non attribue"),
                           acteur="atria", sujet=auteur,
                           donnees={"canal": "micro", "classe": classe,
                                    "score": round(score, 3)})
        elif famille == "toux":
            db.enregistrer_symptome(self.conn, self.compartiment, "toux", "micro",
                                    score, auteur)
            db.journaliser(self.conn, "alerte",
                           f"toux entendue dans {self.compartiment}, "
                           f"chaine de contact a tracer",
                           acteur="atria", sujet=auteur,
                           donnees={"classe": classe, "score": round(score, 3)})
        else:
            db.journaliser(self.conn, "alerte",
                           f"{classe} entendu dans {self.compartiment}",
                           acteur="atria", sujet=self.compartiment,
                           donnees={"classe": classe, "score": round(score, 3)})

    def etat(self):
        return {
            "actif": self.actif,
            "modele": disponible(),
            "erreur": self.erreur,
            "compartiment": self.compartiment,
            "peripherique": PERIPHERIQUE,
            "niveau": self.niveau,
            "classes": self.classes,
            "latence_ms": self.latence_ms,
            "evenements": self.compteur,
            "vu_il_y_a": round(time.time() - self.vu_le, 1) if self.vu_le else None,
        }


ecoute = None


def demarrer(conn, identite=None):
    global ecoute
    if ecoute is None:
        ecoute = Ecoute(conn)
        if identite:
            ecoute.brancher_identite(identite)
    ecoute.demarrer()
    return ecoute
