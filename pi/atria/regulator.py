from dataclasses import dataclass


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


def affecter(etat, nom, nom_poste):
    membre = etat.membre(nom)
    poste = etat.poste(nom_poste)
    if membre is None:
        return Reponse(f"{nom} ne fait pas partie de l equipage.", "INCONNU", nom, False)
    if poste is None:
        return Reponse(f"Poste {nom_poste} inconnu.", "POSTE INCONNU", nom_poste, False)

    if poste.competence not in membre.competences:
        parole = (f"Negatif. {membre.nom} n est pas qualifie en {poste.competence}.")
        return Reponse(parole, "REFUSE", f"{membre.nom} sans qualification {poste.competence}", False)

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
        return Reponse(parole, "ORDRE REFUSE", detail, False)

    ancien = poste.titulaire
    if ancien and ancien != membre.nom:
        precedent = etat.membre(ancien)
        if precedent:
            precedent.poste = None
    membre.poste = poste.nom
    poste.titulaire = membre.nom

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
