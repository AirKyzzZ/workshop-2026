const NS = "http://www.w3.org/2000/svg";

const svgEl = (t, a = {}) => {
  const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
};

const txt = (contenu, a) => {
  const n = svgEl("text", a);
  n.textContent = contenu;
  return n;
};

// Dispersion verticale déterministe : deux exemples de même probabilité ne doivent pas
// se superposer, et un tirage aléatoire ferait bouger le nuage à chaque rafraîchissement.
const decalage = (i, hauteur) => ((i * 2654435761) % 1000) / 1000 * hauteur;

export function nuagePredictions(hote, mesures, seuil = 0.5) {
  const L = 680;
  const H = 260;
  const MG = 96;
  const MD = 16;
  const bande = 62;
  const yRupture = 46;
  const yTenue = 150;

  const svg = svgEl("svg", { class: "nuage", viewBox: `0 0 ${L} ${H}` });
  const x = (p) => MG + p * (L - MG - MD);

  for (let i = 0; i <= 10; i += 1) {
    const p = i / 10;
    svg.appendChild(svgEl("line", { class: "nuage-grille",
      x1: x(p), y1: yRupture - 10, x2: x(p), y2: yTenue + bande + 6 }));
  }

  for (const [y0, libelle, compte] of [
    [yRupture, "ruptures réelles", mesures.predites_rupture.length],
    [yTenue, "tenues réelles", mesures.predites_tenue.length],
  ]) {
    svg.appendChild(txt(libelle, { class: "nuage-bande", x: MG - 12, y: y0 + 16,
      "text-anchor": "end" }));
    svg.appendChild(txt(`${compte} exemples`, { class: "nuage-compte", x: MG - 12,
      y: y0 + 31, "text-anchor": "end" }));
  }

  const points = (valeurs, y0, classeJuste, cote) => {
    valeurs.forEach((p, i) => {
      const faux = cote === "haut" ? p < seuil : p >= seuil;
      svg.appendChild(svgEl("circle", {
        class: "nuage-pt " + (faux ? "faux" : classeJuste),
        cx: x(p).toFixed(1), cy: (y0 + decalage(i, bande)).toFixed(1),
        r: faux ? 3.4 : 2.6,
      }));
    });
  };
  points(mesures.predites_rupture, yRupture, "juste-rupture", "haut");
  points(mesures.predites_tenue, yTenue, "juste-tenue", "bas");

  svg.appendChild(svgEl("line", { class: "nuage-seuil",
    x1: x(seuil), y1: yRupture - 14, x2: x(seuil), y2: yTenue + bande + 6 }));
  svg.appendChild(txt(`seuil ${seuil.toFixed(2)}`, { class: "nuage-seuil-texte",
    x: x(seuil), y: yRupture - 20, "text-anchor": "middle" }));

  for (const [p, t] of [[0, "0"], [0.5, "0,5"], [1, "1"]]) {
    svg.appendChild(txt(t, { class: "nuage-axe", x: x(p), y: H - 24,
      "text-anchor": "middle" }));
  }
  svg.appendChild(txt("probabilité de rupture rendue par le modèle", {
    class: "nuage-axe-titre", x: (MG + L - MD) / 2, y: H - 6, "text-anchor": "middle" }));

  const rates = mesures.predites_rupture.filter((p) => p < seuil).length;
  const fausses = mesures.predites_tenue.filter((p) => p >= seuil).length;
  hote.appendChild(svg);
  return { rates, fausses };
}
