import json
import os
import sqlite3
import time

CHEMIN = os.path.expanduser("~/atria/data/atria.db")

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crew (
  nom          TEXT PRIMARY KEY,
  role         TEXT NOT NULL,
  competences  TEXT NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'actif',
  badge        TEXT
);

CREATE TABLE IF NOT EXISTS compartiment (
  nom          TEXT PRIMARY KEY,
  ordre        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poste (
  nom          TEXT PRIMARY KEY,
  compartiment TEXT NOT NULL REFERENCES compartiment(nom),
  competence   TEXT NOT NULL,
  seuil        REAL NOT NULL,
  criticite    TEXT NOT NULL,
  titulaire    TEXT REFERENCES crew(nom)
);

CREATE TABLE IF NOT EXISTS vitals (
  crew         TEXT NOT NULL REFERENCES crew(nom),
  ts           REAL NOT NULL,
  hr           INTEGER,
  rmssd        REAL,
  sdnn         REAL,
  stress       REAL,
  PRIMARY KEY (crew, ts)
);

CREATE TABLE IF NOT EXISTS capacite (
  crew         TEXT NOT NULL REFERENCES crew(nom),
  ts           REAL NOT NULL,
  cognitive    REAL NOT NULL,
  fatigue      REAL,
  sommeil_h    REAL,
  dette_sociale INTEGER,
  expo_bruit   REAL,
  PRIMARY KEY (crew, ts)
);

CREATE TABLE IF NOT EXISTS ambiance (
  compartiment TEXT NOT NULL REFERENCES compartiment(nom),
  ts           REAL NOT NULL,
  co2          INTEGER,
  bruit_db     INTEGER,
  fumee        INTEGER DEFAULT 0,
  PRIMARY KEY (compartiment, ts)
);

CREATE TABLE IF NOT EXISTS presence (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  crew         TEXT NOT NULL REFERENCES crew(nom),
  compartiment TEXT NOT NULL REFERENCES compartiment(nom),
  entree       REAL NOT NULL,
  sortie       REAL
);

CREATE TABLE IF NOT EXISTS affectation (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  crew         TEXT NOT NULL REFERENCES crew(nom),
  poste        TEXT NOT NULL REFERENCES poste(nom),
  debut        REAL NOT NULL,
  fin          REAL,
  motif        TEXT NOT NULL,
  auteur       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           REAL NOT NULL,
  type         TEXT NOT NULL,
  acteur       TEXT,
  sujet        TEXT,
  motif        TEXT NOT NULL,
  donnees      TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  acteur       TEXT,
  role         TEXT NOT NULL DEFAULT 'anonyme',
  ts           REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS incident (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  crew         TEXT REFERENCES crew(nom),
  ts           REAL NOT NULL,
  canal        TEXT NOT NULL,
  type         TEXT NOT NULL,
  gravite      REAL NOT NULL,
  detail       TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_crew_ts ON incident(crew, ts DESC);
CREATE INDEX IF NOT EXISTS idx_incident_ts ON incident(ts DESC);

CREATE TABLE IF NOT EXISTS gabarit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  crew         TEXT NOT NULL REFERENCES crew(nom),
  empreinte    BLOB NOT NULL,
  cree_le      REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gabarit_crew ON gabarit(crew);
CREATE INDEX IF NOT EXISTS idx_journal_ts ON journal(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ambiance_ts ON ambiance(compartiment, ts DESC);
CREATE INDEX IF NOT EXISTS idx_capacite_crew_ts ON capacite(crew, ts DESC);
CREATE INDEX IF NOT EXISTS idx_presence_crew ON presence(crew, entree DESC);
CREATE INDEX IF NOT EXISTS idx_presence_comp ON presence(compartiment, entree DESC);
"""

TYPES_JOURNAL = ("refus", "derogation", "affectation", "alerte", "crise",
                 "identification", "systeme", "question", "biometrie", "conduite")


COLONNES_AJOUTEES = (
    ("ambiance", "temp_c", "REAL"),
    ("ambiance", "humidite", "REAL"),
    ("ambiance", "mq2_brut", "INTEGER"),
)


def connexion(chemin=CHEMIN):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    conn = sqlite3.connect(chemin, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    for table, colonne, type_ in COLONNES_AJOUTEES:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {colonne} {type_}")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    return conn


SEUIL_HUMIDITE = 60.0
SEUIL_MQ2 = 300
SILENCE_PP = 2
CLAQUEMENT_PP = 300


def bruit_db(pp):
    """Enveloppe micro en counts vers une echelle dB plausible."""
    import math
    pp = max(pp, SILENCE_PP)
    ratio = math.log10(pp / SILENCE_PP) / math.log10(CLAQUEMENT_PP / SILENCE_PP)
    return round(38 + ratio * 47)


def enregistrer_ambiance(conn, compartiment, mic_pp, mq2, temp_c, humidite):
    conn.execute(
        "INSERT OR REPLACE INTO ambiance"
        " (compartiment, ts, co2, bruit_db, fumee, temp_c, humidite, mq2_brut)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (compartiment, time.time(), None, bruit_db(mic_pp),
         1 if mq2 >= SEUIL_MQ2 else 0, temp_c, humidite, mq2))
    conn.commit()


def journaliser(conn, type_, motif, acteur=None, sujet=None, donnees=None):
    if type_ not in TYPES_JOURNAL:
        raise ValueError(f"type de journal inconnu: {type_}")
    conn.execute(
        "INSERT INTO journal (ts, type, acteur, sujet, motif, donnees) VALUES (?,?,?,?,?,?)",
        (time.time(), type_, acteur, sujet, motif,
         json.dumps(donnees, ensure_ascii=False) if donnees else None),
    )
    conn.commit()


def journal(conn, limite=50, depuis=None):
    if depuis is None:
        curseur = conn.execute("SELECT * FROM journal ORDER BY ts DESC LIMIT ?", (limite,))
    else:
        curseur = conn.execute(
            "SELECT * FROM journal WHERE ts >= ? ORDER BY ts DESC LIMIT ?", (depuis, limite))
    return [dict(r) for r in curseur]


def releve_capacite(conn, crew, points=48):
    curseur = conn.execute(
        "SELECT ts, cognitive FROM capacite WHERE crew = ? ORDER BY ts DESC LIMIT ?",
        (crew, points))
    return list(reversed([(r["ts"], r["cognitive"]) for r in curseur]))


def contacts(conn, crew, depuis):
    """Membres ayant partage un compartiment avec `crew` depuis `depuis`."""
    curseur = conn.execute(
        """
        SELECT DISTINCT b.crew AS autre,
               SUM(MIN(COALESCE(a.sortie, ?), COALESCE(b.sortie, ?))
                   - MAX(a.entree, b.entree)) AS secondes
        FROM presence a
        JOIN presence b
          ON a.compartiment = b.compartiment
         AND b.crew != a.crew
         AND MAX(a.entree, b.entree) < MIN(COALESCE(a.sortie, ?), COALESCE(b.sortie, ?))
        WHERE a.crew = ? AND a.entree >= ?
        GROUP BY b.crew
        HAVING secondes > 0
        ORDER BY secondes DESC
        """,
        (time.time(), time.time(), time.time(), time.time(), crew, depuis),
    )
    return [(r["autre"], r["secondes"]) for r in curseur]


def occupants(conn, compartiment):
    curseur = conn.execute(
        "SELECT crew FROM presence WHERE compartiment = ? AND sortie IS NULL",
        (compartiment,))
    return [r["crew"] for r in curseur]


def entrer(conn, crew, compartiment):
    maintenant = time.time()
    conn.execute("UPDATE presence SET sortie = ? WHERE crew = ? AND sortie IS NULL",
                 (maintenant, crew))
    conn.execute("INSERT INTO presence (crew, compartiment, entree) VALUES (?,?,?)",
                 (crew, compartiment, maintenant))
    conn.commit()


SESSION_TTL_S = 0
"""Duree de vie d'une identite badgee, en secondes. 0 desactive l'expiration.

La session se ferme desormais par le bouton du dashboard ou par un nouveau badge. Le
compromis est assume : une session laissee ouverte expose les donnees medicales a tout
navigateur du reseau de bord, mais un verrou qui saute toutes les trois minutes pendant
une demonstration coutait plus qu'il ne protegeait."""


def ouvrir_session(conn, acteur, role):
    conn.execute(
        "INSERT INTO session (id, acteur, role, ts) VALUES (1,?,?,?)"
        " ON CONFLICT(id) DO UPDATE SET acteur=excluded.acteur,"
        " role=excluded.role, ts=excluded.ts",
        (acteur, role, time.time()))
    conn.commit()


def fermer_session(conn):
    conn.execute("UPDATE session SET acteur=NULL, role='anonyme', ts=? WHERE id=1",
                 (0.0,))
    conn.commit()


def session(conn):
    """Identite courante, derivee du dernier badge presente au terminal."""
    r = conn.execute("SELECT acteur, role, ts FROM session WHERE id = 1").fetchone()
    expiree = SESSION_TTL_S and time.time() - r["ts"] > SESSION_TTL_S if r else True
    if r is None or not r["acteur"] or expiree:
        return {"acteur": None, "role": "anonyme", "capitaine": False, "expire": True}
    return {"acteur": r["acteur"], "role": r["role"],
            "capitaine": r["role"] == "capitaine", "expire": False}


def serie_ambiance(conn, compartiment, heures=24):
    depuis = time.time() - heures * 3600
    curseur = conn.execute(
        "SELECT ts, temp_c, humidite, bruit_db, mq2_brut, fumee FROM ambiance"
        " WHERE compartiment = ? AND ts >= ? ORDER BY ts",
        (compartiment, depuis))
    return [dict(r) for r in curseur]


def serie_vitals(conn, crew, heures=24):
    depuis = time.time() - heures * 3600
    curseur = conn.execute(
        "SELECT ts, hr, rmssd, sdnn, stress FROM vitals"
        " WHERE crew = ? AND ts >= ? ORDER BY ts",
        (crew, depuis))
    return [dict(r) for r in curseur]


def enregistrer_gabarit(conn, crew, empreinte):
    conn.execute("INSERT INTO gabarit (crew, empreinte, cree_le) VALUES (?, ?, ?)",
                 (crew, empreinte.astype("float32").tobytes(), time.time()))
    conn.commit()


def gabarits(conn, crew):
    import numpy as np
    lignes = conn.execute("SELECT empreinte FROM gabarit WHERE crew = ?", (crew,)).fetchall()
    return [np.frombuffer(l["empreinte"], dtype="float32") for l in lignes]


def membres_enroles(conn):
    lignes = conn.execute(
        "SELECT crew, COUNT(*) n FROM gabarit GROUP BY crew ORDER BY crew").fetchall()
    return [(l["crew"], l["n"]) for l in lignes]


def oublier_gabarits(conn, crew):
    n = conn.execute("DELETE FROM gabarit WHERE crew = ?", (crew,)).rowcount
    conn.commit()
    return n


SEUIL_CONDUITE = 0.60
DEMI_VIE_INCIDENT_S = 7200.0
"""Deux heures. Un incident pese pleinement sur le moment, puis s'efface de moitie toutes
les deux heures. Personne n'ecrit le score de conduite : il se deduit des incidents, donc
il remonte tout seul des que le comportement cesse."""

FENETRE_INCIDENT_S = 86400.0


def enregistrer_incident(conn, crew, canal, type_, gravite, detail=None):
    conn.execute(
        "INSERT INTO incident (crew, ts, canal, type, gravite, detail)"
        " VALUES (?,?,?,?,?,?)",
        (crew, time.time(), canal, type_, gravite, detail))
    conn.commit()


def incidents(conn, crew=None, limite=40, depuis=None):
    depuis = depuis if depuis is not None else time.time() - FENETRE_INCIDENT_S
    if crew:
        lignes = conn.execute(
            "SELECT * FROM incident WHERE crew = ? AND ts >= ? ORDER BY ts DESC LIMIT ?",
            (crew, depuis, limite)).fetchall()
    else:
        lignes = conn.execute(
            "SELECT * FROM incident WHERE ts >= ? ORDER BY ts DESC LIMIT ?",
            (depuis, limite)).fetchall()
    return [dict(l) for l in lignes]


def conduite(conn, crew, maintenant=None):
    """Score de conduite entre 0 et 1, deduit des incidents amortis par le temps."""
    maintenant = maintenant or time.time()
    lignes = conn.execute(
        "SELECT ts, gravite FROM incident WHERE crew = ? AND ts >= ?",
        (crew, maintenant - FENETRE_INCIDENT_S)).fetchall()
    penalite = 0.0
    for l in lignes:
        age = max(0.0, maintenant - l["ts"])
        penalite += l["gravite"] * (0.5 ** (age / DEMI_VIE_INCIDENT_S))
    return max(0.0, min(1.0, 1.0 - penalite))


def conduites(conn, maintenant=None):
    """Conduite de tout l'equipage en une passe, pour l'instantane du dashboard."""
    maintenant = maintenant or time.time()
    scores = {}
    lignes = conn.execute(
        "SELECT crew, ts, gravite FROM incident WHERE crew IS NOT NULL AND ts >= ?",
        (maintenant - FENETRE_INCIDENT_S,)).fetchall()
    for l in lignes:
        age = max(0.0, maintenant - l["ts"])
        scores[l["crew"]] = scores.get(l["crew"], 0.0) + \
            l["gravite"] * (0.5 ** (age / DEMI_VIE_INCIDENT_S))
    return {nom: max(0.0, min(1.0, 1.0 - p)) for nom, p in scores.items()}


def serie_conduite(conn, crew, heures=24, pas=30):
    """Reconstitue la courbe de conduite en rejouant les incidents dans le temps."""
    maintenant = time.time()
    debut = maintenant - heures * 3600
    lignes = conn.execute(
        "SELECT ts, gravite FROM incident WHERE crew = ? AND ts >= ?",
        (crew, debut - FENETRE_INCIDENT_S)).fetchall()
    points = []
    for i in range(pas + 1):
        t = debut + (maintenant - debut) * i / pas
        penalite = sum(l["gravite"] * (0.5 ** ((t - l["ts"]) / DEMI_VIE_INCIDENT_S))
                       for l in lignes if l["ts"] <= t)
        points.append({"ts": t, "valeur": round(max(0.0, min(1.0, 1.0 - penalite)), 3)})
    return points
