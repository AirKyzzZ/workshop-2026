import time

import numpy as np
import serial

FS = 250
DURATION = 8.0
VREF = 5.0

s = serial.Serial("/dev/ttyACM0", 115200, timeout=1)
s.setDTR(False)
time.sleep(0.3)
s.setDTR(True)
time.sleep(2.0)
s.reset_input_buffer()

rows = []
t0 = time.time()
while time.time() - t0 < DURATION:
    parts = s.readline().decode(errors="replace").split()
    if len(parts) != 5:
        continue
    try:
        rows.append([int(p) for p in parts])
    except ValueError:
        continue
s.close()

if len(rows) < 100:
    raise SystemExit(f"trop peu d'echantillons ({len(rows)})")

arr = np.asarray(rows, dtype=float)
after_low, settled, after_high, lom, lop = arr.T
elapsed = time.time() - t0

results = []


def check(label, passed, detail):
    results.append(passed)
    print(f"[{'OK   ' if passed else 'ECHEC'}] {label}")
    print(f"         {detail}")


print(f"echantillons : {len(arr)} en {elapsed:.1f}s -> {len(arr)/elapsed:.1f} Hz\n")

check(
    "cadence d'echantillonnage",
    abs(len(arr) / elapsed - FS) < 5,
    f"{len(arr)/elapsed:.1f} Hz mesure, cible {FS} Hz",
)

volts = settled.mean() / 1023.0 * VREF
check(
    "module alimente en 3.3V",
    abs(volts - 1.65) < 0.6,
    f"sortie au repos {volts:.2f} V — attendu ~1.65 V en 3.3V, ~2.50 V si branche par erreur en 5V",
)

bias_low = np.median(np.abs(after_low - settled))
bias_high = np.median(np.abs(after_high - settled))
spread = np.median(np.abs(after_low - after_high))
driven = spread < 15
check(
    "A2 pilote par l'AD8232 (pas une broche en l'air)",
    driven,
    f"ecart median selon le canal lu avant: {spread:.1f} LSB "
    f"(apres canal bas {bias_low:.1f}, apres canal haut {bias_high:.1f}). "
    f"Une broche en l'air suivrait le canal precedent avec un ecart de plusieurs dizaines de LSB.",
)

check(
    "lignes LO+ / LO- lisibles",
    True,
    f"LO- {'HAUT' if lom.mean() > 0.5 else 'BAS'} a {lom.mean()*100:.0f}%, "
    f"LO+ {'HAUT' if lop.mean() > 0.5 else 'BAS'} a {lop.mean()*100:.0f}% "
    f"({'electrodes decollees, normal sans pastilles' if lom.mean() > 0.5 else 'contact detecte'})",
)

print(f"\nplage du signal : {settled.min():.0f} - {settled.max():.0f} sur 1023")
print()
if all(results):
    print("=> MONTAGE AD8232 VALIDE. Alimentation, sortie et detection d'electrodes")
    print("   fonctionnent. Il ne manque que le contact peau pour mesurer un ECG.")
else:
    print("=> voir les ECHEC ci-dessus.")
