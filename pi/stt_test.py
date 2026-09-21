import io
import json
import sys
import time
import wave

import console
from vosk import KaldiRecognizer, Model

MODEL_DIR = "models/vosk/vosk-model-small-fr-0.22"
SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0

print("chargement du modele...", flush=True)
model = Model(MODEL_DIR)

console.say("Parlez apres le signal.")

print(f"\n>>> PARLE MAINTENANT, {SECONDS:.0f} SECONDES <<<\n", flush=True)
t0 = time.time()
data = console.listen(seconds=SECONDS, rate=16000)
t1 = time.time()
print(f"capture: {len(data)//1024} Ko en {t1-t0:.1f}s", flush=True)

with wave.open(io.BytesIO(data)) as w:
    rate = w.getframerate()
    frames = w.readframes(w.getnframes())
    print(f"audio: {rate} Hz, {w.getnchannels()} canal, {w.getnframes()/rate:.1f}s")

rec = KaldiRecognizer(model, rate)
rec.SetWords(True)
t2 = time.time()
rec.AcceptWaveform(frames)
result = json.loads(rec.FinalResult())
t3 = time.time()

texte = result.get("text", "").strip()
print(f"\ntranscription en {t3-t2:.2f}s")
print(f'  >>> "{texte}"' if texte else "  >>> (rien compris)")

if result.get("result"):
    conf = sum(w["conf"] for w in result["result"]) / len(result["result"])
    print(f"  confiance moyenne: {conf:.2f} sur {len(result['result'])} mots")

if texte:
    console.say(f"J'ai compris: {texte}")
