import io
import json
import sys
import time
import wave

import console
from vosk import KaldiRecognizer, Model

MODEL_DIR = "models/vosk/vosk-model-small-fr-0.22"
SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0
LEAD_IN = 1.5

CREW = ["moreau", "bianchi", "reyes", "weber", "novak", "silva"]
POSTS = ["chirurgie", "propulsion", "serre", "navigation", "maintenance", "laboratoire"]

VOCAB = sorted(
    set(
        ["atria", "etat", "de", "qui", "peut", "tenir", "le", "poste", "affecte",
         "a", "la", "au", "situation", "rapport", "equipage", "alerte", "statut"]
        + CREW
        + POSTS
    )
)

print("chargement du modele...", flush=True)
model = Model(MODEL_DIR)

console.say("Donnez votre ordre.")
print(f"\n>>> PARLE MAINTENANT — exemples:\n"
      f"    \"atria etat de moreau\"\n"
      f"    \"atria qui peut tenir le poste chirurgie\"\n"
      f"    \"atria affecte bianchi a la chirurgie\"\n"
      f"    \"atria situation\"\n", flush=True)

data = console.listen(seconds=SECONDS + LEAD_IN, rate=16000)
with wave.open(io.BytesIO(data)) as w:
    rate = w.getframerate()
    frames = w.readframes(w.getnframes())

results = {}
for label, grammar in (("libre", None), ("grammaire contrainte", json.dumps(VOCAB + ["[unk]"]))):
    rec = KaldiRecognizer(model, rate, grammar) if grammar else KaldiRecognizer(model, rate)
    rec.SetWords(True)
    t0 = time.time()
    rec.AcceptWaveform(frames)
    res = json.loads(rec.FinalResult())
    elapsed = time.time() - t0
    words = res.get("result", [])
    conf = sum(w["conf"] for w in words) / len(words) if words else 0.0
    results[label] = (res.get("text", "").strip(), conf, elapsed)

print()
for label, (text, conf, elapsed) in results.items():
    print(f"{label:22s} : \"{text}\"")
    print(f"{'':22s}   confiance {conf:.2f} — {elapsed:.2f}s")

final = results["grammaire contrainte"][0]
if final:
    console.say(f"Ordre recu: {final}")
