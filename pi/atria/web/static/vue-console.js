import { bloc, el, json } from "./ui.js";

const EXEMPLES = [
  "pourquoi la capacité de reyes baisse",
  "qui peut tenir le poste chirurgie",
  "qui a croisé moreau cette semaine",
  "état de l'infirmerie",
  "situation du vaisseau",
  "montre le journal des décisions",
];

export async function vueConsole(hote) {
  const { section, corps } = bloc("Console ATRIA", "lecture seule");
  hote.appendChild(section);

  const intro = el("p", "intro",
    "ATRIA interroge les données du vaisseau et les explique. Elle ne dispose "
    + "d'aucun outil d'écriture : elle ne peut affecter personne, annuler aucun refus, "
    + "ni modifier aucune mesure. Le modèle de langage tourne sur la carte et ne fait que "
    + "mettre en forme la sortie d'un outil ; tout chiffre qu'il ajouterait est rejeté.");
  corps.appendChild(intro);

  const suggestions = el("div", "suggestions");
  for (const s of EXEMPLES) {
    const b = el("button", "suggestion", s);
    b.type = "button";
    b.addEventListener("click", () => { champ.value = s; formulaire.requestSubmit(); });
    suggestions.appendChild(b);
  }
  corps.appendChild(suggestions);

  const fil = el("div", "fil");
  corps.appendChild(fil);

  const formulaire = el("form", "console");
  const invite = el("span", "invite", "ATRIA");
  const champ = el("input");
  champ.id = "question";
  champ.autocomplete = "off";
  champ.placeholder = "Posez votre question…";
  formulaire.append(invite, champ);
  corps.appendChild(formulaire);

  formulaire.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const texte = champ.value.trim();
    if (!texte) return;
    champ.value = "";

    const echange = el("div", "echange");
    echange.appendChild(el("div", "demande", texte));
    const reponse = el("div", "reponse", "…");
    echange.appendChild(reponse);
    fil.prepend(echange);

    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte }),
      }).then((x) => x.json());
      reponse.textContent = r.reponse;
      if (r.outils?.length) {
        echange.appendChild(el("div", "trace",
          `outil ${r.outils[0].nom} · lecture seule · `
          + (r.modele ? "mis en forme par le modèle local" : "sortie brute de l'outil")));
      }
      if (r.modele && r.releve) {
        const pli = el("details", "releve");
        pli.appendChild(el("summary", null, "Voir le relevé d'origine"));
        pli.appendChild(el("div", null, r.releve));
        echange.appendChild(pli);
      }
    } catch {
      reponse.textContent = "La console ne répond pas.";
    }
  });

  const outils = await json("/api/outils");
  const cat = el("div", "catalogue");
  cat.appendChild(el("h3", null, `Outils disponibles (${outils.outils.length}, tous en lecture)`));
  for (const o of outils.outils) {
    const ligne = el("div", "outil");
    ligne.appendChild(el("code", null, o.nom));
    ligne.appendChild(el("span", null, o.description));
    cat.appendChild(ligne);
  }
  corps.appendChild(cat);
  champ.focus();
}
