import random
import time

from . import db

NOMS = ["moreau", "bianchi", "reyes", "weber", "novak", "silva", "martin", "bernard",
        "dubois", "durand", "lefebvre", "mercier", "garcia", "rossi", "lambert", "fontaine",
        "girard", "morel", "leroy", "roux", "fournier", "andre", "muller", "blanc"]

COMPETENCES = ["chirurgie", "propulsion", "botanique", "navigation", "maintenance",
               "laboratoire", "informatique", "medecine"]

ROLES = ["officier", "technicien", "specialiste", "medecin"]

COMPARTIMENTS = ["infirmerie", "réacteur", "pont", "serre", "atelier", "laboratoire"]

POSTES = [
    ("chirurgie", "infirmerie", "chirurgie", 0.70, "vital"),
    ("propulsion", "réacteur", "propulsion", 0.65, "vital"),
    ("navigation", "pont", "navigation", 0.60, "vital"),
    ("serre", "serre", "botanique", 0.40, "haute"),
    ("maintenance", "atelier", "maintenance", 0.50, "haute"),
    ("laboratoire", "laboratoire", "laboratoire", 0.45, "moyenne"),
]

AMBIANCE = {
    "infirmerie": (620, 41), "réacteur": (780, 68), "pont": (540, 44),
    "serre": (910, 52), "atelier": (700, 61), "laboratoire": (580, 46),
}

BADGES = {"moreau": "FC2A1B17"}

PROFILS = {
    "fournier": (0.56, -0.006, ["chirurgie", "navigation", "propulsion"]),
    "bernard":  (0.94, +0.001, ["chirurgie", "medecine"]),
    "reyes":    (0.68, -0.011, ["propulsion", "maintenance"]),
    "moreau":   (0.71, -0.003, ["chirurgie", "laboratoire"]),
    "blanc":    (0.38, -0.002, ["laboratoire", "maintenance"]),
    "dubois":   (0.44, +0.002, ["maintenance"]),
}

SANTE = [0.92, 0.88, 0.85, 0.83, 0.81, 0.78, 0.76, 0.74,
         0.72, 0.69, 0.66, 0.62, 0.58, 0.54, 0.49, 0.45, 0.41, 0.35]

HEURES_HISTORIQUE = 24
PAS_MINUTES = 30


def peupler(conn, graine=20800921, force=False):
    existant = conn.execute("SELECT COUNT(*) AS n FROM crew").fetchone()["n"]
    if existant and not force:
        return existant

    if force:
        for table in ("journal", "affectation", "presence", "ambiance",
                      "capacite", "vitals", "poste", "compartiment", "crew"):
            conn.execute(f"DELETE FROM {table}")

    rng = random.Random(graine)
    maintenant = time.time()

    for ordre, nom in enumerate(COMPARTIMENTS):
        conn.execute("INSERT INTO compartiment (nom, ordre) VALUES (?,?)", (nom, ordre))

    libres = [v for v in SANTE]
    rng.shuffle(libres)
    equipage = []
    for i, nom in enumerate(NOMS):
        if nom in PROFILS:
            actuel, pente, comps = PROFILS[nom]
        else:
            actuel = libres.pop() if libres else round(rng.uniform(0.55, 0.9), 2)
            pente = rng.choice([0.0, 0.001, -0.002, -0.004, 0.002, -0.001])
            comps = sorted(rng.sample(COMPETENCES, rng.randint(1, 3)))
        sommeil = round(2.5 + actuel * 6.0 + rng.gauss(0, 0.4), 1)
        conn.execute(
            "INSERT INTO crew (nom, role, competences, statut, badge) VALUES (?,?,?,?,?)",
            (nom, rng.choice(ROLES), ",".join(comps), "actif", BADGES.get(nom)))
        equipage.append((nom, comps, round(actuel, 2), max(2.0, sommeil), pente))

    for nom, compartiment, competence, seuil, criticite in POSTES:
        conn.execute(
            "INSERT INTO poste (nom, compartiment, competence, seuil, criticite) VALUES (?,?,?,?,?)",
            (nom, compartiment, competence, seuil, criticite))

    pas = PAS_MINUTES * 60
    points = int(HEURES_HISTORIQUE * 3600 / pas)
    for nom, comps, actuel, sommeil, pente in equipage:
        hr_base = int(58 + (1 - actuel) * 26)
        rmssd_base = 18 + actuel * 40
        for k in range(points, -1, -1):
            ts = maintenant - k * pas
            heures_avant = k * pas / 3600.0
            valeur = actuel - pente * heures_avant + rng.gauss(0, 0.008)
            cognitive = round(min(1.0, max(0.05, valeur)), 3)
            stress = round(min(1.0, max(0.0, 1.0 - cognitive + rng.gauss(0, 0.04))), 3)
            conn.execute(
                "INSERT OR REPLACE INTO capacite (crew, ts, cognitive, fatigue, sommeil_h,"
                " dette_sociale, expo_bruit) VALUES (?,?,?,?,?,?,?)",
                (nom, ts, cognitive, round(1 - cognitive, 3), sommeil,
                 rng.randint(0, 9), round(rng.uniform(40, 70), 1)))
            conn.execute(
                "INSERT OR REPLACE INTO vitals (crew, ts, hr, rmssd, sdnn, stress)"
                " VALUES (?,?,?,?,?,?)",
                (nom, ts, int(hr_base + rng.gauss(0, 3)),
                 round(rmssd_base + rng.gauss(0, 4), 1),
                 round(rmssd_base * 1.4 + rng.gauss(0, 5), 1), stress))

    for compartiment, (co2, bruit) in AMBIANCE.items():
        for k in range(points, -1, -1):
            ts = maintenant - k * pas
            conn.execute(
                "INSERT OR REPLACE INTO ambiance (compartiment, ts, co2, bruit_db, fumee)"
                " VALUES (?,?,?,?,0)",
                (compartiment, ts, int(co2 + rng.gauss(0, 35)), int(bruit + rng.gauss(0, 3))))

    for i, (nom, *_) in enumerate(equipage):
        compartiment = COMPARTIMENTS[i % len(COMPARTIMENTS)]
        for j in range(3, 0, -1):
            precedent = COMPARTIMENTS[(i + j) % len(COMPARTIMENTS)]
            conn.execute(
                "INSERT INTO presence (crew, compartiment, entree, sortie) VALUES (?,?,?,?)",
                (nom, precedent, maintenant - j * 7200, maintenant - (j - 1) * 7200 - 60))
        conn.execute("INSERT INTO presence (crew, compartiment, entree) VALUES (?,?,?)",
                     (nom, compartiment, maintenant - 1800))

    capacites = {
        r["crew"]: r["cognitive"] for r in conn.execute(
            "SELECT crew, cognitive FROM capacite c WHERE ts = "
            "(SELECT MAX(ts) FROM capacite WHERE crew = c.crew)")
    }
    pris = set()
    for nom, compartiment, competence, seuil, criticite in POSTES:
        aptes = [n for n, comps, *_ in equipage
                 if competence in comps and capacites.get(n, 0) >= seuil and n not in pris]
        if not aptes:
            continue
        titulaire = max(aptes, key=lambda n: capacites[n])
        pris.add(titulaire)
        conn.execute("UPDATE poste SET titulaire = ? WHERE nom = ?", (titulaire, nom))
        conn.execute(
            "INSERT INTO affectation (crew, poste, debut, motif, auteur) VALUES (?,?,?,?,?)",
            (titulaire, nom, maintenant - 3600,
             f"capacité {capacites[titulaire]:.2f} au-dessus du seuil {seuil:.2f}", "atria"))

    db.journaliser(conn, "systeme", "initialisation du registre d'équipage",
                   acteur="atria", donnees={"equipage": len(equipage), "postes": len(POSTES)})
    conn.commit()
    return len(equipage)
