import time
from dataclasses import dataclass, field

from . import db, seed


@dataclass
class Crew:
    nom: str
    role: str
    competences: set
    cognitive: float
    fatigue: float
    sommeil_h: float
    hr: int
    rmssd: float
    stress: float
    dette_sociale: int
    compartiment: str
    statut: str = "actif"
    poste: str = None
    badge: str = None


@dataclass
class Poste:
    nom: str
    compartiment: str
    competence: str
    seuil: float
    criticite: str
    titulaire: str = None


@dataclass
class Compartiment:
    nom: str
    co2: int
    bruit_db: int
    fumee: bool = False
    occupants: list = field(default_factory=list)


class Etat:
    def __init__(self, conn=None):
        self.conn = conn or db.connexion()
        seed.peupler(self.conn)
        self.recharger()

    def recharger(self):
        conn = self.conn

        derniers = {
            r["crew"]: r for r in conn.execute(
                "SELECT * FROM capacite c WHERE ts = "
                "(SELECT MAX(ts) FROM capacite WHERE crew = c.crew)")
        }
        vitaux = {
            r["crew"]: r for r in conn.execute(
                "SELECT * FROM vitals v WHERE ts = "
                "(SELECT MAX(ts) FROM vitals WHERE crew = v.crew)")
        }
        lieux = {
            r["crew"]: r["compartiment"] for r in conn.execute(
                "SELECT crew, compartiment FROM presence WHERE sortie IS NULL")
        }
        postes_par_crew = {
            r["titulaire"]: r["nom"] for r in conn.execute(
                "SELECT nom, titulaire FROM poste WHERE titulaire IS NOT NULL")
        }

        self.equipage = []
        for r in conn.execute("SELECT * FROM crew ORDER BY nom"):
            cap = derniers.get(r["nom"])
            vit = vitaux.get(r["nom"])
            self.equipage.append(Crew(
                nom=r["nom"],
                role=r["role"],
                competences=set(r["competences"].split(",")),
                cognitive=cap["cognitive"] if cap else 0.0,
                fatigue=cap["fatigue"] if cap else 0.0,
                sommeil_h=cap["sommeil_h"] if cap else 0.0,
                dette_sociale=cap["dette_sociale"] if cap else 0,
                hr=vit["hr"] if vit else 0,
                rmssd=vit["rmssd"] if vit else 0.0,
                stress=vit["stress"] if vit else 0.0,
                compartiment=lieux.get(r["nom"], "inconnu"),
                statut=r["statut"],
                poste=postes_par_crew.get(r["nom"]),
                badge=r["badge"],
            ))

        self.postes = [
            Poste(r["nom"], r["compartiment"], r["competence"], r["seuil"],
                  r["criticite"], r["titulaire"])
            for r in conn.execute("SELECT * FROM poste ORDER BY seuil DESC")
        ]

        ambiances = {
            r["compartiment"]: r for r in conn.execute(
                "SELECT * FROM ambiance a WHERE ts = "
                "(SELECT MAX(ts) FROM ambiance WHERE compartiment = a.compartiment)")
        }
        self.compartiments = []
        for r in conn.execute("SELECT nom FROM compartiment ORDER BY ordre"):
            amb = ambiances.get(r["nom"])
            self.compartiments.append(Compartiment(
                nom=r["nom"],
                co2=amb["co2"] if amb else 0,
                bruit_db=amb["bruit_db"] if amb else 0,
                fumee=bool(amb["fumee"]) if amb else False,
                occupants=db.occupants(conn, r["nom"]),
            ))

    def membre(self, nom):
        return next((c for c in self.equipage if c.nom == nom.lower()), None)

    def poste(self, nom):
        return next((p for p in self.postes if p.nom == nom.lower()), None)

    def compartiment(self, nom):
        return next((c for c in self.compartiments if c.nom == nom.lower()), None)

    def postes_decouverts(self):
        return [p for p in self.postes if p.titulaire is None]

    def serie(self, nom, points=48):
        return db.releve_capacite(self.conn, nom, points)

    def affecter(self, crew_nom, poste_nom, motif, auteur):
        maintenant = time.time()
        poste = self.poste(poste_nom)
        if poste and poste.titulaire:
            self.conn.execute(
                "UPDATE affectation SET fin = ? WHERE poste = ? AND fin IS NULL",
                (maintenant, poste_nom))
        self.conn.execute("UPDATE poste SET titulaire = ? WHERE nom = ?", (crew_nom, poste_nom))
        self.conn.execute(
            "INSERT INTO affectation (crew, poste, debut, motif, auteur) VALUES (?,?,?,?,?)",
            (crew_nom, poste_nom, maintenant, motif, auteur))
        self.conn.commit()
        self.recharger()

    def declencher_fumee(self, compartiment, actif=True):
        amb = self.compartiment(compartiment)
        if amb is None:
            return None
        self.conn.execute(
            "INSERT OR REPLACE INTO ambiance (compartiment, ts, co2, bruit_db, fumee)"
            " VALUES (?,?,?,?,?)",
            (compartiment, time.time(), amb.co2, amb.bruit_db, 1 if actif else 0))
        self.conn.commit()
        self.recharger()
        return self.compartiment(compartiment)

    def alertes(self):
        out = []
        for poste in self.postes_decouverts():
            niveau = "critique" if poste.criticite == "vital" else "attention"
            out.append((niveau, f"{poste.nom} sans titulaire"))
        for comp in self.compartiments:
            if comp.fumee:
                out.append(("critique", f"combustion {comp.nom}"))
            elif comp.co2 > 1000:
                out.append(("attention", f"CO2 élevé {comp.nom}"))
            elif comp.bruit_db > 65:
                out.append(("attention", f"bruit {comp.nom} {comp.bruit_db} dB"))
        for membre in self.equipage:
            if membre.cognitive < 0.35:
                out.append(("attention", f"{membre.nom} capacité {membre.cognitive:.2f}"))
        return out
