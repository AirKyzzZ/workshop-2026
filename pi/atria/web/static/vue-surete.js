import { bloc, el, heure, json, paire } from "./ui.js";

const DECISIONS = {
  feu: "combustion détectée",
  suspicion: "température anormale",
};

const LIBELLE_ETAT = {
  propose: "proposé",
  attente_evacuation: "évacuation en cours",
  scelle: "scellé",
  confine: "confiné",
  leve: "levé",
  rejete: "refusé",
};

async function poster(url, corps) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  return r.json();
}

function jauge(valeur, teinte) {
  const j = el("span", "jauge");
  const barre = el("i");
  barre.style.width = `${Math.round(valeur * 100)}%`;
  barre.style.background = teinte;
  j.appendChild(barre);
  return j;
}

function bouton(libelle, classe, action) {
  const b = el("button", `action ${classe}`, libelle);
  b.type = "button";
  b.addEventListener("click", async () => {
    b.disabled = true;
    await action();
  });
  return b;
}

function carteFeu(cas, capitaine, rafraichir) {
  const carte = el("div", "carte-feu");
  if (cas.decision === "evacuer") carte.classList.add("urgent");
  if (cas.decision === "sceller") carte.classList.add("scelle");

  const entete = el("div", "carte-entete");
  entete.appendChild(el("strong", null, cas.compartiment));
  entete.appendChild(el("span", "etiquette-niveau",
    DECISIONS[cas.niveau] || "retour à la normale"));
  carte.appendChild(entete);

  const mesures = el("div", "grille-mesures");
  mesures.appendChild(paire("Température",
    cas.temp_c === null ? "non instrumenté" : `${cas.temp_c.toFixed(1)} °C`));
  mesures.appendChild(paire("Fumée", cas.fumee ? "détectée" : "non"));
  mesures.appendChild(paire("Occupants", String(cas.occupants.length)));
  carte.appendChild(mesures);

  if (cas.occupants.length) {
    carte.appendChild(el("p", "note", `À l'intérieur : ${cas.occupants.join(", ")}.`));
  }

  const verdict = el("p", "verdict-parole");
  if (cas.decision === "sceller") {
    verdict.textContent = "Compartiment vide. Cloison scellée sans demander.";
  } else if (cas.decision === "evacuer") {
    verdict.textContent = `${cas.occupants.length} personne(s) à l'intérieur. `
      + "ATRIA n'a pas scellé : elle ordonne l'évacuation et attend le dernier sorti.";
  } else if (cas.decision === "surveiller") {
    verdict.textContent = "Température anormale sans fumée. Sous surveillance.";
  } else {
    verdict.textContent = "Plus de combustion. Cloison rouverte.";
  }
  carte.appendChild(verdict);

  if (cas.confinement) {
    carte.appendChild(el("p", "verdict-detail",
      `dossier ${cas.confinement.id} · ${LIBELLE_ETAT[cas.confinement.etat]} `
      + `· ouvert à ${heure(cas.confinement.ouvert)}`));
  }

  if (capitaine && cas.decision === "evacuer" && cas.confinement) {
    const forcer = bouton("Sceller malgré les occupants", "danger", async () => {
      await poster("/api/surete/decision",
        { id: cas.confinement.id, decision: "sceller" });
      rafraichir();
    });
    carte.appendChild(forcer);
    carte.appendChild(el("p", "note",
      "Cette décision enferme les occupants dans le compartiment. Elle est tracée au "
      + "journal au nom du capitaine."));
  }
  return carte;
}

function ligneMenace(m, seuils, capitaine, dossier, rafraichir) {
  const carte = el("div", "carte-menace");
  if (m.risque >= seuils.menace) carte.classList.add("urgent");

  const entete = el("div", "carte-entete");
  const nom = el("a", "nom-menace", m.crew);
  nom.href = `#/equipage/${encodeURIComponent(m.crew)}`;
  entete.appendChild(nom);
  const val = el("span", "val", m.risque.toFixed(2));
  val.style.color = m.risque >= seuils.menace ? "var(--critique)" : "var(--attention)";
  entete.appendChild(val);
  carte.appendChild(entete);

  carte.appendChild(jauge(m.risque,
    m.risque >= seuils.menace ? "var(--critique)" : "var(--attention)"));

  const detail = el("ul", "motifs");
  for (const motif of m.motifs) detail.appendChild(el("li", null, motif));
  carte.appendChild(detail);

  const composantes = el("p", "verdict-detail",
    `agressivité ${m.agressivite.toFixed(2)} · conduite effondrée `
    + `${m.effondrement.toFixed(2)} · fixation ${m.fixation.toFixed(2)} `
    + `· ${m.compartiment}`);
  carte.appendChild(composantes);

  if (!dossier) {
    carte.appendChild(el("p", "note",
      m.risque >= seuils.menace
        ? "Au-dessus du seuil. Une proposition va s'ouvrir au prochain passage."
        : `Sous le seuil de proposition (${seuils.menace.toFixed(2)}). Sous surveillance.`));
    return carte;
  }

  carte.appendChild(el("p", "verdict-titre",
    dossier.etat === "propose" ? "DÉCISION DU CAPITAINE ATTENDUE"
                               : LIBELLE_ETAT[dossier.etat].toUpperCase()));

  if (!capitaine) {
    carte.appendChild(el("p", "note",
      "Seul le capitaine identifié peut trancher ce dossier."));
    return carte;
  }

  const actions = el("div", "rangee-actions");
  if (dossier.etat === "propose") {
    actions.appendChild(bouton("Confiner", "danger", async () => {
      await poster("/api/surete/decision", { id: dossier.id, decision: "confiner" });
      rafraichir();
    }));
    actions.appendChild(bouton("Refuser", "", async () => {
      await poster("/api/surete/decision", { id: dossier.id, decision: "rejeter" });
      rafraichir();
    }));
  } else if (dossier.etat === "confine") {
    actions.appendChild(bouton("Lever le confinement", "", async () => {
      await poster("/api/surete/decision", { id: dossier.id, decision: "lever" });
      rafraichir();
    }));
  }
  carte.appendChild(actions);
  return carte;
}

export async function vueSurete(hote, session) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Sûreté"));
  entete.appendChild(el("span", "sous-titre",
    "ATRIA ferme les cloisons. Elle ne décide pas des personnes."));
  hote.appendChild(entete);

  const zone = el("div", "pile-surete");
  hote.appendChild(zone);

  async function peindre() {
    const d = await json("/api/surete");
    const capitaine = d.capitaine || session?.capitaine;
    zone.replaceChildren();

    const feu = bloc("Compartiments", "confinement automatique");
    feu.corps.appendChild(el("p", "intro",
      "Une combustion scelle la cloison sans demander l'avis de personne, à une "
      + "condition : que le compartiment soit vide, vérifié à l'instant de la décision. "
      + "S'il reste quelqu'un, la fermeture devient un ordre d'évacuation."));

    if (!d.feu.length) {
      feu.corps.appendChild(el("div", "vide",
        "Aucune combustion détectée. Tous les compartiments sont ouverts."));
    } else {
      const grille = el("div", "grille-feu");
      for (const cas of d.feu) grille.appendChild(carteFeu(cas, capitaine, peindre));
      feu.corps.appendChild(grille);
    }

    if (capitaine) {
      const repet = el("div", "filtres");
      for (const c of ["infirmerie", "serre", "réacteur", "laboratoire"]) {
        repet.appendChild(bouton(`Simuler un feu · ${c}`, "", async () => {
          await poster("/api/surete/simulation", { compartiment: c, actif: true });
          peindre();
        }));
      }
      if (d.feu.length) {
        repet.appendChild(bouton("Tout éteindre", "", async () => {
          for (const cas of d.feu) {
            await poster("/api/surete/simulation",
              { compartiment: cas.compartiment, actif: false });
          }
          peindre();
        }));
      }
      feu.corps.appendChild(repet);
      feu.corps.appendChild(el("p", "note",
        "Boutons de répétition. Le MQ2 de la passerelle déclenche le même chemin en réel, "
        + "et chaque simulation est marquée comme telle au journal."));
    }
    zone.appendChild(feu.section);

    const dossiers = {};
    for (const x of d.dossiers) {
      if (x.genre === "personne") dossiers[x.cible] = x;
    }

    const menaces = bloc("Comportements dangereux", "proposition, jamais exécution");
    menaces.corps.appendChild(el("p", "intro",
      "Trois signaux indépendants : des gestes agressifs récents, une conduite "
      + "effondrée, et une hostilité concentrée sur une personne plutôt que diffuse. "
      + `Au-dessus de ${d.seuils.menace.toFixed(2)}, ATRIA ouvre un dossier et argumente. `
      + "Elle n'enferme personne d'elle-même."));

    if (!d.menaces.length) {
      menaces.corps.appendChild(el("div", "vide",
        "Aucun comportement au-dessus du seuil d'alerte."));
    } else {
      for (const m of d.menaces) {
        menaces.corps.appendChild(
          ligneMenace(m, d.seuils, capitaine, dossiers[m.crew], peindre));
      }
    }
    zone.appendChild(menaces.section);

    const hist = bloc("Journal des confinements", `${d.historique.length} dossiers`);
    if (!d.historique.length) {
      hist.corps.appendChild(el("div", "vide", "Aucun dossier ouvert à ce jour."));
    } else {
      for (const x of d.historique) {
        const ligne = el("div", "entree");
        const t = el("time", null, heure(x.ouvert));
        const genre = el("span", "genre", LIBELLE_ETAT[x.etat] || x.etat);
        const texte = el("span", null, `${x.cible} · ${x.motif}`);
        texte.appendChild(el("small", "mono", ` ${x.auteur}`));
        ligne.append(t, genre, texte);
        hist.corps.appendChild(ligne);
      }
    }
    zone.appendChild(hist.section);
  }

  await peindre();
  return setInterval(peindre, 5000);
}
