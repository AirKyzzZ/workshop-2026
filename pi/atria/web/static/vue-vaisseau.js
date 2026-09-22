import { courbe } from "./charts.js";
import { dessinerPlan } from "./ship.js";
import { bloc, el, json, paire } from "./ui.js";

export async function vueVaisseau(hote, etat) {
  const { section, corps } = bloc("Plan du vaisseau", "cliquez un compartiment");
  hote.appendChild(section);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "plan";
  svg.setAttribute("viewBox", "0 0 620 390");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  corps.appendChild(svg);

  const n = dessinerPlan(etat, ouvrir);
  section.querySelector("em").textContent =
    `${n} compartiment${n > 1 ? "s" : ""} instrumenté${n > 1 ? "s" : ""} · cliquez pour entrer`;

  const liste = bloc("Compartiments", "relevé courant");
  const cartes = el("div", "cartes");
  for (const c of etat.compartiments) {
    const carte = el("button", "carte" + (c.fumee ? " feu" : c.alerte ? " alerte" : ""));
    carte.type = "button";
    carte.addEventListener("click", () => ouvrir(c.nom));
    carte.appendChild(el("span", "carte-nom", c.nom));
    carte.appendChild(el("span", "carte-mesure", c.instrumente
      ? `${c.temp_c.toFixed(1)} °C · ${c.humidite.toFixed(0)} % · ${c.bruit_db} dB`
      : `${c.bruit_db} dB · non instrumenté`));
    carte.appendChild(el("span", "carte-note",
      `${c.occupants.length} présent${c.occupants.length > 1 ? "s" : ""}`));
    cartes.appendChild(carte);
  }
  liste.corps.appendChild(cartes);
  hote.appendChild(liste.section);
}

function ouvrir(nom) {
  location.hash = `#/compartiment/${encodeURIComponent(nom)}`;
}

export async function vueCompartiment(hote, etat, nom) {
  const comp = etat.compartiments.find((c) => c.nom === nom);
  if (!comp) {
    hote.appendChild(el("div", "vide", `Compartiment ${nom} inconnu.`));
    return;
  }

  const entete = el("div", "entete-page");
  const retour = el("a", "retour", "← plan du vaisseau");
  retour.href = "#/vaisseau";
  entete.appendChild(retour);
  entete.appendChild(el("h1", null, comp.nom));
  hote.appendChild(entete);

  const mesures = bloc("Atmosphère", comp.instrumente ? "capteur physique" : "non instrumenté");
  const grille = el("div", "grille-mesures");
  if (comp.instrumente) {
    grille.appendChild(paire("Température", `${comp.temp_c?.toFixed(1)} °C`));
    grille.appendChild(paire("Humidité", `${comp.humidite?.toFixed(0)} %`,
      comp.humidite > 60 ? "var(--attention)" : null));
  }
  grille.appendChild(paire("Niveau sonore", `${comp.bruit_db} dB`,
    comp.bruit_db > 65 ? "var(--attention)" : null));
  grille.appendChild(paire("Combustion", comp.fumee ? "DÉTECTÉE" : "aucune",
    comp.fumee ? "var(--critique)" : null));
  grille.appendChild(paire("Occupants", String(comp.occupants.length)));
  mesures.corps.appendChild(grille);
  hote.appendChild(mesures.section);

  const postes = etat.postes.filter((p) => p.compartiment === nom);
  if (postes.length) {
    const b = bloc("Postes", `${postes.length}`);
    for (const p of postes) {
      const ligne = el("div", "rang");
      const nom = el("span", "nom", p.nom);
      nom.appendChild(el("small", null, `seuil ${p.seuil.toFixed(2)}`));
      ligne.appendChild(nom);

      const titulaire = etat.equipage.find((m) => m.nom === p.titulaire);
      const sousSeuil = titulaire && titulaire.cognitive < p.seuil;
      const v = el("span", "val", p.titulaire ?? "VACANT");
      v.style.color = !p.titulaire ? "var(--critique)"
        : sousSeuil ? "var(--attention)" : "var(--nominal)";
      if (sousSeuil) v.textContent += ` ${titulaire.cognitive.toFixed(2)}`;
      ligne.appendChild(v);
      b.corps.appendChild(ligne);
    }
    hote.appendChild(b.section);
  }

  if (comp.occupants.length) {
    const b = bloc("Présents", "relevé des badges");
    for (const o of comp.occupants) {
      const m = etat.equipage.find((x) => x.nom === o);
      const ligne = el("div", "rang");
      const lien = el("a", null, o);
      lien.href = `#/equipage/${encodeURIComponent(o)}`;
      ligne.appendChild(el("span", "nom")).appendChild(lien);
      if (m) {
        const v = el("span", "val", m.cognitive.toFixed(2));
        v.style.color = m.cognitive >= 0.7 ? "var(--nominal)"
          : m.cognitive >= 0.45 ? "var(--attention)" : "var(--critique)";
        ligne.appendChild(v);
      }
      b.corps.appendChild(ligne);
    }
    hote.appendChild(b.section);
  }

  const histo = bloc("Historique 24 heures", "relevés du capteur");
  histo.section.classList.add("large");
  hote.appendChild(histo.section);
  const serie = await json(`/api/ambiance/${encodeURIComponent(nom)}?heures=24`);
  const pts = serie.points;

  if (comp.instrumente) {
    const zone = el("div", "graphique");
    histo.corps.appendChild(el("h3", null, "Température et humidité"));
    histo.corps.appendChild(zone);
    courbe(zone, {
      series: [
        { label: "température °C", couleur: "var(--nominal)",
          points: pts.filter((p) => p.temp_c != null).map((p) => ({ ts: p.ts, valeur: p.temp_c })) },
        { label: "humidité %", couleur: "var(--attention)",
          points: pts.filter((p) => p.humidite != null).map((p) => ({ ts: p.ts, valeur: p.humidite })) },
      ],
      seuil: 60, seuilLabel: "seuil atmosphère dégradée",
    });
  }

  const bruit = el("div", "graphique");
  histo.corps.appendChild(el("h3", null, "Niveau sonore"));
  histo.corps.appendChild(bruit);
  courbe(bruit, {
    series: [{ label: "dB", couleur: "var(--encre)",
               points: pts.filter((p) => p.bruit_db != null).map((p) => ({ ts: p.ts, valeur: p.bruit_db })) }],
    unite: " dB", hauteur: 150, seuil: 65, seuilLabel: "limite NC-50",
  });
}
