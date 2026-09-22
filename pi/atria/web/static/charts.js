const NS = "http://www.w3.org/2000/svg";

const noeud = (t, a = {}) => {
  const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
};

const libelle = (contenu, a) => {
  const n = noeud("text", a);
  n.textContent = contenu;
  return n;
};

function graduations(min, max, cible = 4) {
  const etendue = max - min;
  if (etendue <= 0) return [min];
  const brut = etendue / cible;
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * magnitude)
    .find((p) => etendue / p <= cible * 1.4) ?? magnitude * 10;
  const depart = Math.ceil(min / pas) * pas;
  const sorties = [];
  for (let v = depart; v <= max + 1e-9; v += pas) sorties.push(Number(v.toFixed(6)));
  return sorties;
}

const heureCourte = (ts) =>
  new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Trace une ou plusieurs series temporelles.
 * series: [{ cle, label, couleur, points: [{ts, valeur}] }]
 */
export function courbe(hote, { series, hauteur = 190, unite = "", seuil = null,
                               seuilLabel = "" } = {}) {
  hote.replaceChildren();
  const valides = series.filter((s) => s.points?.length > 1);
  if (!valides.length) {
    const vide = document.createElement("div");
    vide.className = "vide";
    vide.textContent = "Pas encore assez de mesures pour tracer une courbe.";
    hote.appendChild(vide);
    return;
  }

  const L = Math.round(Math.max(360, Math.min(hote.clientWidth || 640, 1100)));
  const H = hauteur;
  const marge = { haut: 12, bas: 26, gauche: 46, droite: 14 };
  const utile = H - marge.haut - marge.bas;

  const tous = valides.flatMap((s) => s.points);
  const tMin = Math.min(...tous.map((p) => p.ts));
  const tMax = Math.max(...tous.map((p) => p.ts));
  let vMin = Math.min(...tous.map((p) => p.valeur));
  let vMax = Math.max(...tous.map((p) => p.valeur));
  if (seuil !== null) { vMin = Math.min(vMin, seuil); vMax = Math.max(vMax, seuil); }
  const marge_v = (vMax - vMin) * 0.12 || 1;
  vMin -= marge_v;
  vMax += marge_v;

  const X = (ts) => marge.gauche + ((ts - tMin) / (tMax - tMin || 1)) * largeurUtile;
  const Y = (v) => marge.haut + utile - ((v - vMin) / (vMax - vMin || 1)) * utile;

  const echelle = graduations(vMin, vMax);
  marge.gauche = 16 + Math.max(...echelle.map((v) => `${v}${unite}`.length)) * 6;
  const largeurUtile = L - marge.gauche - marge.droite;

  const svg = noeud("svg", {
    class: "courbe", viewBox: `0 0 ${L} ${H}`, width: L, height: H,
    preserveAspectRatio: "xMidYMid meet",
  });

  for (const v of echelle) {
    svg.appendChild(noeud("line", {
      class: "grille", x1: marge.gauche, y1: Y(v), x2: L - marge.droite, y2: Y(v),
    }));
    svg.appendChild(libelle(`${v}${unite}`, {
      class: "axe", x: marge.gauche - 8, y: Y(v) + 3, "text-anchor": "end",
    }));
  }

  if (seuil !== null) {
    svg.appendChild(noeud("line", {
      class: "seuil", x1: marge.gauche, y1: Y(seuil), x2: L - marge.droite, y2: Y(seuil),
    }));
    if (seuilLabel) {
      svg.appendChild(libelle(seuilLabel, {
        class: "axe seuil-texte", x: marge.gauche + 6, y: Y(seuil) - 5,
      }));
    }
  }

  for (const t of [tMin, (tMin + tMax) / 2, tMax]) {
    svg.appendChild(libelle(heureCourte(t), {
      class: "axe", x: X(t), y: H - 8,
      "text-anchor": t === tMin ? "start" : t === tMax ? "end" : "middle",
    }));
  }

  valides.forEach((s) => {
    const d = s.points.map((p, i) => `${i ? "L" : "M"} ${X(p.ts).toFixed(1)} ${Y(p.valeur).toFixed(1)}`).join(" ");
    const aire = `${d} L ${X(s.points.at(-1).ts).toFixed(1)} ${marge.haut + utile} `
               + `L ${X(s.points[0].ts).toFixed(1)} ${marge.haut + utile} Z`;
    svg.appendChild(noeud("path", { class: "aire", d: aire, fill: s.couleur, opacity: 0.09 }));
    svg.appendChild(noeud("path", { class: "trace", d, stroke: s.couleur }));
    const fin = s.points.at(-1);
    svg.appendChild(noeud("circle", {
      class: "pointe", cx: X(fin.ts), cy: Y(fin.valeur), r: 3.5, fill: s.couleur,
    }));
  });

  hote.appendChild(svg);

  if (valides.length > 1) {
    const legende = document.createElement("div");
    legende.className = "legende";
    valides.forEach((s) => {
      const item = document.createElement("span");
      const pastille = document.createElement("i");
      pastille.style.background = s.couleur;
      item.append(pastille, s.label);
      legende.appendChild(item);
    });
    hote.appendChild(legende);
  }
}

/** Mini courbe sans axes, pour une cellule de tableau. */
export function etincelle(hote, points, couleur) {
  hote.replaceChildren();
  if (!points || points.length < 2) return;
  const L = 96;
  const H = 22;
  const vs = points.map((p) => p.valeur);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const X = (i) => (i / (points.length - 1)) * L;
  const Y = (v) => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  const d = points.map((p, i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(p.valeur).toFixed(1)}`).join(" ");
  const svg = noeud("svg", { class: "etincelle", viewBox: `0 0 ${L} ${H}` });
  svg.appendChild(noeud("path", { d, stroke: couleur, fill: "none", "stroke-width": 1.5 }));
  hote.appendChild(svg);
}
