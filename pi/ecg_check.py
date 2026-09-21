import sys
import time

import numpy as np
import serial
from scipy import signal

FS = 250
DURATION = float(sys.argv[1]) if len(sys.argv) > 1 else 15.0

s = serial.Serial("/dev/ttyACM0", 115200, timeout=1)
s.setDTR(False)
time.sleep(0.3)
s.setDTR(True)
time.sleep(2.0)
s.reset_input_buffer()

print(f"acquisition {DURATION:.0f}s a {FS} Hz — reste immobile\n", flush=True)
samples, leadoff = [], []
t0 = time.time()
while time.time() - t0 < DURATION:
    line = s.readline().decode(errors="replace").strip()
    parts = line.split()
    if len(parts) != 2:
        continue
    try:
        samples.append(int(parts[0]))
        leadoff.append(int(parts[1]))
    except ValueError:
        continue
s.close()

n = len(samples)
if n < FS * 2:
    print(f"trop peu d'echantillons ({n}) — verifie la liaison serie")
    sys.exit(1)

x = np.asarray(samples, dtype=float)
lo = np.asarray(leadoff)
elapsed = time.time() - t0
print(f"{n} echantillons en {elapsed:.1f}s  ->  {n / elapsed:.1f} Hz reel")
print(f"brut: min {x.min():.0f}  max {x.max():.0f}  moyenne {x.mean():.0f}  ecart-type {x.std():.1f}")

off_ratio = float((lo != 0).mean())
print(f"electrodes decollees: {off_ratio * 100:.1f}% du temps", end="")
if off_ratio > 0.5:
    print("  <-- PROBLEME: electrodes mal collees ou fils inverses")
    sys.exit(1)
print()

sos = signal.butter(2, [5, 20], btype="bandpass", fs=FS, output="sos")
filt = signal.sosfiltfilt(sos, x)
energy = np.convolve(np.diff(filt, prepend=filt[0]) ** 2, np.ones(int(0.12 * FS)) / (0.12 * FS), mode="same")

thr = np.percentile(energy, 98) * 0.35
peaks, _ = signal.find_peaks(energy, height=thr, distance=int(0.30 * FS))

print(f"\npics R detectes: {len(peaks)}")
if len(peaks) < 5:
    print("signal trop bruite ou pas de contact — verifie les electrodes et l'alimentation 3.3V")
    sys.exit(1)

rr = np.diff(peaks) / FS * 1000.0
rr = rr[(rr > 300) & (rr < 2000)]
if len(rr) < 4:
    print("intervalles RR incoherents — signal trop bruite")
    sys.exit(1)

hr = 60000.0 / rr
rmssd = float(np.sqrt(np.mean(np.diff(rr) ** 2)))
sdnn = float(np.std(rr))

print(f"frequence cardiaque : {hr.mean():.1f} bpm  (min {hr.min():.0f}, max {hr.max():.0f})")
print(f"RR moyen            : {rr.mean():.0f} ms sur {len(rr)} intervalles")
print(f"RMSSD               : {rmssd:.1f} ms")
print(f"SDNN                : {sdnn:.1f} ms")

snr = energy[peaks].mean() / (np.median(energy) + 1e-9)
print(f"rapport signal/bruit: {snr:.1f}x", end="")
if snr > 15:
    print("   EXCELLENT")
elif snr > 6:
    print("   correct, exploitable")
else:
    print("   faible — nettoie la peau a l'alcool, reste immobile")

np.save("/tmp/ecg_raw.npy", x)
print("\nsignal brut sauvegarde dans /tmp/ecg_raw.npy")
