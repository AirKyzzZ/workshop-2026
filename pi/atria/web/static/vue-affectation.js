import { bloc, couleur, el } from "./ui.js";

const poster = (url, corps) =>
  fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).then((r) => r.json());

function selecteur(id, entrees) {
  const s = el("select", "champ");
  s.id = id;
  for (const { valeur, libelle } of entrees) {
    const o = el("option", null, libelle);
    o.value = valeur;
    s.appendChild(o);
  }
  return s;
}

export function panneauAffectation(hote, etat, surChangement) {
  const { section, corps } = bloc("Affecter un poste", "le régulateur tranche");
  corps.appendChild(el("p", "intro",
    "ATRIA vérifie la qualification et la capacité avant d'accepter. "
    + "Un refus donne ses chiffres et une alternative."));

  const membres = [...etat.equipage]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((m) => ({ valeur: m.nom, libelle: `${m.nom} · ${m.cognitive.toFixed(2)}` }));
  const postes = etat.postes.map((p) => ({
    valeur: p.nom, libelle: `${p.nom} · seuil ${p.seuil.toFixed(2)}`,
  }));

  const qui = selecteur("membre-a-affecter", membres);
  const ou = selecteur("poste-a-pourvoir", postes);
  const envoyer = el("button", "action", "Demander l'affectation");
  envoyer.type = "button";

  const ligne = el("div", "commandes");
  ligne.append(qui, el("span", "liant", "à"), ou, envoyer);
  corps.appendChild(ligne);

  const verdict = el("div", "carte-verdict");
  verdict.hidden = true;
  corps.appendChild(verdict);

  function peindreVerdict(d) {
    verdict.replaceChildren();
    verdict.hidden = false;
    verdict.className = `carte-verdict ${d.accepte ? "accorde" : "refuse"}`;

    verdict.appendChild(el("p", "verdict-titre", d.titre));
    verdict.appendChild(el("p", "verdict-parole", d.parole));
    if (d.detail) verdict.appendChild(el("p", "verdict-detail", d.detail));

    if (d.alternative) {
      const alt = el("p", "verdict-alt");
      alt.append("Recommandé à la place : ");
      const lien = el("a", null, d.alternative.nom);
      lien.href = `#/equipage/${encodeURIComponent(d.alternative.nom)}`;
      alt.appendChild(lien);
      const v = el("span", "mesure-inline", ` ${d.alternative.cognitive.toFixed(2)}`);
      v.style.color = couleur(d.alternative.cognitive);
      alt.appendChild(v);
      verdict.appendChild(alt);
    }

    if (!d.accepte && !d.erreur) {
      const choix = el("div", "commandes");
      const deroger = el("button", "action danger", "Déroger sous ma responsabilité");
      deroger.type = "button";
      const suivre = el("button", "action secondaire", "Suivre l'avis");
      suivre.type = "button";

      deroger.addEventListener("click", async () => {
        deroger.disabled = suivre.disabled = true;
        const r = await poster("/api/derogation", { nom: d.nom, poste: d.poste });
        peindreVerdict({ ...r, nom: d.nom, poste: d.poste });
        surChangement?.();
      });
      suivre.addEventListener("click", () => {
        if (d.alternative) qui.value = d.alternative.nom;
        verdict.hidden = true;
      });

      choix.append(deroger, suivre);
      verdict.appendChild(choix);
    }
  }

  envoyer.addEventListener("click", async () => {
    envoyer.disabled = true;
    verdict.hidden = true;
    const d = await poster("/api/affectation", { nom: qui.value, poste: ou.value });
    peindreVerdict(d.erreur ? { ...d, titre: "ACCES REFUSE", parole: d.erreur } : d);
    envoyer.disabled = false;
    if (d.accepte) surChangement?.();
  });

  hote.appendChild(section);
}
