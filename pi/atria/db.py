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

CREATE INDEX IF NOT EXISTS idx_journal_ts ON journal(ts DESC);
CREATE INDEX IF NOT EXISTS idx_capacite_crew_ts ON capacite(crew, ts DESC);
CREATE INDEX IF NOT EXISTS idx_presence_crew ON presence(crew, entree DESC);
CREATE INDEX IF NOT EXISTS idx_presence_comp ON presence(compartiment, entree DESC);
"""

TYPES_JOURNAL = ("refus", "derogation", "affectation", "alerte", "crise",
                 "identification", "systeme", "question")


def connexion(chemin=CHEMIN):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    conn = sqlite3.connect(chemin, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


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
