import sys
from pathlib import Path

import numpy as np

from dsp import (
    SR,
    db,
    dent_de_scie,
    ecrire,
    enveloppe,
    fondu,
    generateur,
    normaliser_crete,
    passe_bande,
    passe_bas,
    passe_haut,
    place,
    reponse_impulsionnelle,
    reverberer,
    rogner,
    saturer,
    secondes,
    sinus,
    stereo,
    temps,
    bruit_blanc,
    bruit_colore,
)

DOSSIER = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "public/audio/sfx"


def transitoire(rng, duree, centre, q=0.8, decroissance=0.0015):
    n = secondes(duree)
    return passe_bande(bruit_blanc(n, rng), centre, q) * enveloppe(n, 0.0002, decroissance)


def blip(frequence, duree, decroissance, indice_fm=0.0, rapport_fm=2.0, attaque=0.002):
    n = secondes(duree)
    t = temps(duree)
    modulation = indice_fm * np.exp(-t / (decroissance * 0.6)) * np.sin(2 * np.pi * frequence * rapport_fm * t)
    return np.sin(2 * np.pi * frequence * t + modulation) * enveloppe(n, attaque, decroissance)


def finaliser(nom, signal, rng, boucle=False):
    if boucle:
        signal = normaliser_crete(signal - signal.mean(axis=1, keepdims=True))
    else:
        signal = normaliser_crete(rogner(passe_haut(signal, 22.0)))
    ecrire(DOSSIER / f"{nom}.wav", signal, rng)
    print(f"{nom}: {signal.shape[-1] / SR:.2f} s")


def telemetrie_bip():
    rng = generateur(101)
    corps = blip(1760.0, 0.3, 0.032, indice_fm=0.9, rapport_fm=2.0)
    corps += 0.22 * blip(3520.0, 0.3, 0.018)
    corps += 0.12 * np.pad(transitoire(rng, 0.01, 7500, 1.2), (0, secondes(0.29)))
    signal = stereo(corps, 0.0)
    ir = reponse_impulsionnelle(rng, 0.35, predelai=0.004, clarte=0.4)
    finaliser("telemetrie-bip", reverberer(signal, ir, 0.11), rng)


def grondement_vaisseau():
    rng = generateur(202)
    n = secondes(10.0)
    f = np.fft.rfftfreq(n, 1 / SR)
    t = temps(10.0)

    def nappe(forme, graine):
        r = generateur(graine)
        spectre = forme * np.exp(1j * r.uniform(0, 2 * np.pi, f.shape[0]))
        spectre[0] = 0
        y = np.fft.irfft(spectre, n)
        return y / np.std(y)

    g = np.maximum(f, 1.0)
    forme_grave = (g / 38.0) ** 2 / (1 + (g / 38.0) ** 4) + 0.35 / (1 + (g / 160.0) ** 2)
    forme_air = np.exp(-0.5 * (np.log(g / 320.0) / 0.55) ** 2)
    forme_souffle = np.exp(-0.5 * (np.log(g / 4200.0) / 0.5) ** 2)
    canaux = []
    for c in range(2):
        grave = 0.8 * nappe(forme_grave, 10 + c) + 0.6 * nappe(forme_grave, 20)
        air = nappe(forme_air, 30 + c) * (1 + 0.25 * np.sin(2 * np.pi * 0.2 * t + c) + 0.15 * np.sin(2 * np.pi * 0.7 * t))
        souffle = nappe(forme_souffle, 40 + c) * (1 + 0.3 * np.sin(2 * np.pi * 0.1 * t + 1.3 * c))
        bourdon = (
            np.sin(2 * np.pi * 43.7 * t)
            + 0.6 * np.sin(2 * np.pi * 44.0 * t + 0.4)
            + 0.35 * np.sin(2 * np.pi * 87.4 * t + 1.1)
            + 0.18 * np.sin(2 * np.pi * 131.1 * t + 2.0)
            + 0.07 * np.sin(2 * np.pi * 174.8 * t + 0.5)
        ) * (1 + 0.12 * np.sin(2 * np.pi * 0.3 * t))
        chant = 0.05 * np.sin(2 * np.pi * 262.2 * t + c) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.1 * t))
        canaux.append(0.55 * grave + 0.2 * air + 0.03 * souffle + 0.34 * bourdon + chant)
    signal = np.stack(canaux)
    ecoule = ((np.arange(n) - secondes(6.2)) % n) / SR
    modes = [(173.0, 1.4), (241.0, 1.1), (389.0, 0.8), (617.0, 0.6), (911.0, 0.4)]
    choc = sum(np.sin(2 * np.pi * f * ecoule) * np.exp(-ecoule / d) for f, d in modes) / len(modes)
    choc *= np.clip(ecoule / 0.004, 0, 1)
    signal += 0.05 * np.stack([choc, 0.7 * choc])
    ir = reponse_impulsionnelle(rng, 1.6, predelai=0.02, clarte=0.35, metal=0.6)
    signal = reverberer(signal, ir, 0.25, circulaire=True)
    finaliser("grondement-vaisseau", signal, rng, boucle=True)


def clic_validation():
    rng = generateur(303)
    n = secondes(0.6)
    mono = np.zeros(n)
    place(mono, transitoire(rng, 0.02, 4500, 1.5, 0.004), 0.0, 0.35)
    place(mono, passe_haut(bruit_blanc(secondes(0.004), rng), 2500) * np.hanning(secondes(0.004)), 0.0, 0.25)
    thock = sinus(np.geomspace(210, 150, secondes(0.12)), phase=0.25) * enveloppe(secondes(0.12), 0.0008, 0.022)
    place(mono, thock, 0.0, 0.55)
    place(mono, blip(880.0, 0.4, 0.06, indice_fm=0.7), 0.012, 0.5)
    place(mono, blip(1174.66, 0.45, 0.085, indice_fm=0.7), 0.07, 0.55)
    place(mono, 0.15 * blip(2349.3, 0.3, 0.05), 0.07, 1.0)
    signal = stereo(mono, 0.0, largeur=0.4)
    ir = reponse_impulsionnelle(rng, 0.5, predelai=0.006, clarte=0.45)
    finaliser("clic-validation", reverberer(signal, ir, 0.14), rng)


def balayage_scan():
    rng = generateur(404)
    duree = 1.7
    n = secondes(duree)
    t = temps(duree)
    x = t / duree
    forme = np.sin(np.pi * np.clip(x / 0.92, 0, 1)) ** 1.5
    centre = 280 * (7200 / 280) ** (x ** 1.3)
    bande = passe_bande(bruit_colore(n, rng, 0.6), centre, 5.0) * forme
    fil = sinus(620 * (2600 / 620) ** x) * (0.55 + 0.45 * np.sin(2 * np.pi * 31 * t)) * forme * 0.16
    grains = np.zeros(n)
    cadence = 14 + 70 * x ** 1.6
    instants = np.nonzero(np.diff(np.floor(np.cumsum(cadence) / SR)) > 0)[0]
    for i in instants:
        g = transitoire(rng, 0.012, 3500 + 5000 * x[i], 2.0, 0.0012)
        fin = min(n, i + g.shape[0])
        grains[i:fin] += g[: fin - i] * (0.2 + 0.8 * forme[i]) * (x[i] < 0.88)
    pan = -0.75 + 1.5 * x
    signal = stereo(bande * 0.9 + fil, pan) + stereo(grains * 0.3, -pan)
    ir = reponse_impulsionnelle(rng, 0.9, predelai=0.012, clarte=0.5)
    finaliser("balayage-scan", reverberer(signal, ir, 0.22), rng)


def verrouillage():
    rng = generateur(505)
    n = secondes(1.3)
    mono = np.zeros(n)
    for instant, frequence in [(0.0, 1396.9), (0.085, 1567.98), (0.15, 1760.0), (0.2, 1975.5)]:
        place(mono, blip(frequence, 0.12, 0.014), instant, 0.35)
        place(mono, transitoire(rng, 0.008, 6000, 1.5, 0.0009), instant, 0.18)
    verrou = 0.26
    accord = blip(1174.66, 1.0, 0.2, indice_fm=0.6, rapport_fm=3.0) + 0.7 * blip(1760.0, 1.0, 0.17, indice_fm=0.4) + 0.2 * blip(2349.3, 1.0, 0.1)
    place(mono, accord, verrou, 0.42)
    serrage = sinus(np.geomspace(160, 95, secondes(0.15))) * enveloppe(secondes(0.15), 0.0008, 0.035)
    place(mono, serrage, verrou, 0.55)
    place(mono, transitoire(rng, 0.015, 3200, 1.0, 0.002), verrou, 0.35)
    signal = stereo(mono, 0.0, largeur=0.5)
    ir = reponse_impulsionnelle(rng, 0.8, predelai=0.008, clarte=0.5)
    finaliser("verrouillage", reverberer(signal, ir, 0.16), rng)


def tic_point():
    rng = generateur(606)
    n = secondes(0.2)
    mono = np.zeros(n)
    place(mono, blip(3322.4, 0.08, 0.006, attaque=0.0004), 0.0, 0.6)
    place(mono, blip(1661.2, 0.08, 0.009, attaque=0.0006), 0.0, 0.3)
    place(mono, transitoire(rng, 0.006, 9000, 1.5, 0.0006), 0.0, 0.35)
    signal = stereo(mono, 0.0)
    ir = reponse_impulsionnelle(rng, 0.25, predelai=0.003, clarte=0.4)
    finaliser("tic-point", reverberer(signal, ir, 0.07), rng)


def buzzer_refus():
    rng = generateur(707)
    n = secondes(1.4)
    mono = np.zeros(n)
    for instant, notes, longueur in [(0.0, (146.83, 155.56), 0.2), (0.27, (138.59, 146.83), 0.34)]:
        k = secondes(longueur + 0.2)
        ton = sum(dent_de_scie(f * d, k) for f in notes for d in (0.997, 1.003))
        ton = passe_bas(ton, 1500 * np.exp(-np.arange(k) / SR / 0.35) + 500, 0.9)
        ton = saturer(ton * 0.5, 1.8)
        sous = sinus(73.4, k) * 0.9
        corps = (ton + sous) * enveloppe(k, 0.004, 0.06, maintien=longueur - 0.06)
        place(mono, corps, instant, 0.5)
        place(mono, transitoire(rng, 0.01, 2500, 1.0, 0.0015), instant, 0.3)
    grain = np.round(mono * 24) / 24
    mono = 0.85 * mono + 0.15 * passe_bas(grain, 5000)
    signal = stereo(mono, 0.0, largeur=0.3)
    ir = reponse_impulsionnelle(rng, 0.7, predelai=0.01, clarte=0.4, metal=0.8)
    finaliser("buzzer-refus", reverberer(signal, ir, 0.14), rng)


def alarme():
    rng = generateur(808)
    duree = 4.0
    n = secondes(duree)
    mono = np.zeros(n)
    periode = 0.5
    for i in range(8):
        k = secondes(0.36)
        haut = i % 2 == 0
        base = 659.25 if haut else 587.33
        glisse = base * (1 + 0.02 * np.exp(-np.arange(k) / SR / 0.02))
        ton = sum(np.sin(2 * np.pi * np.cumsum(glisse * h) / SR) / h for h in (1, 3, 5, 7))
        ton += 0.5 * sum(np.sin(2 * np.pi * np.cumsum(glisse * 1.4983 * h) / SR) / h for h in (1, 3))
        ton = passe_bas(ton, 2600, 0.8) * enveloppe(k, 0.006, 0.05, maintien=0.24)
        place(mono, ton, i * periode, 0.5)
    sous = sinus(110.0, n) * 0.25 * (0.5 + 0.5 * np.cos(2 * np.pi * np.arange(n) / SR / periode))
    signal = stereo(mono + sous, 0.0, largeur=0.4)
    ir = reponse_impulsionnelle(rng, 1.4, predelai=0.015, clarte=0.45, metal=1.0)
    finaliser("alarme", reverberer(signal, ir, 0.3, circulaire=True), rng, boucle=True)


def porte_etanche():
    rng = generateur(909)
    duree = 3.6
    n = secondes(duree)
    signal = np.zeros((2, n))
    k = secondes(0.9)
    tk = np.arange(k) / SR
    souffle = passe_bande(bruit_blanc(k, rng), 6500 * (2400 / 6500) ** (tk / 0.9), 1.2) * enveloppe(k, 0.015, 0.22)
    place(signal, stereo(souffle, -0.3, largeur=0.8), 0.0, 0.35)
    k = secondes(1.2)
    tk = np.arange(k) / SR
    course = np.clip(tk / 1.0, 0, 1)
    forme = np.sin(np.pi * course) ** 0.6
    grondement = passe_bas(bruit_colore(k, rng, 2.0), 220) * forme
    moteur = passe_bas(dent_de_scie(92 + 50 * course, k) + 0.5 * dent_de_scie(184 + 100 * course, k), 700) * forme
    friction = passe_bande(bruit_blanc(k, rng), 900 + 400 * course, 3.0) * forme * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tk))
    place(signal, stereo(0.9 * grondement + 0.12 * moteur + 0.12 * friction, 0.5 - course, largeur=0.5), 0.15, 0.6)
    impact = 1.2
    k = secondes(2.2)
    tk = np.arange(k) / SR
    sous = sinus(45 + 30 * np.exp(-tk / 0.06), phase=0.25) * enveloppe(k, 0.001, 0.2)
    corps = passe_bas(bruit_blanc(k, rng), 900) * enveloppe(k, 0.0005, 0.05)
    partiels = [(211.0, 0.9), (347.3, 0.7), (529.1, 0.55), (781.7, 0.4), (1123.4, 0.3), (1579.9, 0.22), (2203.0, 0.15)]
    metal = sum(np.sin(2 * np.pi * f * tk + rng.uniform(0, 6.28)) * np.exp(-tk / d) for f, d in partiels) / len(partiels)
    choc = saturer(1.0 * sous + 0.7 * corps, 1.3) + 0.35 * metal
    place(signal, stereo(choc, 0.0, largeur=0.4), impact, 0.9)
    place(signal, stereo(transitoire(rng, 0.02, 2800, 0.8, 0.002), 0.0), impact, 0.5)
    for instant, pan in [(impact + 0.3, -0.35), (impact + 0.37, 0.35)]:
        clic = transitoire(rng, 0.05, 3800, 2.5, 0.004) + 0.5 * blip(1250.0, 0.05, 0.008)
        place(signal, stereo(clic, pan), instant, 0.35)
    k = secondes(1.4)
    joint = passe_bande(bruit_blanc(k, rng), 3000, 0.7) * enveloppe(k, 0.04, 0.35)
    place(signal, stereo(joint, 0.0, largeur=1.0), impact + 0.42, 0.1)
    ir = reponse_impulsionnelle(rng, 1.9, predelai=0.02, clarte=0.35, metal=1.2)
    finaliser("porte-etanche", reverberer(signal, ir, 0.3), rng)


def rembobinage():
    rng = generateur(1010)
    duree = 1.8
    n = secondes(duree)
    t = temps(duree)
    x = t / duree
    forme = np.clip(x / 0.15, 0, 1) * np.clip((duree - t) / 0.12, 0, 1)
    vitesse = 1 + 3 * x ** 1.5
    flutter = 1 + 0.035 * np.sin(2 * np.pi * np.cumsum(9 + 14 * x) / SR)
    sifflement = sinus(1800 * vitesse * flutter) * 0.12 + sinus(3600 * vitesse * flutter) * 0.04
    grains = np.zeros(n)
    cadence = 9 + 46 * x ** 1.4
    instants = np.nonzero(np.diff(np.floor(np.cumsum(cadence) / SR)) > 0)[0]
    for i in instants:
        k = secondes(0.025)
        g = passe_bande(bruit_blanc(k, rng), 900 * vitesse[i], 3.0) * np.hanning(k)
        fin = min(n, i + k)
        grains[i:fin] += g[: fin - i]
    bande = passe_bande(bruit_colore(n, rng, 1.0), 700 * vitesse, 1.2) * 0.35
    source = np.zeros(n)
    place(source, passe_bas(bruit_blanc(secondes(0.08), rng), 3000) * np.hanning(secondes(0.08)), 0.0)
    place(source, blip(587.33, 0.3, 0.06), 0.0, 0.8)
    ir = reponse_impulsionnelle(rng, 1.6, predelai=0.0, clarte=0.5)
    aspire = reverberer(source, ir, 1.0, sec=0.0)[0][: secondes(1.7)][::-1]
    mono = (sifflement + 0.5 * grains + bande) * forme
    signal = stereo(mono, 0.25 * np.sin(2 * np.pi * 1.1 * t), largeur=0.6)
    place(signal, stereo(aspire / (np.max(np.abs(aspire)) + 1e-9), 0.0, largeur=1.0), 0.1, 0.45)
    stop = sinus(np.geomspace(220, 90, secondes(0.1))) * enveloppe(secondes(0.1), 0.0008, 0.02)
    place(signal, stereo(stop + 0.4 * transitoire(rng, 0.1, 2500, 1.0, 0.003), 0.0), duree - 0.12, 0.5)
    ir2 = reponse_impulsionnelle(rng, 0.6, predelai=0.005, clarte=0.5)
    finaliser("rembobinage", reverberer(signal, ir2, 0.12), rng)


def impact_titre():
    rng = generateur(1111)
    duree = 6.0
    n = secondes(duree)
    t = temps(duree)
    sous = sinus(32 + 26 * np.exp(-t / 0.35), phase=0.25) * enveloppe(n, 0.002, 1.1)
    sous = saturer(sous * 1.2, 1.6)
    corps = passe_bas(bruit_colore(n, rng, 1.0), 1100) * enveloppe(n, 0.001, 0.09)
    boum = sinus(110 * (1 + 0.25 * np.exp(-t / 0.05))) * enveloppe(n, 0.001, 0.25)
    craque = passe_haut(bruit_blanc(n, rng), 3000) * enveloppe(n, 0.0002, 0.006)
    accord = sum(dent_de_scie(f * d, n) for f in (36.71, 73.42, 110.0, 146.83) for d in (0.996, 1.004))
    accord = passe_bas(accord, 180 + 1400 * np.exp(-t / 0.4), 0.9) * enveloppe(n, 0.004, 1.3) * 0.18
    partiels = [(523.0, 1.8), (787.0, 1.5), (1061.0, 1.2), (1433.0, 0.9), (1871.0, 0.7), (2617.0, 0.5)]
    reflet = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d) for f, d in partiels) / len(partiels)
    reflet *= np.clip(t / 0.02, 0, 1) * 0.12
    mono = 0.9 * sous + 0.5 * corps + 0.4 * boum + 0.3 * craque + accord
    signal = stereo(mono, 0.0, largeur=0.3) + stereo(reflet, 0.0, largeur=1.0)
    ir = reponse_impulsionnelle(rng, 3.4, predelai=0.025, clarte=0.4, metal=0.5)
    finaliser("impact-titre", reverberer(signal, ir, 0.28), rng)


def whoosh():
    rng = generateur(1212)
    duree = 1.3
    n = secondes(duree)
    t = temps(duree)
    x = t / duree
    forme = np.where(x < 0.62, (x / 0.62) ** 2.2, np.exp(-(x - 0.62) / 0.09))
    centre = 350 + 2800 * np.sin(np.pi * np.clip(x / 0.8, 0, 1)) ** 2
    souffle = passe_bande(bruit_colore(n, rng, 0.8), centre, 1.4) * forme
    air = passe_haut(passe_bas(bruit_colore(n, rng, 1.6), 500 + 900 * forme), 90) * forme * 0.6
    ton = sinus(420 + 280 * np.sin(np.pi * np.clip(x / 0.75, 0, 1))) * forme * 0.05
    pan = -0.8 + 1.6 * np.clip(x / 0.85, 0, 1)
    signal = stereo(souffle + air + ton, pan, largeur=0.5)
    ir = reponse_impulsionnelle(rng, 0.7, predelai=0.01, clarte=0.5)
    finaliser("whoosh", reverberer(signal, ir, 0.15), rng)


def pulsation():
    rng = generateur(1313)
    duree = 1.8
    n = secondes(duree)
    t = temps(duree)
    sous = sinus(58 + 14 * np.exp(-t / 0.04), phase=0.25) * enveloppe(n, 0.003, 0.17)
    sous = saturer(sous, 1.4)
    chaleur = (sinus(293.66, n) + 0.3 * sinus(587.33, n) + 0.12 * sinus(880.0, n)) * enveloppe(n, 0.012, 0.22)
    halo = sinus(1174.66, n) * enveloppe(n, 0.02, 0.4) * 0.08
    toucher = passe_bas(bruit_blanc(n, rng), 1800) * enveloppe(n, 0.0008, 0.012) * 0.25
    mono = 0.9 * sous + 0.28 * chaleur + halo + toucher
    signal = stereo(mono, 0.0, largeur=0.5)
    ir = reponse_impulsionnelle(rng, 1.3, predelai=0.015, clarte=0.45)
    finaliser("pulsation", reverberer(signal, ir, 0.2), rng)


EFFETS = [
    telemetrie_bip,
    grondement_vaisseau,
    clic_validation,
    balayage_scan,
    verrouillage,
    tic_point,
    buzzer_refus,
    alarme,
    porte_etanche,
    rembobinage,
    impact_titre,
    whoosh,
    pulsation,
]

if __name__ == "__main__":
    for effet in EFFETS:
        effet()
