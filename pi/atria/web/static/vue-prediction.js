import { courbeCout, courbeRoc } from "./courbes-ml.js";
import { bloc, el, json } from "./ui.js";

function barre(valeur, teinte, echelle = 1) {
  const piste = el("span", "piste");
  const i = el("i");
  i.style.width = `${Math.max(0, Math.min(100, (valeur / echelle) * 100))}%`;
  i.style.background = teinte;
  piste.appendChild(i);
  return piste;
}

function matrice(m) {
  const t = el("table", "matrice");
  const entete = el("tr");
  entete.append(el("th", null, ""), el("th", null, "prédit rupture"),
    el("th", null, "prédit tenue"));
  t.appendChild(entete);

  const rupture = el("tr");
  rupture.append(el("th", null, "rupture réelle"),
    el("td", "juste", String(m.vrais_positifs)),
    el("td", "faux", String(m.faux_negatifs)));
  t.appendChild(rupture);

  const tenue = el("tr");
  tenue.append(el("th", null, "tenue réelle"),
    el("td", "faux", String(m.faux_positifs)),
    el("td", "juste", String(m.vrais_negatifs)));
  t.appendChild(tenue);
  return t;
}

function ablation(liste) {
  const t = el("table", "ablation");
  const entete = el("tr");
  entete.append(el("th", null, "variables du modèle"), el("th", null, "AUC"),
    el("th", null, "rappel"));
  t.appendChild(entete);

  const meilleur = Math.max(...liste.map((a) => a.auc || 0));
  for (const a of liste) {
    const ligne = el("tr");
    if (a.auc === meilleur) ligne.className = "retenu";
    const nom = el("td", null, a.jeu);
    const auc = el("td", "mono");
    auc.append(String(a.auc));
    auc.appendChild(barre(a.auc, a.auc === meilleur ? "var(--nominal)" : "var(--trait-fort)"));
    ligne.append(nom, auc, el("td", "mono", String(a.rappel)));
    t.appendChild(ligne);
  }
  return t;
}

function carteRisque(r, horizon) {
  const carte = el("div", "carte-risque");
  if (r.risque >= 0.5) carte.classList.add("urgent");

  const entete = el("div", "carte-entete");
  const nom = el("a", "nom-menace", r.crew);
  nom.href = `#/equipage/${encodeURIComponent(r.crew)}`;
  entete.appendChild(nom);
  const val = el("span", "val", r.risque.toFixed(2));
  val.style.color = r.risque >= 0.5 ? "var(--critique)"
    : r.risque >= 0.2 ? "var(--attention)" : "var(--nominal)";
  entete.appendChild(val);
  carte.appendChild(entete);

  carte.appendChild(barre(r.risque,
    r.risque >= 0.5 ? "var(--critique)"
      : r.risque >= 0.2 ? "var(--attention)" : "var(--nominal)"));

  carte.appendChild(el("p", "verdict-detail",
    `${r.role} · capacité ${r.capacite.toFixed(2)} · rupture attendue sous ${horizon} h`));

  const apports = el("div", "apports");
  const pire = Math.max(...r.contributions.map((c) => Math.abs(c.apport)), 0.01);
  for (const c of r.contributions) {
    const ligne = el("div", "apport");
    ligne.appendChild(el("span", "etiquette", c.libelle));
    const piste = el("span", "piste-centre");
    const i = el("i");
    const part = (Math.abs(c.apport) / pire) * 50;
    if (c.apport >= 0) {
      i.style.left = "50%";
      i.style.background = "var(--critique)";
    } else {
      i.style.left = `${50 - part}%`;
      i.style.background = "var(--nominal)";
    }
    i.style.width = `${part}%`;
    piste.appendChild(i);
    ligne.append(piste, el("span", "mesure", c.apport > 0 ? `+${c.apport}` : String(c.apport)));
    apports.appendChild(ligne);
  }
  carte.appendChild(apports);
  return carte;
}

function carteAnomalie(a, seuil) {
  const carte = el("div", "carte-risque");
  if (a.anormal) carte.classList.add("urgent");

  const entete = el("div", "carte-entete");
  const nom = el("a", "nom-menace", a.crew);
  nom.href = `#/equipage/${encodeURIComponent(a.crew)}`;
  entete.appendChild(nom);
  const val = el("span", "val", a.distance.toFixed(2));
  val.style.color = a.anormal ? "var(--critique)" : "var(--faible)";
  entete.appendChild(val);
  carte.appendChild(entete);

  carte.appendChild(barre(a.distance, a.anormal ? "var(--critique)" : "var(--trait-fort)",
    seuil * 2));

  const axes = el("ul", "motifs");
  for (const x of a.axes.slice(0, 3)) {
    const sens = x.ecart > 0 ? "au-dessus" : "en dessous";
    axes.appendChild(el("li", null,
      `${x.libelle} : ${x.valeur} contre ${x.habitude} d'habitude, `
      + `${Math.abs(x.ecart)} écart-type ${sens}`));
  }
  carte.appendChild(axes);
  return carte;
}

export async function vuePrediction(hote) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Prédiction"));
  entete.appendChild(el("span", "sous-titre",
    "Un modèle entraîné sur les données du bord, et un écart de chacun à sa propre habitude."));
  hote.appendChild(entete);

  const zone = el("div", "pile-perception");
  hote.appendChild(zone);

  async function peindre() {
    let d;
    try {
      d = await json("/api/prediction");
    } catch {
      return;
    }
    zone.replaceChildren();

    if (!d.modele) {
      const vide = bloc("Modèle", "non entraîné");
      vide.corps.appendChild(el("div", "vide",
        "Aucun modèle sur la carte. Lancer python -m atria.entrainer."));
      zone.appendChild(vide.section);
    } else {
      const m = d.modele;
      const mes = m.mesures;

      const perf = bloc("Rupture d'aptitude",
        `${m.lignes} exemples · ${m.ruptures} ruptures`);
      perf.section.classList.add("large");
      perf.corps.appendChild(el("p", "intro",
        `Ce membre passera-t-il sous ${m.seuil_aptitude.toFixed(2)} de capacité dans les `
        + `${m.horizon_h} heures ? Régression logistique écrite à la main, entraînée sur `
        + `les relevés du bord. Chaque prédiction évaluée ici vient d'un modèle qui `
        + `n'avait jamais vu ce membre : la validation croisée sépare les personnes, `
        + `pas les lignes.`));

      const chiffres = el("div", "grille-mesures");
      for (const [libelle, valeur, teinte] of [
        ["AUC", mes.auc, "var(--nominal)"],
        ["Rappel", mes.rappel, "var(--nominal)"],
        ["Précision", mes.precision, "var(--attention)"],
        ["Exactitude", mes.exactitude, null],
      ]) {
        const paire = el("div", "paire");
        paire.appendChild(el("span", "etiquette", libelle));
        const v = el("span", "mesure", String(valeur));
        if (teinte) v.style.color = teinte;
        paire.appendChild(v);
        chiffres.appendChild(paire);
      }
      perf.corps.appendChild(chiffres);

      if (mes.roc && mes.roc.length) {
        const graphes = el("div", "duo-modele");

        const gRoc = el("div");
        gRoc.appendChild(el("p", "verdict-titre", "COURBE ROC"));
        const zoneRoc = el("div", "graphique-ml");
        gRoc.appendChild(zoneRoc);
        const { retenu } = courbeRoc(zoneRoc, mes.roc, mes.auc);
        gRoc.appendChild(el("p", "note",
          `La diagonale est le hasard. Le point marqué est le seuil retenu à 0.50 : `
          + `${Math.round(retenu.tpr * 100)} % des ruptures attrapées pour `
          + `${Math.round(retenu.fpr * 100)} % de fausses alertes. `
          + "Déplacer ce seuil, c'est choisir entre rater une rupture et alerter "
          + "pour rien."));
        graphes.appendChild(gRoc);

        const gCout = el("div");
        gCout.appendChild(el("p", "verdict-titre", "APPRENTISSAGE"));
        const zoneCout = el("div", "graphique-ml");
        gCout.appendChild(zoneCout);
        courbeCout(zoneCout, m.couts, m.iterations);
        gCout.appendChild(el("p", "note",
          "L'entropie croisée que la descente de gradient minimise, relevée pendant "
          + `l'entraînement. Elle tombe de ${m.couts[0]} à ${m.couts[m.couts.length - 1]} `
          + "puis se stabilise : le modèle a fini d'apprendre ce que ces données "
          + "contiennent."));
        graphes.appendChild(gCout);
        perf.corps.appendChild(graphes);
      }

      const duo = el("div", "duo-modele");
      const gauche = el("div");
      gauche.appendChild(el("p", "verdict-titre", "MATRICE DE CONFUSION"));
      gauche.appendChild(matrice(mes));
      gauche.appendChild(el("p", "note",
        `${mes.vrais_positifs} ruptures sur ${mes.vrais_positifs + mes.faux_negatifs} `
        + `attrapées, au prix de ${mes.faux_positifs} fausses alertes. `
        + "Pour un système de sécurité, rater une rupture coûte plus cher "
        + "qu'alerter pour rien."));
      duo.appendChild(gauche);

      const droite = el("div");
      droite.appendChild(el("p", "verdict-titre", "CE QUE CHAQUE VARIABLE AJOUTE"));
      droite.appendChild(ablation(m.ablation));
      droite.appendChild(el("p", "note",
        "Trois autres variables ont été essayées et retirées : la variabilité "
        + "cardiaque, le stress et la conduite faisaient redescendre l'AUC. "
        + "Une variable qui ne gagne pas sa place ne reste pas."));
      duo.appendChild(droite);
      perf.corps.appendChild(duo);
      zone.appendChild(perf.section);

      const risques = bloc("Qui va décrocher", `${d.risques.length} membres évalués`);
      risques.corps.appendChild(el("p", "intro",
        "Le modèle ne rend pas qu'un chiffre : chaque prédiction se décompose en "
        + "apport de chaque mesure. En rouge ce qui pousse vers la rupture, en vert "
        + "ce qui protège."));
      for (const r of d.risques.slice(0, 6)) {
        risques.corps.appendChild(carteRisque(r, m.horizon_h));
      }
      zone.appendChild(risques.section);
    }

    const anomalies = bloc("Écart à soi-même", "sans étiquette, sans supervision");
    anomalies.corps.appendChild(el("p", "intro",
      "Un équipage n'a pas de comportement normal commun : le mécanicien vit au "
      + "réacteur, la biologiste dans la serre. Chacun sert donc de référence à "
      + "lui-même, et on mesure la distance entre sa journée et son habitude. "
      + "Ce que ça attrape, et que rien d'autre n'attrape : quelqu'un qui commence "
      + "à éviter son groupe, avant tout incident et sans franchir aucun seuil."));
    const anormaux = d.anomalies.filter((a) => a.anormal);
    if (!anormaux.length) {
      anomalies.corps.appendChild(el("div", "vide",
        `Personne au-delà de ${d.seuil_anomalie} écart-type de son habitude.`));
      for (const a of d.anomalies.slice(0, 3)) {
        anomalies.corps.appendChild(carteAnomalie(a, d.seuil_anomalie));
      }
    } else {
      for (const a of anormaux.slice(0, 5)) {
        anomalies.corps.appendChild(carteAnomalie(a, d.seuil_anomalie));
      }
    }
    zone.appendChild(anomalies.section);
  }

  await peindre();
  return setInterval(peindre, 8000);
}
