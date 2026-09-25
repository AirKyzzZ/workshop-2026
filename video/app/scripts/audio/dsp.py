from pathlib import Path

import numpy as np
from numba import njit
from scipy.io import wavfile
from scipy.signal import fftconvolve

SR = 48000


def secondes(duree):
    return int(round(duree * SR))


def temps(duree):
    return np.arange(secondes(duree)) / SR


def generateur(graine):
    return np.random.default_rng(graine)


def db(valeur):
    return 10 ** (valeur / 20)


def place(tampon, signal, debut, gain=1.0):
    i = secondes(debut)
    if i >= tampon.shape[-1]:
        return tampon
    fin = min(tampon.shape[-1], i + signal.shape[-1])
    tampon[..., i:fin] += gain * signal[..., : fin - i]
    return tampon


def enveloppe(n, attaque, decroissance, maintien=0.0):
    t = np.arange(n) / SR
    montee = np.clip(t / max(attaque, 1e-6), 0, 1) ** 2 * (3 - 2 * np.clip(t / max(attaque, 1e-6), 0, 1))
    chute = np.exp(-np.maximum(t - attaque - maintien, 0) / decroissance)
    k = max(1, min(secondes(0.03), n // 5))
    chute[n - k :] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return montee * chute


def fondu(signal, entree=0.0, sortie=0.0):
    n = signal.shape[-1]
    gain = np.ones(n)
    if entree > 0:
        k = min(n, secondes(entree))
        gain[:k] = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    if sortie > 0:
        k = min(n, secondes(sortie))
        gain[n - k :] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return signal * gain


def phase_de(frequence):
    frequence = np.broadcast_to(np.asarray(frequence, dtype=np.float64), np.shape(frequence))
    return np.cumsum(frequence) / SR


def sinus(frequence, n=None, phase=0.0):
    if np.ndim(frequence) == 0:
        return np.sin(2 * np.pi * (frequence * np.arange(n) / SR + phase))
    return np.sin(2 * np.pi * (phase_de(frequence) + phase))


def dent_de_scie(frequence, n=None, phase=0.0):
    f = np.full(n, float(frequence)) if np.ndim(frequence) == 0 else np.asarray(frequence, dtype=np.float64)
    p = (phase_de(f) + phase) % 1.0
    dt = np.clip(f / SR, 1e-9, 0.5)
    y = 2 * p - 1
    a = p < dt
    x = p[a] / dt[a]
    y[a] -= x + x - x * x - 1
    b = p > 1 - dt
    x = (p[b] - 1) / dt[b]
    y[b] -= x * x + x + x + 1
    return y


def bruit_blanc(n, rng):
    return rng.standard_normal(n)


def bruit_colore(n, rng, pente):
    spectre = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    spectre *= f ** (-pente / 2)
    spectre[0] = 0
    y = np.fft.irfft(spectre, n)
    return y / (np.std(y) + 1e-12)


@njit(cache=True)
def _svf(x, coupure, q, mode):
    y = np.empty_like(x)
    ic1 = 0.0
    ic2 = 0.0
    k = 1.0 / q
    for i in range(x.shape[0]):
        fc = min(max(coupure[i], 10.0), 0.49 * 48000.0)
        g = np.tan(np.pi * fc / 48000.0)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2
        elif mode == 1:
            y[i] = v1 * k
        else:
            y[i] = x[i] - k * v1 - v2
    return y


def _filtre(x, coupure, q, mode):
    x = np.ascontiguousarray(x, dtype=np.float64)
    if x.ndim == 2:
        return np.stack([_filtre(canal, coupure, q, mode) for canal in x])
    c = np.full(x.shape[0], float(coupure)) if np.ndim(coupure) == 0 else np.ascontiguousarray(coupure, dtype=np.float64)
    return _svf(x, c, float(q), mode)


def passe_bas(x, coupure, q=0.707):
    return _filtre(x, coupure, q, 0)


def passe_bande(x, coupure, q=1.0):
    return _filtre(x, coupure, q, 1)


def passe_haut(x, coupure, q=0.707):
    return _filtre(x, coupure, q, 2)


@njit(cache=True)
def _echelle(x, coupure, resonance):
    y = np.empty_like(x)
    s1 = 0.0
    s2 = 0.0
    s3 = 0.0
    s4 = 0.0
    for i in range(x.shape[0]):
        fc = min(max(coupure[i], 10.0), 0.45 * 48000.0)
        g = np.tan(np.pi * fc / 48000.0)
        G = g / (1.0 + g)
        entree = np.tanh(x[i] - resonance * s4)
        v = (entree - s1) * G
        a = v + s1
        s1 = a + v
        v = (a - s2) * G
        b = v + s2
        s2 = b + v
        v = (b - s3) * G
        c = v + s3
        s3 = c + v
        v = (c - s4) * G
        d = v + s4
        s4 = d + v
        y[i] = d
    return y


def echelle(x, coupure, resonance=0.0):
    x = np.ascontiguousarray(x, dtype=np.float64)
    if x.ndim == 2:
        return np.stack([echelle(canal, coupure, resonance) for canal in x])
    c = np.full(x.shape[0], float(coupure)) if np.ndim(coupure) == 0 else np.ascontiguousarray(coupure, dtype=np.float64)
    return _echelle(x, c, float(resonance))


def stereo(mono, pan=0.0, largeur=0.0, rng=None):
    angle = (np.asarray(pan) + 1) * np.pi / 4
    gauche = mono * np.cos(angle)
    droite = mono * np.sin(angle)
    signal = np.stack([gauche, droite]) * np.sqrt(2)
    if largeur > 0:
        retard = secondes(0.0007 + 0.0006 * largeur)
        decale = np.concatenate([np.zeros(retard), mono[:-retard]]) if retard < mono.shape[0] else mono * 0
        signal[0] += largeur * 0.35 * decale
        signal[1] -= largeur * 0.35 * decale
    return signal


def reponse_impulsionnelle(rng, rt60, predelai=0.01, clarte=0.5, largeur=1.0, metal=0.0):
    n = secondes(rt60 * 1.4 + predelai)
    t = np.arange(n) / SR
    canaux = []
    for _ in range(2):
        bruit = rng.standard_normal(n)
        grave = passe_bas(bruit, 400) * np.exp(-6.91 * t / (rt60 * 1.15))
        medium = passe_bande(bruit, 1600, 0.5) * np.exp(-6.91 * t / rt60)
        aigu = passe_haut(bruit, 5000) * np.exp(-6.91 * t / (rt60 * clarte))
        ir = grave + medium + 0.8 * aigu
        if metal > 0:
            modes = sum(
                np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / (rt60 * rng.uniform(0.15, 0.4)))
                for f in rng.uniform(300, 3500, 14)
            )
            ir += metal * 0.05 * modes
        attaque = np.clip(t / 0.012, 0, 1)
        ir *= attaque
        ir = np.concatenate([np.zeros(secondes(predelai)), ir])[:n]
        canaux.append(ir)
    ir = np.stack(canaux)
    milieu = ir.mean(axis=0)
    ir = milieu + largeur * (ir - milieu)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverberer(signal, ir, mouille, sec=1.0, circulaire=False):
    if signal.ndim == 1:
        signal = np.stack([signal, signal])
    n = signal.shape[-1]
    if circulaire:
        m = n
        humide = np.stack(
            [np.fft.irfft(np.fft.rfft(signal[c]) * np.fft.rfft(ir[c][:m], m), m) for c in range(2)]
        )
        return sec * signal + mouille * humide
    humide = np.stack([fftconvolve(signal[c], ir[c]) for c in range(2)])
    sortie = np.zeros_like(humide)
    sortie[:, :n] = sec * signal
    return sortie + mouille * humide


def saturer(x, entrainement=1.0):
    return np.tanh(x * entrainement) / np.tanh(entrainement)


def normaliser_crete(signal, crete_db=-3.0):
    return signal * db(crete_db) / (np.max(np.abs(signal)) + 1e-12)


def rogner(signal, seuil_debut=-60.0, seuil_fin=-66.0, queue=0.03):
    niveau = np.max(np.abs(signal), axis=0)
    crete = niveau.max()
    actif = np.nonzero(niveau > crete * db(seuil_debut))[0]
    debut = max(actif[0] - secondes(0.001), 0)
    fin_active = np.nonzero(niveau > crete * db(seuil_fin))[0][-1]
    fin = min(signal.shape[-1], fin_active + secondes(queue))
    extrait = signal[:, debut:fin].copy()
    return fondu(extrait, entree=0.0005, sortie=min(queue + 0.02, extrait.shape[-1] / SR / 4))


def ecrire(chemin, signal, rng=None):
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    rng = rng or generateur(0)
    if signal.ndim == 1:
        signal = np.stack([signal, signal])
    tpdf = (rng.uniform(-0.5, 0.5, signal.shape) + rng.uniform(-0.5, 0.5, signal.shape)) / 32767
    entier = np.clip(np.round((signal + tpdf) * 32767), -32768, 32767).astype(np.int16)
    wavfile.write(chemin, SR, entier.T)
