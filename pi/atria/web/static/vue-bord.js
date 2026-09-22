import { courbe } from "./charts.js";
import { bloc, couleur, el, json, paire, rangee } from "./ui.js";

function resume(hote, etat) {
  const r = etat.resume;
  const { section, corps } = bloc("Situation", "temps réel");
  const grille = el("div", "grille-mesures");
  grille.appendChild(paire("Équipage en service", `${r.actifs} / ${r.total}`));
  grille.appendChild(paire("Aptes", String(r.aptes), "var(--nominal)"));
  grille.appendChild(paire("Capacité réduite", String(r.critiques),
    r.critiques ? "var(--attention)" : null));
  grille.appendChild(paire("Postes vacants", String(r.decouverts),
    r.decouverts ? "var(--critique)" : "var(--nominal)"));
  grille.appendChild(paire("Alertes actives", String(etat.alertes.length),
    etat.alertes.length ? "var(--attention)" : null));
  grille.appendChild(paire("Lien avec la Terre", "aucun", "var(--faible)"));
  corps.appendChild(grille);
  hote.appendChild(section);
}

function alertes(hote, etat) {
  const { section, corps } = bloc("Alertes", String(etat.alertes.length || ""));
  if (!etat.alertes.length) {
    corps.appendChild(el("div", "vide", "Aucune alerte active."));
  } else {
    for (const a of etat.alertes) {
      const ligne = el("div", "signal");
      const point = el("span", "point");
      point.style.background = a.niveau === "critique" ? "var(--critique)" : "var(--attention)";
      ligne.append(point, el("span", null, a.texte));
      corps.appendChild(ligne);
    }
  }
  hote.appendChild(section);
}

function previsions(hote, etat) {
  const { section, corps } = bloc("Prévisions", "régression sur 24 h");
  if (!etat.previsions.length) {
    corps.appendChild(el("div", "vide", "Aucune dérive détectée sur l'équipage."));
  } else {
    for (const p of etat.previsions) {
      const d = el("div", `prevision ${p.niveau}`);
      const lien = el("a", null, p.crew);
      lien.href = `#/equipage/${encodeURIComponent(p.crew)}`;
      d.appendChild(el("strong", null)).appendChild(lien);
      d.append(` passera sous le seuil ${p.poste} (${p.seuil.toFixed(2)}) dans `);
      d.appendChild(el("strong", null, `${p.heures} h`));
      d.append(".");
      d.appendChild(el("div", "detail",
        `actuel ${p.actuel.toFixed(2)} · pente ${p.pente}/h · R² ${p.r2}`));
      corps.appendChild(d);
    }
  }
  hote.appendChild(section);
}

function postes(hote, etat) {
  const { section, corps } = bloc("Postes", `${etat.postes.length} à bord`);
  for (const p of etat.postes) {
    const ligne = el("div", "rang");
    const nom = el("span", "nom", p.nom);
    nom.appendChild(el("small", null, `seuil ${p.seuil.toFixed(2)} · ${p.compartiment}`));
    ligne.appendChild(nom);

    const titulaire = etat.equipage.find((m) => m.nom === p.titulaire);
    const sousSeuil = titulaire && titulaire.cognitive < p.seuil;
    const v = el("span", "val", p.titulaire ?? "VACANT");
    v.style.color = !p.titulaire ? "var(--critique)"
      : sousSeuil ? "var(--attention)" : "var(--nominal)";
    if (sousSeuil) v.textContent += ` ${titulaire.cognitive.toFixed(2)}`;
    ligne.appendChild(v);
    corps.appendChild(ligne);
  }
  hote.appendChild(section);
}

function attention(hote, etat) {
  const fragiles = etat.equipage.slice(0, 6);
  const { section, corps } = bloc("Demandent attention", "capacité la plus basse");
  for (const m of fragiles) corps.appendChild(rangee(m));
  hote.appendChild(section);
}

async function monEtat(hote, etat, session) {
  const d = await json(`/api/membre/${encodeURIComponent(session.acteur)}`).catch(() => null);
  if (!d || d.erreur) return;
  const m = d.membre;

  const { section, corps } = bloc("Votre état", `${m.role} · ${m.compartiment}`);
  const grille = el("div", "grille-mesures");
  grille.appendChild(paire("Capacité cognitive", m.cognitive.toFixed(2), couleur(m.cognitive)));
  if (d.medical) {
    grille.appendChild(paire("Fréquence cardiaque", `${m.hr} bpm`));
    grille.appendChild(paire("RMSSD", `${m.rmssd.toFixed(0)} ms`));
    grille.appendChild(paire("Sommeil", `${m.sommeil_h.toFixed(1)} h`));
    grille.appendChild(paire("Stress estimé", m.stress.toFixed(2)));
    grille.appendChild(paire("Dette sociale", `${m.dette_sociale} j`));
  }
  corps.appendChild(grille);

  const zone = el("div", "graphique");
  corps.appendChild(zone);
  courbe(zone, {
    series: [{ label: "capacité", couleur: couleur(m.cognitive),
               points: d.capacite.map((p) => ({ ts: p.ts, valeur: p.valeur })) }],
    hauteur: 160, seuil: 0.70, seuilLabel: "seuil chirurgie",
  });

  const detail = el("a", "lien-detail", "Voir la fiche complète →");
  detail.href = `#/equipage/${encodeURIComponent(m.nom)}`;
  corps.appendChild(detail);
  hote.appendChild(section);
}

async function atmosphere(hote, etat) {
  const comp = etat.compartiments.find((c) => c.instrumente);
  if (!comp) return;

  const { section, corps } = bloc("Atmosphère", `${comp.nom} · capteur physique`);
  const grille = el("div", "grille-mesures");
  grille.appendChild(paire("Température", `${comp.temp_c.toFixed(1)} °C`));
  grille.appendChild(paire("Humidité", `${comp.humidite.toFixed(0)} %`,
    comp.humidite > 60 ? "var(--attention)" : null));
  corps.appendChild(grille);

  const zone = el("div", "graphique");
  corps.appendChild(zone);
  hote.appendChild(section);

  const serie = await json(`/api/ambiance/${encodeURIComponent(comp.nom)}?heures=6`);
  courbe(zone, {
    series: [
      { label: "température °C", couleur: "var(--nominal)",
        points: serie.points.filter((p) => p.temp_c != null)
          .map((p) => ({ ts: p.ts, valeur: p.temp_c })) },
      { label: "humidité %", couleur: "var(--attention)",
        points: serie.points.filter((p) => p.humidite != null)
          .map((p) => ({ ts: p.ts, valeur: p.humidite })) },
    ],
    hauteur: 150, seuil: 60, seuilLabel: "seuil",
  });

  const detail = el("a", "lien-detail", "Ouvrir le compartiment →");
  detail.href = `#/compartiment/${encodeURIComponent(comp.nom)}`;
  corps.appendChild(detail);
}

export async function vueBord(hote, etat, session) {
  if (session.role === "equipage" && session.acteur) {
    await monEtat(hote, etat, session);
  }
  resume(hote, etat);
  alertes(hote, etat);
  previsions(hote, etat);
  if (session.capitaine) postes(hote, etat);
  attention(hote, etat);
  await atmosphere(hote, etat);
}
