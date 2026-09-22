import json
import os
import sys
import time

import numpy as np
import serial
from scipy import signal

FS = 250
PORT = "/dev/ttyACM0"
SORTIE = os.path.expanduser("~/atria/data/ecg")


def capturer(duree):
    s = serial.Serial(PORT, 115200, timeout=1)
    s.setDTR(False)
    time.sleep(0.3)
    s.setDTR(True)
    time.sleep(2.0)
    s.reset_input_buffer()

    print(f"\n>>> IMMOBILE ET SILENCIEUX, {duree:.0f} SECONDES <<<\n", flush=True)
    echantillons, leadoff = [], []
    t0 = time.time()
    dernier = 0
    while time.time() - t0 < duree:
        parts = s.readline().decode(errors="replace").split()
        if len(parts) != 2:
            continue
        try:
            echantillons.append(int(parts[0]))
            leadoff.append(int(parts[1]))
        except ValueError:
            continue
        ecoule = int(time.time() - t0)
        if ecoule != dernier and ecoule % 5 == 0:
            dernier = ecoule
            print(f"  {ecoule}s  ({len(echantillons)} echantillons)", flush=True)
    s.close()
    return np.asarray(echantillons, dtype=float), np.asarray(leadoff), time.time() - t0


def nettoyer(x):
    sos_hp = signal.butter(2, 0.5, btype="highpass", fs=FS, output="sos")
    x = signal.sosfiltfilt(sos_hp, x)
    sos_notch = signal.butter(2, [48, 52], btype="bandstop", fs=FS, output="sos")
    x = signal.sosfiltfilt(sos_notch, x)
    sos_lp = signal.butter(4, 40, btype="lowpass", fs=FS, output="sos")
    return signal.sosfiltfilt(sos_lp, x)


def segments_propres(leadoff, brut, min_s=3.0):
    """Intervalles ou le contact tient et le signal ne sature pas."""
    valide = (leadoff == 0) & (brut > 4) & (brut < 1019)
    bords = np.diff(valide.astype(int), prepend=0, append=0)
    debuts = np.where(bords == 1)[0]
    fins = np.where(bords == -1)[0]
    mini = int(min_s * FS)
    return [(d, f) for d, f in zip(debuts, fins) if f - d >= mini]


def pics_r(x):
    sos = signal.butter(2, [5, 20], btype="bandpass", fs=FS, output="sos")
    bande = signal.sosfiltfilt(sos, x)
    derivee = np.diff(bande, prepend=bande[0])
    energie = np.convolve(derivee ** 2, np.ones(int(0.12 * FS)) / (0.12 * FS), mode="same")
    seuil = np.percentile(energie, 97) * 0.35
    pics, _ = signal.find_peaks(energie, height=seuil, distance=int(0.28 * FS))
    return pics, energie


def hrv(rr_ms):
    diffs = np.diff(rr_ms)
    return {
        "rr_moyen": float(np.mean(rr_ms)),
        "hr_moyen": float(60000.0 / np.mean(rr_ms)),
        "rmssd": float(np.sqrt(np.mean(diffs ** 2))) if len(diffs) else 0.0,
        "sdnn": float(np.std(rr_ms)),
        "pnn50": float(np.mean(np.abs(diffs) > 50) * 100) if len(diffs) else 0.0,
        "battements": len(rr_ms) + 1,
    }


def main():
    duree = float(sys.argv[1]) if len(sys.argv) > 1 else 30.0
    sujet = sys.argv[2] if len(sys.argv) > 2 else "inconnu"

    brut, leadoff, ecoule = capturer(duree)
    if len(brut) < FS * 5:
        print(f"trop peu d'echantillons ({len(brut)})")
        return 1

    cadence = len(brut) / ecoule
    off = float((leadoff != 0).mean())
    print(f"\n{len(brut)} echantillons en {ecoule:.1f}s -> {cadence:.1f} Hz")
    print(f"electrodes decollees: {off * 100:.1f}% du temps")
    if off > 0.3:
        print("CONTACT INSUFFISANT — nettoie la peau a l'alcool et recolle les pastilles")
        return 1

    segments = segments_propres(leadoff, brut)
    couvert = sum(f - d for d, f in segments)
    print(f"segments exploitables: {len(segments)} "
          f"({couvert / FS:.1f}s sur {ecoule:.0f}s, {couvert / len(brut) * 100:.0f}%)")
    if not segments:
        print("aucun segment de 3s sans decrochage — ameliore le contact peau-electrode")
        return 1

    rr_tous, snrs, total_pics = [], [], 0
    for debut, fin in segments:
        propre = nettoyer(brut[debut:fin])
        pics, energie = pics_r(propre)
        total_pics += len(pics)
        if len(pics) < 3:
            continue
        snrs.append(float(energie[pics].mean() / (np.median(energie) + 1e-9)))
        rr = np.diff(pics) / FS * 1000.0
        rr_tous.extend(rr[(rr > 300) & (rr < 2000)])

    valides = np.asarray(rr_tous)
    rejetes = total_pics - len(segments) - len(valides)
    snr = float(np.mean(snrs)) if snrs else 0.0
    print(f"pics R detectes: {total_pics}")
    if len(valides) < 5:
        print("trop peu d'intervalles RR exploitables")
        return 1

    mediane = float(np.median(valides))
    coherents = valides[(valides > mediane * 0.65) & (valides < mediane * 1.5)]
    if len(coherents) >= 5:
        rejetes += len(valides) - len(coherents)
        valides = coherents

    m = hrv(valides)

    print()
    print(f"  frequence cardiaque  {m['hr_moyen']:6.1f} bpm")
    print(f"  RR moyen             {m['rr_moyen']:6.0f} ms   sur {len(valides)} intervalles"
          + (f" ({rejetes} rejetes)" if rejetes else ""))
    print(f"  RMSSD                {m['rmssd']:6.1f} ms")
    print(f"  SDNN                 {m['sdnn']:6.1f} ms")
    print(f"  pNN50                {m['pnn50']:6.1f} %")
    print(f"  rapport signal/bruit {snr:6.1f}x", end="")
    print("   EXCELLENT" if snr > 15 else ("   exploitable" if snr > 6 else "   FAIBLE"))

    os.makedirs(SORTIE, exist_ok=True)
    horodatage = time.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(SORTIE, f"{sujet}-{horodatage}")
    np.save(f"{base}-brut.npy", brut)
    np.save(f"{base}-rr.npy", valides)
    np.save(f"{base}-leadoff.npy", leadoff)
    with open(f"{base}.json", "w") as f:
        json.dump({"sujet": sujet, "ts": time.time(), "fs": FS, "duree_s": ecoule,
                   "cadence_hz": cadence, "leadoff_ratio": off, "snr": snr,
                   "rejetes": rejetes, "segments": len(segments),
                   "couverture": round(couvert / len(brut), 3), **m}, f, indent=2)
    print(f"\nenregistre: {base}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
