import time
from dataclasses import dataclass

from . import db, predict, social


@dataclass
class Reponse:
    parole: str
    titre: str
    detail: str
    accepte: bool = True


def etat_membre(etat, nom, capitaine=False):
    membre = etat.membre(nom)
    if membre is None:
        return Reponse(f"{nom} ne fait pas partie de l equipage actif.",
                       "INCONNU", f"{nom} absent du registre", False)

    if capitaine:
        aptitude = "apte" if membre.cognitive >= 0.60 else "aptitude reduite"
        parole = (f"{membre.nom}, {membre.role}, {aptitude}. "
                  f"Poste actuel: {membre.poste or 'aucun'}.")
        detail = f"role {membre.role} | poste {membre.poste or '-'} | {aptitude}"
    else:
        parole = (f"{membre.nom}. Capacite cognitive {membre.cognitive:.2f}. "
                  f"Frequence cardiaque {membre.hr}. "
                  f"Variabilite {membre.rmssd:.0f} millisecondes. "
                  f"{membre.sommeil_h:.0f} heures de sommeil.")
        detail = (f"HR {membre.hr} | RMSSD {membre.rmssd:.0f} ms | "
                  f"sommeil {membre.sommeil_h:.1f} h | dette sociale {membre.dette_sociale} j")

    return Reponse(parole, membre.nom.upper(), detail)


def qui_peut(etat, nom_poste):
    poste = etat.poste(nom_poste)
    if poste is None:
        return Reponse(f"Poste {nom_poste} inconnu.", "POSTE INCONNU", nom_poste, False)

    aptes = sorted(
        (c for c in etat.equipage
         if poste.competence in c.competences and c.cognitive >= poste.seuil and c.statut == "actif"),
        key=lambda c: c.cognitive, reverse=True,
    )

    if not aptes:
        qualifies = [c for c in etat.equipage if poste.competence in c.competences]
        meilleur = max(qualifies, key=lambda c: c.cognitive, default=None)
        parole = f"Aucun membre apte au poste {poste.nom}. Seuil requis {poste.seuil:.2f}."
        if meilleur:
            parole += f" Le plus proche est {meilleur.nom}, capacite {meilleur.cognitive:.2f}."
        return Reponse(parole, f"{poste.nom.upper()} — AUCUN APTE",
                       f"seuil {poste.seuil:.2f} | {len(qualifies)} qualifies", False)

    tete = aptes[0]
    parole = (f"{len(aptes)} membres aptes au poste {poste.nom}. "
              f"Je recommande {tete.nom}, capacite {tete.cognitive:.2f}.")
    detail = " | ".join(f"{c.nom} {c.cognitive:.2f}" for c in aptes[:4])
    return Reponse(parole, f"{poste.nom.upper()} — {len(aptes)} APTES", detail)


def affecter(etat, nom, nom_poste, auteur="capitaine"):
    membre = etat.membre(nom)
    poste = etat.poste(nom_poste)
    if membre is None:
        return Reponse(f"{nom} ne fait pas partie de l equipage.", "INCONNU", nom, False)
    if poste is None:
        return Reponse(f"Poste {nom_poste} inconnu.", "POSTE INCONNU", nom_poste, False)

    if poste.competence not in membre.competences:
        parole = (f"Negatif. {membre.nom} n est pas qualifie en {poste.competence}.")
        db.journaliser(etat.conn, "refus", f"qualification {poste.competence} absente",
                       acteur=auteur, sujet=membre.nom, donnees={"poste": poste.nom})
        return Reponse(parole, "REFUSE", f"{membre.nom} sans qualification {poste.competence}", False)

    conduite = db.conduite(etat.conn, membre.nom)
    if conduite < db.SEUIL_CONDUITE:
        parole = (f"Negatif. Conduite de {membre.nom}: {conduite:.2f}. "
                  f"Seuil requis: {db.SEUIL_CONDUITE:.2f}. "
                  f"Comportement releve par la surveillance de bord.")
        db.journaliser(etat.conn, "refus",
                       f"conduite {conduite:.2f} sous le seuil {db.SEUIL_CONDUITE:.2f}",
                       acteur=auteur, sujet=membre.nom,
                       donnees={"poste": poste.nom, "conduite": round(conduite, 3),
                                "motif": "conduite"})
        return Reponse(parole, "ORDRE REFUSE",
                       f"conduite {conduite:.2f} < {db.SEUIL_CONDUITE:.2f} requis", False)

    if poste.criticite == "vital":
        detail_confiance = social.confiances(etat.conn).get(membre.nom)
        if detail_confiance and detail_confiance["sous_seuil"]:
            parole = (f"Negatif. Poste vital. Confiance de {membre.nom}: "
                      f"{detail_confiance['confiance']:.2f}, seuil {social.SEUIL_CONFIANCE:.2f}. "
                      f"Conduite {detail_confiance['conduite']:.2f}, "
                      f"appui de l equipage {detail_confiance['appui']:.2f}.")
            db.journaliser(etat.conn, "refus",
                           f"confiance {detail_confiance['confiance']:.2f} sous le seuil "
                           f"{social.SEUIL_CONFIANCE:.2f} pour un poste vital",
                           acteur=auteur, sujet=membre.nom,
                           donnees={"poste": poste.nom, "motif": "confiance",
                                    **detail_confiance})
            return Reponse(parole, "ORDRE REFUSE",
                           f"confiance {detail_confiance['confiance']:.2f} < "
                           f"{social.SEUIL_CONFIANCE:.2f} requis sur poste vital", False)

    if membre.cognitive < poste.seuil:
        remplacants = sorted(
            (c for c in etat.equipage
             if poste.competence in c.competences and c.cognitive >= poste.seuil),
            key=lambda c: c.cognitive, reverse=True,
        )
        parole = (f"Negatif. Capacite cognitive de {membre.nom}: {membre.cognitive:.2f}. "
                  f"Seuil requis pour le poste {poste.nom}: {poste.seuil:.2f}. "
                  f"{membre.sommeil_h:.0f} heures de sommeil.")
        if remplacants:
            parole += f" Je recommande {remplacants[0].nom}."
        detail = f"{membre.cognitive:.2f} < {poste.seuil:.2f} requis"
        db.journaliser(etat.conn, "refus",
                       f"capacité {membre.cognitive:.2f} sous le seuil {poste.seuil:.2f}",
                       acteur=auteur, sujet=membre.nom,
                       donnees={"poste": poste.nom, "capacite": membre.cognitive,
                                "seuil": poste.seuil,
                                "alternative": remplacants[0].nom if remplacants else None})
        return Reponse(parole, "ORDRE REFUSE", detail, False)

    motif = f"capacité {membre.cognitive:.2f} au-dessus du seuil {poste.seuil:.2f}"
    etat.affecter(membre.nom, poste.nom, motif, auteur)
    db.journaliser(etat.conn, "affectation", motif, acteur=auteur, sujet=membre.nom,
                   donnees={"poste": poste.nom, "capacite": membre.cognitive})

    parole = f"Affirmatif. {membre.nom} affecte au poste {poste.nom}."
    return Reponse(parole, "AFFECTATION VALIDEE",
                   f"{membre.nom} -> {poste.nom} | capacite {membre.cognitive:.2f}")


def situation(etat):
    decouverts = etat.postes_decouverts()
    alertes = etat.alertes()
    actifs = sum(1 for c in etat.equipage if c.statut == "actif")
    critiques = [c for c in etat.equipage if c.cognitive < 0.35]

    morceaux = [f"{actifs} membres en service actif."]
    if decouverts:
        morceaux.append(f"{len(decouverts)} postes sans titulaire: "
                        + ", ".join(p.nom for p in decouverts) + ".")
    else:
        morceaux.append("Tous les postes sont couverts.")
    if critiques:
        morceaux.append(f"{len(critiques)} membres en capacite reduite.")
    morceaux.append("Aucun lien avec la Terre.")

    detail = f"{len(alertes)} alertes | {len(decouverts)} postes decouverts"
    return Reponse(" ".join(morceaux), "SITUATION", detail, not decouverts)


def deroger(etat, nom, nom_poste, auteur="capitaine"):
    membre = etat.membre(nom)
    poste = etat.poste(nom_poste)
    if membre is None or poste is None:
        return Reponse("Dérogation impossible.", "DEROGATION REFUSEE", "cible inconnue", False)

    motif = (f"dérogation du capitaine, capacité {membre.cognitive:.2f} "
             f"sous le seuil {poste.seuil:.2f}")
    etat.affecter(membre.nom, poste.nom, motif, auteur)
    db.journaliser(etat.conn, "derogation", motif, acteur=auteur, sujet=membre.nom,
                   donnees={"poste": poste.nom, "capacite": membre.cognitive,
                            "seuil": poste.seuil})

    parole = (f"Dérogation enregistrée. {membre.nom} affecté au poste {poste.nom} "
              f"sous la responsabilité du capitaine.")
    return Reponse(parole, "DEROGATION ENREGISTREE",
                   f"{membre.nom} -> {poste.nom} hors seuil | tracée au journal")


def alertes_predictives(etat, limite=3):
    sorties = []
    for membre in etat.equipage:
        if membre.statut != "actif":
            continue
        tendance = predict.ajuster(etat.serie(membre.nom))
        if tendance is None or not tendance.fiable or not tendance.baisse:
            continue
        eligibles = [p for p in etat.postes
                     if p.competence in membre.competences and membre.cognitive >= p.seuil]
        if not eligibles:
            continue
        cible = max(eligibles, key=lambda p: p.seuil)
        heures = tendance.heures_avant(cible.seuil)
        if heures is None:
            continue
        sorties.append({
            "crew": membre.nom, "poste": cible.nom, "heures": round(heures, 1),
            "pente": round(tendance.pente_h, 4), "actuel": membre.cognitive,
            "seuil": cible.seuil, "r2": round(tendance.r2, 2),
            "niveau": "critique" if heures < 3 else "attention",
        })
    sorties.sort(key=lambda s: s["heures"])
    return sorties[:limite]
