import random
from dataclasses import dataclass, field


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
    dette_sociale: int
    compartiment: str
    statut: str = "actif"
    poste: str = None


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


NOMS = ["moreau", "bianchi", "reyes", "weber", "novak", "silva", "martin", "bernard",
        "dubois", "durand", "lefebvre", "mercier", "garcia", "rossi", "lambert", "fontaine",
        "girard", "morel", "leroy", "roux", "fournier", "andre", "muller", "blanc"]

COMPETENCES = ["chirurgie", "propulsion", "botanique", "navigation", "maintenance",
               "laboratoire", "informatique", "medecine"]

POSTES = [
    Poste("chirurgie", "infirmerie", "chirurgie", 0.70, "vital"),
    Poste("propulsion", "réacteur", "propulsion", 0.65, "vital"),
    Poste("navigation", "pont", "navigation", 0.60, "vital"),
    Poste("serre", "serre", "botanique", 0.40, "haute"),
    Poste("maintenance", "atelier", "maintenance", 0.50, "haute"),
    Poste("laboratoire", "laboratoire", "laboratoire", 0.45, "moyenne"),
]

COMPARTIMENTS = [
    Compartiment("infirmerie", 620, 41),
    Compartiment("réacteur", 780, 68),
    Compartiment("pont", 540, 44),
    Compartiment("serre", 910, 52),
    Compartiment("atelier", 700, 61),
    Compartiment("laboratoire", 580, 46),
]


def seed(graine=20800921):
    rng = random.Random(graine)
    equipage = []
    for i, nom in enumerate(NOMS):
        comps = set(rng.sample(COMPETENCES, rng.randint(1, 3)))
        sommeil = round(rng.uniform(3.5, 8.5), 1)
        cognitive = round(min(1.0, max(0.15, sommeil / 8.0 * rng.uniform(0.75, 1.15))), 2)
        equipage.append(Crew(
            nom=nom,
            role=rng.choice(["officier", "technicien", "specialiste", "medecin"]),
            competences=comps,
            cognitive=cognitive,
            fatigue=round(1.0 - cognitive * rng.uniform(0.7, 1.0), 2),
            sommeil_h=sommeil,
            hr=rng.randint(52, 88),
            rmssd=round(rng.uniform(18, 62), 1),
            dette_sociale=rng.randint(0, 9),
            compartiment=COMPARTIMENTS[i % len(COMPARTIMENTS)].nom,
        ))

    postes = [Poste(p.nom, p.compartiment, p.competence, p.seuil, p.criticite) for p in POSTES]
    for poste in postes:
        aptes = [c for c in equipage
                 if poste.competence in c.competences and c.cognitive >= poste.seuil and c.poste is None]
        if aptes:
            titulaire = max(aptes, key=lambda c: c.cognitive)
            titulaire.poste = poste.nom
            poste.titulaire = titulaire.nom

    comps = [Compartiment(c.nom, c.co2, c.bruit_db, c.fumee, []) for c in COMPARTIMENTS]
    index = {c.nom: c for c in comps}
    for membre in equipage:
        index[membre.compartiment].occupants.append(membre.nom)

    return equipage, postes, comps


class Etat:
    def __init__(self):
        self.equipage, self.postes, self.compartiments = seed()

    def membre(self, nom):
        return next((c for c in self.equipage if c.nom == nom.lower()), None)

    def poste(self, nom):
        return next((p for p in self.postes if p.nom == nom.lower()), None)

    def compartiment(self, nom):
        return next((c for c in self.compartiments if c.nom == nom.lower()), None)

    def postes_decouverts(self):
        return [p for p in self.postes if p.titulaire is None]

    def alertes(self):
        out = []
        for poste in self.postes_decouverts():
            out.append((theme_critique(poste.criticite), f"{poste.nom} sans titulaire"))
        for comp in self.compartiments:
            if comp.fumee:
                out.append(("critique", f"combustion {comp.nom}"))
            elif comp.co2 > 1000:
                out.append(("attention", f"CO2 eleve {comp.nom}"))
            elif comp.bruit_db > 65:
                out.append(("attention", f"bruit {comp.nom} {comp.bruit_db} dB"))
        for membre in self.equipage:
            if membre.cognitive < 0.35:
                out.append(("attention", f"{membre.nom} capacite {membre.cognitive:.2f}"))
        return out


def theme_critique(criticite):
    return "critique" if criticite == "vital" else "attention"
