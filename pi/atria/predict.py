import time

MIN_POINTS = 6
HORIZON_MAX_H = 48.0
PENTE_SIGNIFICATIVE = 0.005


class Tendance:
    def __init__(self, pente_h, ordonnee, r2, points, derniere):
        self.pente_h = pente_h
        self.ordonnee = ordonnee
        self.r2 = r2
        self.points = points
        self.derniere = derniere

    @property
    def fiable(self):
        return self.points >= MIN_POINTS and self.r2 >= 0.30

    @property
    def baisse(self):
        return self.pente_h <= -PENTE_SIGNIFICATIVE

    def heures_avant(self, seuil):
        if self.pente_h >= 0 or self.derniere <= seuil:
            return None
        heures = (self.derniere - seuil) / -self.pente_h
        return heures if 0 < heures <= HORIZON_MAX_H else None

    def projection(self, heures):
        return max(0.0, min(1.0, self.derniere + self.pente_h * heures))


def ajuster(serie):
    """Regression lineaire sur une serie [(ts_epoch, valeur)]."""
    if len(serie) < 2:
        return None

    t0 = serie[0][0]
    xs = [(ts - t0) / 3600.0 for ts, _ in serie]
    ys = [v for _, v in serie]
    n = len(xs)

    mx = sum(xs) / n
    my = sum(ys) / n
    var = sum((x - mx) ** 2 for x in xs)
    if var == 0:
        return None

    pente = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / var
    ordonnee = my - pente * mx

    residus = sum((y - (ordonnee + pente * x)) ** 2 for x, y in zip(xs, ys))
    total = sum((y - my) ** 2 for y in ys)
    r2 = 1.0 - residus / total if total > 0 else 0.0

    return Tendance(pente, ordonnee, r2, n, ys[-1])


def ecart_ligne_de_base(serie, fenetre_recente=4):
    """Ecart de la periode recente par rapport a la ligne de base personnelle."""
    if len(serie) < MIN_POINTS + fenetre_recente:
        return None

    base = [v for _, v in serie[:-fenetre_recente]]
    recent = [v for _, v in serie[-fenetre_recente:]]

    moyenne = sum(base) / len(base)
    variance = sum((v - moyenne) ** 2 for v in base) / len(base)
    ecart_type = variance ** 0.5
    if ecart_type < 1e-6:
        return None

    return (sum(recent) / len(recent) - moyenne) / ecart_type


def alerte_predictive(etat, conn, crew_nom, releve):
    """Retourne (niveau, phrase) ou None."""
    from . import db

    serie = releve(conn, crew_nom)
    tendance = ajuster(serie)
    if tendance is None or not tendance.fiable or not tendance.baisse:
        return None

    membre = etat.membre(crew_nom)
    if membre is None:
        return None

    postes = [p for p in etat.postes
              if p.competence in membre.competences and membre.cognitive >= p.seuil]
    if not postes:
        return None

    cible = min(postes, key=lambda p: p.seuil)
    heures = tendance.heures_avant(cible.seuil)
    if heures is None:
        return None

    quand = time.localtime(time.time() + heures * 3600)
    phrase = (f"{membre.nom} est apte. Sa capacité chute de "
              f"{abs(tendance.pente_h):.2f} par heure. "
              f"À ce rythme il passera sous le seuil {cible.nom} vers "
              f"{quand.tm_hour} heures {quand.tm_min:02d}. "
              f"Je recommande de le relever avant.")
    niveau = "critique" if heures < 3 else "attention"
    return niveau, phrase, round(heures, 1), cible.nom
