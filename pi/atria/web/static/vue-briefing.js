import { bloc, el, heure, json } from "./ui.js";

export async function blocBriefing(hote) {
  const { section, corps } = bloc("Briefing de quart", "croisement des relevés");
  hote.appendChild(section);

  async function peindre() {
    let d;
    try {
      d = await json("/api/briefing");
    } catch {
      return;
    }
    corps.replaceChildren();

    const texte = el("p", "briefing-texte", d.texte);
    corps.appendChild(texte);

    const liste = el("ul", "briefing-constats");
    for (const c of d.constats) liste.appendChild(el("li", null, c));
    corps.appendChild(liste);

    const pied = el("p", "verdict-detail",
      `${heure(d.ts)} · rédigé par ${d.source} · ${d.constats.length} constats`);
    corps.appendChild(pied);

    if (d.rejet) {
      corps.appendChild(el("p", "note",
        `Reformulation par le modèle refusée : ${d.rejet}. `
        + "Le texte des outils reprend sa place."));
    }
  }

  await peindre();
  return peindre;
}
