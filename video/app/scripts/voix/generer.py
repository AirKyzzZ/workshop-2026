import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

APP = Path(__file__).resolve().parents[2]
VIDEO = APP.parent
TTS = VIDEO / ".tts"
ESSAIS = VIDEO / "essais-voix"
GRAINES = Path(__file__).resolve().with_name("graines.json")

os.environ.setdefault("HF_HOME", str(TTS / "hf"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

TEXTE_ESSAI = (
    "Le système de survie le plus fragile d'un vaisseau, c'est son équipage. Voici ATRIA. "
    "Négatif. Conduite de Melih : 0,55. Seuil requis : 0,60. Je recommande Bernard."
)

MODELES = {
    "voxtral": {
        "repo": "mlx-community/Voxtral-4B-TTS-2603-mlx-4bit",
        "params": {"voice": "fr_male"},
    },
    "qwen3": {
        "repo": "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit",
        "params": {
            "lang_code": "french",
            "instruct": (
                "A calm, deep, neutral adult male voice for the onboard artificial intelligence of a "
                "spaceship. Precise, clear articulation, steady measured pace, low pitch, cinematic and "
                "authoritative, emotionless and composed. Native speaker of standard metropolitan French from Paris, France, with a neutral Parisian accent, never Canadian or Quebecois."
            ),
        },
    },
    "omnivoice": {
        "repo": "mlx-community/OmniVoice-bf16",
        "params": {"language": "fr", "instruct": "male, middle-aged, low pitch"},
    },
}

ROGNAGE = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,"
    "areverse,"
    "silenceremove=stop_periods=-1:stop_duration=0.25:stop_silence=0.25:stop_threshold=-45dB"
)

CHAINES = {
    "brut": "anull",
    "leger": (
        "highpass=f=70,"
        "equalizer=f=220:t=q:w=1:g=-2,"
        "equalizer=f=2800:t=q:w=1.2:g=2.5,"
        "aeval='val(0)*(0.9+0.1*sin(2*PI*55*t))':c=same,"
        "chorus=0.8:0.9:18|26:0.22|0.18:0.35|0.5:1.2|1.6,"
        "aecho=0.9:0.8:13|23:0.16|0.1,"
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2"
    ),
    "fort": (
        "highpass=f=90,"
        "equalizer=f=250:t=q:w=1:g=-3,"
        "equalizer=f=1250:t=q:w=4:g=4,"
        "equalizer=f=2600:t=q:w=3:g=3,"
        "aeval='val(0)*(0.72+0.28*sin(2*PI*75*t))':c=same,"
        "flanger=delay=1.5:depth=1.5:regen=35:width=60:speed=0.35,"
        "aecho=0.85:0.75:9|17|29:0.3|0.2|0.12,"
        "lowpass=f=9000,"
        "acompressor=threshold=-20dB:ratio=4:attack=4:release=80:makeup=2.5"
    ),
}

SONIE = "I=-16:TP=-1.5:LRA=11"

PRONONCIATIONS = {"ATRIA": "Atria", "ESA": "Ésa"}

UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]


def en_lettres(nombre: int) -> str:
    from num2words import num2words

    return num2words(nombre, lang="fr")


def decimal_en_lettres(entier: str, decimales: str) -> str:
    zeros_initiaux = len(decimales) - len(decimales.lstrip("0"))
    reste = decimales.lstrip("0")
    mots = [UNITES[0]] * zeros_initiaux + ([en_lettres(int(reste))] if reste else [])
    return f"{en_lettres(int(entier))} virgule {' '.join(mots)}"


def normaliser(texte: str) -> str:
    texte = re.sub(r"(\d+),(\d+)", lambda m: decimal_en_lettres(m[1], m[2]), texte)
    texte = re.sub(r"(\d+)\s*%", lambda m: f"{en_lettres(int(m[1]))} pour cent", texte)
    texte = re.sub(r"\d+", lambda m: en_lettres(int(m[0])), texte)
    for ecrit, dit in PRONONCIATIONS.items():
        texte = re.sub(rf"\b{ecrit}\b", dit, texte)
    return texte


def ffmpeg(*args: str) -> str:
    resultat = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True)
    if resultat.returncode != 0:
        raise RuntimeError(f"ffmpeg a échoué ({' '.join(args)}):\n{resultat.stderr[-2000:]}")
    return resultat.stderr


def duree(fichier: Path) -> float:
    sortie = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(fichier)],
        capture_output=True,
        text=True,
        check=True,
    )
    return round(float(sortie.stdout.strip()), 2)


def attaque_parasite(source: Path) -> float:
    detection = ffmpeg("-i", str(source), "-af", "silencedetect=n=-40dB:d=0.18", "-f", "null", "-")
    bornes = [float(t) for t in re.findall(r"silence_(?:start|end): ([\d.]+)", detection)]
    if len(bornes) < 2 or bornes[0] > 0.65:
        return 0.0
    return round(max(bornes[1] - 0.03, 0.0), 3)


def traiter(source: Path, sortie: Path, chaine: str, tempo: float = 1.0, debut: float = 0.0) -> float:
    sortie.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as dossier:
        intermediaire = Path(dossier) / "chaine.wav"
        filtres = f"atrim=start={debut},asetpts=N/SR/TB,{ROGNAGE},atempo={tempo},{CHAINES[chaine]},aresample=48000"
        ffmpeg("-y", "-i", str(source), "-af", filtres,
               "-ac", "1", "-c:a", "pcm_f32le", str(intermediaire))
        mesure = ffmpeg("-i", str(intermediaire), "-af", f"loudnorm={SONIE}:print_format=json", "-f", "null", "-")
        m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", mesure)[0])
        filtre = (
            f"loudnorm={SONIE}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
            f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
            f":offset={m['target_offset']}:linear=true,aresample=48000"
        )
        ffmpeg("-y", "-i", str(intermediaire), "-af", filtre, "-ar", "48000", "-ac", "1",
               "-c:a", "pcm_s24le", str(sortie))
    return duree(sortie)


class Synthese:
    def __init__(self, modele: str):
        self.nom = modele
        self._modele = None

    def charger(self):
        if self._modele is None:
            from mlx_audio.tts.utils import load_model

            self._modele = load_model(MODELES[self.nom]["repo"])
        return self._modele

    def vers_wav(self, texte: str, fichier: Path, graine: int) -> None:
        import mlx.core as mx
        import numpy as np
        from scipy.io import wavfile

        modele = self.charger()
        mx.random.seed(graine)
        morceaux = modele.generate(text=texte, max_tokens=max(200, 2 * len(texte)), **MODELES[self.nom]["params"])
        audio = np.concatenate([np.asarray(r.audio, dtype=np.float32).reshape(-1) for r in morceaux])
        fichier.parent.mkdir(parents=True, exist_ok=True)
        wavfile.write(fichier, modele.sample_rate, audio)
        mx.clear_cache()

    def brut(self, cle: str, texte: str, graine: int) -> Path:
        fichier = chemin_brut(self.nom, cle, texte, graine)
        if not fichier.exists():
            self.vers_wav(texte, fichier, graine)
        return fichier


def chemin_brut(modele: str, cle: str, texte: str, graine: int | str) -> Path:
    reglages = json.dumps(MODELES[modele]["params"], sort_keys=True)
    empreinte = hashlib.sha1((texte + reglages).encode()).hexdigest()[:8]
    return TTS / "brut" / modele / f"{cle}-{empreinte}-g{graine}.wav"


def lire_json(chemin: Path) -> dict:
    return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else {}


def ecrire_json(chemin: Path, donnees: dict) -> None:
    provisoire = chemin.with_suffix(".json.tmp")
    provisoire.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(provisoire, chemin)


def generer_repliques(synthese: Synthese, args: argparse.Namespace) -> None:
    repliques = lire_json(args.json)
    inconnus = set(args.ids) - set(repliques)
    if inconnus:
        raise SystemExit(f"Identifiants absents de {args.json}: {sorted(inconnus)}")
    graines = lire_json(GRAINES)
    if args.prises:
        for identifiant in args.ids or list(repliques):
            for graine in range(args.prises):
                synthese.brut(identifiant, normaliser(repliques[identifiant]["texte"]), graine)
            print(f"{identifiant}  {args.prises} prises")
        return
    for identifiant in args.ids or list(repliques):
        if args.graine is not None:
            graines.setdefault(synthese.nom, {})[identifiant] = {"graine": args.graine, "debut": 0.0}
            ecrire_json(GRAINES, graines)
        prise = graines.get(synthese.nom, {}).get(identifiant, {"graine": 0, "debut": 0.0})
        replique = repliques[identifiant]
        brut = synthese.brut(identifiant, normaliser(replique["texte"]), prise["graine"])
        sortie = args.public / replique["fichier"]
        replique["dureeS"] = traiter(brut, sortie, args.chaine, args.tempo, prise["debut"])
        replique["genere"] = True
        ecrire_json(args.json, repliques)
        print(f"{identifiant}  {replique['dureeS']:6.2f}s  graine {prise['graine']}  début {prise['debut']}s  {sortie.name}")


def generer_essai(synthese: Synthese, args: argparse.Namespace) -> None:
    brut = synthese.brut("essai", normaliser(TEXTE_ESSAI), args.graine or 0)
    for chaine, suffixe in (("brut", "brut"), ("leger", "robot-leger"), ("fort", "robot-fort")):
        sortie = ESSAIS / f"{synthese.nom}-{suffixe}.wav"
        print(f"{sortie.name}  {traiter(brut, sortie, chaine, args.tempo):.2f}s")


def relancer_dans_env(modele: str) -> None:
    env = TTS / modele
    if Path(sys.prefix).resolve() == env.resolve():
        return
    python = env / "bin" / "python"
    if not python.exists():
        raise SystemExit(f"Environnement introuvable: {env} (voir essais-voix/generer.md)")
    os.execv(python, [str(python), __file__, *sys.argv[1:]])


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère les répliques d'ATRIA avec un modèle TTS local.")
    parser.add_argument("--modele", choices=MODELES, default="voxtral")
    parser.add_argument("--chaine", choices=CHAINES, default="leger")
    parser.add_argument("--ids", nargs="*", default=[])
    parser.add_argument("--graine", type=int, help="fixe la graine des --ids, retenue dans graines.json")
    parser.add_argument("--tempo", type=float, default=1.0)
    parser.add_argument("--prises", type=int, default=0, help="synthétise les graines 0..N-1 sans produire les fichiers")
    parser.add_argument("--json", type=Path, default=APP / "data" / "repliques.json")
    parser.add_argument("--public", type=Path, default=APP / "public")
    parser.add_argument("--essai", action="store_true", help="phrase de test vers essais-voix/")
    args = parser.parse_args()

    relancer_dans_env(args.modele)
    synthese = Synthese(args.modele)
    if args.essai:
        generer_essai(synthese, args)
        return
    generer_repliques(synthese, args)


if __name__ == "__main__":
    main()
