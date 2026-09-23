"""Écoute du bord : ce que le micro entend, et ce qu'ATRIA en fait.

Le micro ne servait qu'à mesurer un niveau sonore en décibels. Deux modèles se partagent
désormais le même tampon audio, parce qu'ils ne répondent pas à la même question.

YAMNet classe 521 types de sons en dix-huit millisecondes pour trois secondes d'audio. Il
reconnaît une toux, un cri, un bris de verre, mais il ne saura jamais dire un mot : devant
une phrase il répond « parole », sans jamais dire laquelle. Chaque famille se branche sur
un mécanisme qui existe déjà : un cri alimente la conduite comme un geste filmé, une toux
alimente le traçage de contagion puisque le graphe social sait qui partageait le
compartiment, un bris alimente les incidents de compartiment.

Vosk transcrit le français en local, et c'est lui qui entend les mots. Une insulte ou une
menace prononcée fait tomber la conduite exactement comme un doigt d'honneur filmé.

Une limite assumée : un micro ne sait pas qui parle. Un cri n'est attribué à quelqu'un que
si la caméra l'a identifié au même moment ; sinon il reste rattaché au compartiment. Une
toux, elle, est toujours rattachée au compartiment, parce que c'est le lieu qui contamine
et non l'individu nommé.
"""

import os
import subprocess
import threading
import time

from . import db, modules

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

MODELE_VOSK = os.path.expanduser("~/atria/models/vosk/vosk-model-small-fr-0.22")
CLASSES_PAROLE = ("Speech", "Shout", "Yell", "Screaming", "Conversation",
                  "Narration, monologue", "Male speech, man speaking",
                  "Female speech, woman speaking", "Child speech, kid speaking")
SEUIL_PAROLE = 0.30
NIVEAU_PAROLE_MIN = 0.004

LEXIQUE = {
    "putain": 0.15, "merde": 0.15, "bordel": 0.12, "fait chier": 0.15,
    "connard": 0.35, "connasse": 0.35, "abruti": 0.25, "imbécile": 0.20,
    "salope": 0.40, "encule": 0.45, "enculé": 0.45, "batard": 0.35, "bâtard": 0.35,
    "nique ta mère": 0.50, "nique ta": 0.50, "va te faire": 0.40,
    "ta gueule": 0.40, "ferme la": 0.30, "casse toi": 0.30, "dégage": 0.20,
    "je vais te tuer": 0.90, "je te tue": 0.90, "je vais te crever": 0.90,
    "crève": 0.60, "creve": 0.60, "je vais te frapper": 0.70,
}
"""Mots qui pesent sur la conduite, et de combien. La gravite suit l'intention et non la
vulgarite : un juron d'exasperation coute dix fois moins qu'une menace de mort."""

MENACES = ("je vais te tuer", "je te tue", "crève", "creve")
"""Ces phrases ouvrent un incident de type menace, que la surete traite a part."""

MULTIPLE_CRI = 3.5
NIVEAU_CRI_MIN = 0.06
"""Un cri se reconnait d'abord a son volume. YAMNet a classe un hurlement reel en
« Goose, Honk », ce qui n'est pas une aberration du modele : les classes de cris sont
entrainees sur des enregistrements propres, pas sur quelqu'un qui hurle a trente
centimetres d'un micro cardioide. Le niveau sonore, lui, ne se trompe pas. On retient donc
un cri quand YAMNet le nomme, ou quand le niveau depasse plusieurs fois le fond de parole
habituel."""

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
        self._fond = None
        self._classifieur = None
        self._vosk = None
        self.transcription = ""
        self.transcrit_le = 0.0
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

        # YAMNet reconnait des types de sons, jamais des mots : il dira « Speech » sans
        # jamais dire lequel. La transcription est donc un second canal, sur le meme
        # tampon audio, et c'est elle qui fait tomber la conduite sur une insulte.
        if os.path.isdir(MODELE_VOSK):
            try:
                from vosk import KaldiRecognizer, Model, SetLogLevel
                SetLogLevel(-1)
                self._vosk = KaldiRecognizer(Model(MODELE_VOSK), RATE)
                self._vosk.SetWords(True)
            except Exception as exc:
                self.erreur = f"vosk: {str(exc)[:80]}"

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

            if not modules.actif("ecoute"):
                self.classes = []
                time.sleep(1.0)
                continue

            echantillons = np.frombuffer(brut, dtype=np.int16).astype(np.float32) / 32768.0
            self.niveau = round(float(np.sqrt((echantillons ** 2).mean())), 4)
            self._suivre_fond()

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
            if self._parle():
                self._transcrire(brut)

    def _parle(self):
        """Vrai quand la fenetre contient de la parole.

        Vosk decode en temps reel et tournait sur chaque fenetre, silence compris : le SoC
        est monte a 81 °C, au-dessus du seuil de bridage du Pi 5, et l'appel au modele de
        langage est parti en depassement de delai. YAMNet, qui coute quatorze
        millisecondes, sait deja dire s'il y a de la parole : il sert de portier.
        """
        if not modules.actif("transcription") or self.niveau < NIVEAU_PAROLE_MIN:
            return False
        return any(c["nom"] in CLASSES_PAROLE and c["score"] >= SEUIL_PAROLE
                   for c in self.classes)

    def _transcrire(self, brut):
        """Cherche dans la parole les mots qui pesent sur la conduite."""
        import json as _json

        if self._vosk is None:
            return
        self._vosk.AcceptWaveform(brut)
        texte = _json.loads(self._vosk.FinalResult()).get("text", "").strip()
        self._vosk.Reset()
        if not texte:
            return
        self.transcription = texte
        self.transcrit_le = time.time()

        # Du plus grave au moins grave : « putain je vais te tuer » est une menace, pas
        # un juron, et c'est la partie la plus lourde de la phrase qui doit compter.
        for mot, gravite in sorted(LEXIQUE.items(), key=lambda x: -x[1]):
            if mot in texte:
                self._injurier(mot, gravite, texte)
                break

    def _injurier(self, mot, gravite, texte):
        maintenant = time.time()
        if maintenant - self._derniers.get("insulte", 0.0) < REPOS_EVENEMENT_S:
            return
        self._derniers["insulte"] = maintenant
        self.compteur += 1
        auteur = self._auteur()
        type_ = "menace" if mot in MENACES else "insulte"
        db.enregistrer_incident(self.conn, auteur, "micro", type_, gravite,
                                f"« {texte[:60]} »")
        db.journaliser(self.conn, "conduite",
                       f"{type_} entendue dans {self.compartiment}"
                       + (f", attribuee a {auteur}" if auteur else ", non attribuee"),
                       acteur="atria", sujet=auteur,
                       donnees={"canal": "micro", "mot": mot,
                                "gravite": gravite, "texte": texte[:80]})

    def _suivre_fond(self):
        """Moyenne glissante du niveau habituel, hors cris."""
        if self._fond is None:
            self._fond = self.niveau
        elif self.niveau < self._fond * MULTIPLE_CRI:
            self._fond = 0.9 * self._fond + 0.1 * self.niveau

    def crie(self):
        return (self._fond is not None and self.niveau >= NIVEAU_CRI_MIN
                and self.niveau >= self._fond * MULTIPLE_CRI)

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
            elif famille == "cri" and self.crie():
                self._emettre("cri", f"niveau {self.niveau:.3f} sur fond {self._fond:.3f}",
                              min(1.0, self.niveau / max(1e-6, self._fond) / 6.0))

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
            "fond": None if self._fond is None else round(self._fond, 4),
            "crie": self.crie(),
            "classes": self.classes,
            "latence_ms": self.latence_ms,
            "evenements": self.compteur,
            "transcription": self.transcription,
            "transcrit_il_y_a": (round(time.time() - self.transcrit_le, 1)
                                 if self.transcrit_le else None),
            "vosk": self._vosk is not None,
            "arme": modules.actif("ecoute"),
            "parle": self._parle(),
            "lexique": len(LEXIQUE),
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
