import { courbe } from "./charts.js";
import { bloc, couleur, el, json, paire, rangee } from "./ui.js";

export function vueEquipage(hote, etat) {
  const { section, corps } = bloc("Équipage", `${etat.equipage.length} membres en service`);
  hote.appendChild(section);
  corps.appendChild(el("p", "intro",
    "Trié par capacité croissante : ce qui demande attention est en haut."));
  for (const m of etat.equipage) corps.appendChild(rangee(m));
}

export async function vueMembre(hote, nom) {
  const d = await json(`/api/membre/${encodeURIComponent(nom)}`);
  if (d.erreur) {
    hote.appendChild(el("div", "vide", `Membre ${nom} inconnu.`));
    return;
  }
  const m = d.membre;

  const entete = el("div", "entete-page");
  const retour = el("a", "retour", "← équipage");
  retour.href = "#/equipage";
  entete.appendChild(retour);
  entete.appendChild(el("h1", null, m.nom));
  entete.appendChild(el("span", "sous-titre",
    `${m.role} · ${m.competences.join(", ")} · ${m.compartiment}`));
  hote.appendChild(entete);

  const etatBloc = bloc("Aptitude", m.poste ? `poste ${m.poste}` : "sans poste");
  const grille = el("div", "grille-mesures");
  grille.appendChild(paire("Capacité cognitive", m.cognitive.toFixed(2), couleur(m.cognitive)));
  grille.appendChild(paire("Aptitude", m.apte ? "apte" : "réduite",
    m.apte ? "var(--nominal)" : "var(--attention)"));
  if (d.medical) {
    grille.appendChild(paire("Fréquence cardiaque", `${m.hr} bpm`));
    grille.appendChild(paire("RMSSD", `${m.rmssd.toFixed(0)} ms`));
    grille.appendChild(paire("Stress estimé", m.stress.toFixed(2)));
    grille.appendChild(paire("Sommeil", `${m.sommeil_h.toFixed(1)} h`));
    grille.appendChild(paire("Dette sociale", `${m.dette_sociale} j`));
  }
  etatBloc.corps.appendChild(grille);
  if (!d.medical) {
    etatBloc.corps.appendChild(el("p", "note",
      "Données physiologiques non communiquées. Le détail médical exige un badge d'équipage."));
  }
  hote.appendChild(etatBloc.section);

  const t = d.tendance;
  const capBloc = bloc("Capacité sur 24 heures",
    t?.fiable ? `pente ${t.pente_h}/h · R² ${t.r2}` : "tendance non fiable");
  const zone = el("div", "graphique");
  capBloc.corps.appendChild(zone);
  courbe(zone, {
    series: [{ label: "capacité", couleur: couleur(m.cognitive),
               points: d.capacite.map((p) => ({ ts: p.ts, valeur: p.valeur })) }],
    seuil: 0.70, seuilLabel: "seuil chirurgie",
  });
  if (t?.fiable && t.pente_h < 0) {
    capBloc.corps.appendChild(el("p", "note",
      `Projection à six heures : ${t.projection_6h.toFixed(2)}.`));
  }
  hote.appendChild(capBloc.section);

  if (d.medical) {
    const vitals = await json(`/api/vitals/${encodeURIComponent(nom)}?heures=24`);
    if (!vitals.refuse && vitals.points.length > 1) {
      const b = bloc("Constantes physiologiques", "rythme cardiaque et variabilité");
      const z = el("div", "graphique");
      b.corps.appendChild(z);
      courbe(z, {
        series: [
          { label: "FC bpm", couleur: "var(--critique)",
            points: vitals.points.map((p) => ({ ts: p.ts, valeur: p.hr })) },
          { label: "RMSSD ms", couleur: "var(--nominal)",
            points: vitals.points.map((p) => ({ ts: p.ts, valeur: p.rmssd })) },
        ],
      });
      hote.appendChild(b.section);
    }
  }

  if (d.contacts.length) {
    const b = bloc("Contacts sur 24 heures", "graphe social par badge");
    b.corps.appendChild(el("p", "intro",
      "Durée de partage d'un compartiment. Sert au suivi de l'isolement, "
      + "et au traçage des expositions en cas de contamination."));
    for (const c of d.contacts) {
      const ligne = el("div", "rang");
      const lien = el("a", null, c.crew);
      lien.href = `#/equipage/${encodeURIComponent(c.crew)}`;
      ligne.appendChild(el("span", "nom")).appendChild(lien);
      ligne.appendChild(el("span", "val", `${c.minutes} min`));
      b.corps.appendChild(ligne);
    }
    hote.appendChild(b.section);
  }
}
