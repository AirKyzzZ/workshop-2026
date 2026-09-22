export const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const couleur = (v) =>
  v >= 0.70 ? "var(--nominal)" : v >= 0.45 ? "var(--attention)" : "var(--critique)";

export const heure = (ts) =>
  new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const el = (balise, classe, contenu) => {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (contenu !== undefined) n.textContent = contenu;
  return n;
};

export function titre(texte, apres) {
  const h = el("h2", null);
  h.append(texte);
  if (apres) h.appendChild(el("em", null, apres));
  return h;
}

export function bloc(titreTexte, apres) {
  const s = el("section", "panneau");
  s.appendChild(titre(titreTexte, apres));
  const corps = el("div", "contenu");
  s.appendChild(corps);
  return { section: s, corps };
}

export function rangee(m, lien = true) {
  const r = el("div", "rang");
  const nom = el("span", "nom");
  if (lien) {
    const a = el("a", null, m.nom);
    a.href = `#/equipage/${encodeURIComponent(m.nom)}`;
    nom.appendChild(a);
  } else {
    nom.append(m.nom);
  }
  if (m.poste) nom.appendChild(el("small", null, m.poste));

  const jauge = el("span", "jauge");
  const barre = el("i");
  barre.style.width = `${m.cognitive * 100}%`;
  barre.style.background = couleur(m.cognitive);
  jauge.appendChild(barre);

  const val = el("span", "val", m.cognitive.toFixed(2));
  val.style.color = couleur(m.cognitive);

  r.append(nom, jauge, val);
  return r;
}

export function paire(libelle, valeur, teinte) {
  const d = el("div", "paire");
  d.appendChild(el("span", "etiquette", libelle));
  const v = el("span", "mesure", valeur);
  if (teinte) v.style.color = teinte;
  d.appendChild(v);
  return d;
}

export async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
