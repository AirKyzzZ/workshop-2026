const SVGNS = "http://www.w3.org/2000/svg";

const SALLE_W = 146;
const SALLE_H = 100;
const COL_X = [62, 218, 374];
const RANG_Y = [52, 238];
const COULOIR_Y = 195;

const PLAN = [
  { nom: "laboratoire", col: 0, rang: 0 },
  { nom: "infirmerie", col: 1, rang: 0 },
  { nom: "pont", col: 2, rang: 0 },
  { nom: "atelier", col: 0, rang: 1 },
  { nom: "serre", col: 1, rang: 1 },
  { nom: "réacteur", col: 2, rang: 1 },
];

const el = (t, a = {}) => {
  const n = document.createElementNS(SVGNS, t);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
};

const txt = (contenu, a) => {
  const n = el("text", a);
  n.textContent = contenu;
  return n;
};

function structure(svg) {
  svg.appendChild(el("path", {
    class: "coque",
    d: "M 36 78 Q 36 26 88 26 L 520 26 Q 566 26 582 66 L 606 176 "
     + "Q 612 195 606 214 L 582 324 Q 566 364 520 364 L 88 364 "
     + "Q 36 364 36 312 Z",
  }));
  svg.appendChild(el("line", {
    class: "couloir", x1: 58, y1: COULOIR_Y, x2: 596, y2: COULOIR_Y,
  }));
  for (const x of COL_X) {
    const cx = x + SALLE_W / 2;
    svg.appendChild(el("line", {
      class: "embranchement", x1: cx, y1: RANG_Y[0] + SALLE_H, x2: cx, y2: COULOIR_Y,
    }));
    svg.appendChild(el("line", {
      class: "embranchement", x1: cx, y1: COULOIR_Y, x2: cx, y2: RANG_Y[1],
    }));
  }
  svg.appendChild(txt("PROUE", { class: "repere", x: 594, y: COULOIR_Y - 11, "text-anchor": "end" }));
  svg.appendChild(txt("POUPE", { class: "repere", x: 58, y: COULOIR_Y - 11 }));
}

function salle(svg, c, d, postes, capacites, surClic) {
  const x = COL_X[c.col];
  const y = RANG_Y[c.rang];
  const g = el("g");

  let cls = "salle";
  if (d.fumee) cls += " feu";
  else if (d.alerte) cls += " alerte";
  g.appendChild(el("rect", { class: cls, x, y, width: SALLE_W, height: SALLE_H, rx: 3 }));

  g.appendChild(txt(c.nom, { class: "salle-nom", x: x + 13, y: y + 27 }));
  if (d.instrumente) {
    g.appendChild(el("circle", { class: "temoin", cx: x + SALLE_W - 14, cy: y + 19, r: 3.5 }));
  }

  (postes || []).forEach((p, i) => {
    g.appendChild(txt(p.titulaire ? `${p.nom} · ${p.titulaire}` : `${p.nom} · vacant`, {
      class: "salle-poste" + (p.titulaire ? "" : " vacant"),
      x: x + 13, y: y + 43 + i * 11,
    }));
  });

  const mesures = d.instrumente
    ? `${d.temp_c?.toFixed(1)} °C · ${d.humidite?.toFixed(0)} % · ${d.bruit_db} dB`
    : `${d.bruit_db ?? "--"} dB`;
  g.appendChild(txt(mesures, {
    class: "salle-val" + (d.humidite > 60 ? " chaud" : ""),
    x: x + 13, y: y + SALLE_H - 26,
  }));

  (d.occupants || []).forEach((nom, i) => {
    const v = capacites[nom] ?? 1;
    const pt = el("circle", {
      class: "membre-pt " + (v >= 0.7 ? "" : v >= 0.45 ? "bas" : "crit"),
      cx: x + 16 + (i % 10) * 14, cy: y + SALLE_H - 13, r: 4,
    });
    pt.appendChild(el("title")).textContent = `${nom} — ${v.toFixed(2)}`;
    g.appendChild(pt);
  });

  if (surClic) {
    g.setAttribute("class", "salle-groupe");
    g.addEventListener("click", () => surClic(c.nom));
  }
  svg.appendChild(g);
}

export function dessinerPlan(data, surClic) {
  const svg = document.getElementById("plan");
  svg.replaceChildren();

  const parNom = Object.fromEntries(data.compartiments.map((c) => [c.nom, c]));
  const capacites = Object.fromEntries(data.equipage.map((m) => [m.nom, m.cognitive]));
  const postes = {};
  data.postes.forEach((p) => (postes[p.compartiment] ??= []).push(p));

  structure(svg);
  for (const c of PLAN) salle(svg, c, parNom[c.nom] ?? {}, postes[c.nom], capacites, surClic);

  return data.compartiments.filter((c) => c.instrumente).length;
}
