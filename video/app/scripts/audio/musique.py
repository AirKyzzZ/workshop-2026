import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch
from scipy.io import wavfile
from transformers import AutoProcessor, MusicgenForConditionalGeneration

APP = Path(__file__).resolve().parents[2]
SORTIE = APP / "public" / "audio" / "musique"
BASE = (
    "cinematic dark ambient electronic score for a sci-fi documentary, deep analog synth pads, "
    "subtle arpeggiated sequencer, precise and modern, restrained, no vocals, no drums, 100 bpm, key of D minor"
)
SECTIONS = [
    "tense quiet opening, low drone, sparse metallic textures",
    "steady pulsing bass sequence, building tension",
    "steady pulsing bass sequence, clean arpeggio, focused",
    "driving pulse, glassy arpeggio, investigative",
    "driving pulse, wider pads, confident",
    "uplifting lift, brighter pads, hopeful resolution",
    "final uplifting swell, resolving chords, fading out",
]
TOKENS_PAR_SEGMENT = 1500
FONDU_S = 3


def main(nombre: int) -> None:
    os.environ.setdefault("HF_HOME", str(APP.parent / ".audio-env" / "hf"))
    appareil = "mps" if torch.backends.mps.is_available() else "cpu"
    processeur = AutoProcessor.from_pretrained("facebook/musicgen-stereo-small")
    modele = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-stereo-small").to(appareil)
    taux = modele.config.audio_encoder.sampling_rate
    SORTIE.mkdir(parents=True, exist_ok=True)
    segments = []
    for indice, section in enumerate(SECTIONS[:nombre]):
        torch.manual_seed(indice)
        entrees = processeur(text=[f"{BASE}, {section}"], padding=True, return_tensors="pt").to(appareil)
        with torch.no_grad():
            audio = modele.generate(**entrees, do_sample=True, guidance_scale=3.0, max_new_tokens=TOKENS_PAR_SEGMENT)
        donnees = audio[0].cpu().numpy().T.astype(np.float32)
        chemin = SORTIE / f"segment-{indice}.wav"
        wavfile.write(chemin, taux, donnees)
        segments.append(chemin)
        print(f"segment {indice} {donnees.shape[0] / taux:.1f}s", flush=True)
        if appareil == "mps":
            torch.mps.empty_cache()
    entrees_ffmpeg = sum((["-i", str(s)] for s in segments), [])
    chaine = ""
    precedent = "[0:a]"
    for i in range(1, len(segments)):
        suivant = f"[m{i}]"
        chaine += f"{precedent}[{i}:a]acrossfade=d={FONDU_S}:c1=tri:c2=tri{suivant};"
        precedent = suivant
    chaine += f"{precedent}loudnorm=I=-20:TP=-2,aresample=48000[final]"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *entrees_ffmpeg, "-filter_complex", chaine, "-map", "[final]", str(SORTIE / "musique.wav")],
        check=True,
    )
    print("musique.wav prête")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else len(SECTIONS))
