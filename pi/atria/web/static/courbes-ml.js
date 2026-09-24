const NS = "http://www.w3.org/2000/svg";

const svgEl = (t, a = {}) => {
  const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
};

export function courbeRoc(hote, points, auc) {
  const L = 300;
  const H = 300;
  const M = 34;
  const svg = svgEl("svg", { class: "courbe-ml", viewBox: `0 0 ${L} ${H}` });

  const x = (v) => M + v * (L - M - 12);
  const y = (v) => H - M - v * (H - M - 12);

  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    svg.appendChild(svgEl("line", { class: "grille",
      x1: x(0), y1: y(t), x2: x(1), y2: y(t) }));
    svg.appendChild(svgEl("line", { class: "grille",
      x1: x(t), y1: y(0), x2: x(t), y2: y(1) }));
  }

  // La diagonale est le hasard : une courbe qui la suit ne trie rien.
  svg.appendChild(svgEl("line", { class: "hasard",
    x1: x(0), y1: y(0), x2: x(1), y2: y(1) }));

  const aire = points.map((p) => `${x(p.fpr)},${y(p.tpr)}`).join(" ");
  svg.appendChild(svgEl("polygon", { class: "roc-aire",
    points: `${x(0)},${y(0)} ${aire} ${x(1)},${y(0)}` }));
  svg.appendChild(svgEl("polyline", { class: "roc-trace", points: aire }));

  const retenu = points.reduce((a, b) =>
    Math.abs(b.seuil - 0.5) < Math.abs(a.seuil - 0.5) ? b : a);
  svg.appendChild(svgEl("circle", { class: "roc-point",
    cx: x(retenu.fpr), cy: y(retenu.tpr), r: 4 }));

  for (const [v, t] of [[0, "0"], [0.5, "0,5"], [1, "1"]]) {
    const bas = svgEl("text", { class: "axe", x: x(v), y: H - 12,
      "text-anchor": "middle" });
    bas.textContent = t;
    svg.appendChild(bas);
    const cote = svgEl("text", { class: "axe", x: M - 8, y: y(v) + 3,
      "text-anchor": "end" });
    cote.textContent = t;
    svg.appendChild(cote);
  }

  const titreX = svgEl("text", { class: "axe-titre", x: x(0.5), y: H - 1,
    "text-anchor": "middle" });
  titreX.textContent = "fausses alertes";
  svg.appendChild(titreX);

  const titreY = svgEl("text", { class: "axe-titre", x: 10, y: y(0.5),
    "text-anchor": "middle", transform: `rotate(-90 10 ${y(0.5)})` });
  titreY.textContent = "ruptures attrapées";
  svg.appendChild(titreY);

  const val = svgEl("text", { class: "roc-auc", x: x(0.62), y: y(0.28) });
  val.textContent = `AUC ${auc}`;
  svg.appendChild(val);

  hote.appendChild(svg);
  return { retenu };
}

export function courbeCout(hote, couts, iterations) {
  const L = 300;
  const H = 300;
  const M = 40;
  const svg = svgEl("svg", { class: "courbe-ml", viewBox: `0 0 ${L} ${H}` });

  const haut = Math.max(...couts);
  const bas = Math.min(...couts);
  const etendue = Math.max(1e-6, haut - bas);
  const x = (i) => M + (i / (couts.length - 1)) * (L - M - 12);
  const y = (v) => H - M - ((v - bas) / etendue) * (H - M - 16);

  for (let i = 0; i <= 4; i++) {
    svg.appendChild(svgEl("line", { class: "grille",
      x1: M, y1: y(bas + etendue * i / 4), x2: L - 12, y2: y(bas + etendue * i / 4) }));
  }

  svg.appendChild(svgEl("polyline", { class: "cout-trace",
    points: couts.map((v, i) => `${x(i)},${y(v)}`).join(" ") }));

  for (const [v, ancre] of [[haut, "depart"], [bas, "fin"]]) {
    const t = svgEl("text", { class: "axe", x: M - 8, y: y(v) + 3,
      "text-anchor": "end" });
    t.textContent = v.toFixed(3);
    svg.appendChild(t);
    if (ancre === "fin") {
      svg.appendChild(svgEl("circle", { class: "cout-point",
        cx: x(couts.length - 1), cy: y(v), r: 3.5 }));
    }
  }

  const titreX = svgEl("text", { class: "axe-titre", x: (M + L) / 2, y: H - 14,
    "text-anchor": "middle" });
  titreX.textContent = `${iterations} itérations de descente de gradient`;
  svg.appendChild(titreX);

  const titreY = svgEl("text", { class: "axe-titre", x: 10, y: H / 2,
    "text-anchor": "middle", transform: `rotate(-90 10 ${H / 2})` });
  titreY.textContent = "entropie croisée";
  svg.appendChild(titreY);

  hote.appendChild(svg);
}
