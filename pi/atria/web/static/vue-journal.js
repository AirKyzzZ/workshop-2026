import { bloc, el, esc, heure, json } from "./ui.js";

const GENRES = {
  refus: "Refus", derogation: "Dérogation", affectation: "Affectation",
  alerte: "Alerte", crise: "Crise", identification: "Identification",
  systeme: "Système", question: "Question",
};

export async function vueJournal(hote) {
  const { section, corps } = bloc("Journal des décisions", "traçabilité complète");
  hote.appendChild(section);

  const filtres = el("div", "filtres");
  const actifs = new Set();
  for (const [cle, libelle] of Object.entries(GENRES)) {
    const b = el("button", "filtre", libelle);
    b.type = "button";
    b.addEventListener("click", () => {
      actifs.has(cle) ? actifs.delete(cle) : actifs.add(cle);
      b.classList.toggle("actif");
      peindre();
    });
    filtres.appendChild(b);
  }
  corps.appendChild(filtres);

  const liste = el("div", "liste-journal");
  corps.appendChild(liste);

  let entrees = [];

  function peindre() {
    const vues = actifs.size ? entrees.filter((e) => actifs.has(e.type)) : entrees;
    liste.replaceChildren();
    if (!vues.length) {
      liste.appendChild(el("div", "vide", "Aucune entrée pour ce filtre."));
      return;
    }
    for (const e of vues) {
      const ligne = el("div", "entree");
      ligne.appendChild(el("time", null, heure(e.ts)));
      ligne.appendChild(el("span", `genre ${esc(e.type)}`, GENRES[e.type] ?? e.type));
      const motif = el("span", "motif");
      if (e.sujet) motif.appendChild(el("b", null, e.sujet));
      motif.append(e.sujet ? ` · ${e.motif}` : e.motif);
      ligne.appendChild(motif);
      liste.appendChild(ligne);
    }
  }

  const charger = async () => {
    entrees = (await json("/api/journal?limite=120")).entrees;
    peindre();
  };
  await charger();
  return setInterval(charger, 6000);
}
