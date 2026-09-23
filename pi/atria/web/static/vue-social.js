import { bloc, couleur, el, json } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const L = 1200;
const H = 560;
const MARGE = 44;

const svgEl = (t, a = {}) => {
  const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]);
  return n;
};

// Aucune bibliotheque de graphe : le vaisseau doit s'afficher sans reseau.
function disposer(noms, aretes, iterations = 400) {
  const pos = new Map();
  noms.forEach((nom, i) => {
    const angle = (i / noms.length) * Math.PI * 2;
    pos.set(nom, { x: L / 2 + Math.cos(angle) * 360, y: H / 2 + Math.sin(angle) * 190,
                   vx: 0, vy: 0 });
  });

  for (let pas = 0; pas < iterations; pas++) {
    const refroidissement = 1 - pas / iterations;

    for (const a of noms) {
      const pa = pos.get(a);
      pa.vx += (L / 2 - pa.x) * 0.004;
      pa.vy += (H / 2 - pa.y) * 0.004;
      for (const b of noms) {
        if (a === b) continue;
        const pb = pos.get(b);
        const dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d2 = Math.max(400, dx * dx + dy * dy);
        const f = 22000 / d2;
        pa.vx += dx * f / Math.sqrt(d2);
        pa.vy += dy * f / Math.sqrt(d2);
      }
    }

    for (const e of aretes) {
      const pa = pos.get(e.un), pb = pos.get(e.deux);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const repos = e.lien >= 0 ? 110 : 280;
      const f = (d - repos) * 0.02 * Math.max(0.15, Math.abs(e.lien));
      pa.vx += dx / d * f; pa.vy += dy / d * f;
      pb.vx -= dx / d * f; pb.vy -= dy / d * f;
    }

    for (const nom of noms) {
      const p = pos.get(nom);
      p.x = Math.max(MARGE, Math.min(L - MARGE, p.x + p.vx * 0.5 * refroidissement));
      p.y = Math.max(MARGE, Math.min(H - MARGE, p.y + p.vy * 0.5 * refroidissement));
      p.vx *= 0.78; p.vy *= 0.78;
    }
  }
  return pos;
}

const teinte = (v) =>
  v <= -0.20 ? "var(--critique)" : v >= 0.40 ? "var(--nominal)" : "var(--trait-fort)";

function legende() {
  const d = el("div", "legende-graphe");
  const item = (classe, texte) => {
    const s = el("span", "cle");
    s.appendChild(el("i", classe));
    s.append(texte);
    return s;
  };
  d.append(
    item("amical", "affinité"),
    item("hostile", "hostilité"),
    item("neutre", "co-présence"),
    item("isole", "isolement"));
  return d;
}

export async function vueSocial(hote) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Graphe social"));
  entete.appendChild(el("span", "sous-titre",
    "Déduit des présences partagées et des incidents. Personne ne déclare rien."));
  hote.appendChild(entete);

  const d = await json("/api/social");
  const parNom = new Map(d.noeuds.map((n) => [n.nom, n]));

  const vue = bloc("Liens d'équipage",
    `${d.noeuds.length} membres · ${d.fenetre_jours} jours`);
  vue.corps.appendChild(el("p", "intro",
    "Chaque arête est un temps partagé mesuré, corrigé par les frictions observées. "
    + "Faites glisser un membre pour démêler son voisinage."));

  const filtres = el("div", "filtres");
  let mode = "marquants";
  for (const [cle, libelle] of [
    ["marquants", "Liens marquants"],
    ["amical", "Affinités"],
    ["hostile", "Hostilités"],
    ["tous", "Tout le réseau"],
  ]) {
    const b = el("button", "filtre" + (cle === mode ? " actif" : ""), libelle);
    b.type = "button";
    b.addEventListener("click", () => {
      mode = cle;
      for (const x of filtres.children) x.classList.toggle("actif", x === b);
      dessiner();
    });
    filtres.appendChild(b);
  }
  vue.corps.appendChild(filtres);

  const cadre = el("div", "graphe");
  vue.corps.appendChild(cadre);
  const detail = el("p", "note", "Survolez un membre pour isoler ses liens, cliquez pour sa fiche.");
  vue.corps.appendChild(detail);
  vue.corps.appendChild(legende());
  vue.section.classList.add("large");
  hote.appendChild(vue.section);

  function aretesVisibles() {
    if (mode === "tous") return d.liens;
    if (mode === "amical") return d.liens.filter((l) => l.nature === "amical");
    if (mode === "hostile") return d.liens.filter((l) => l.nature === "hostile");
    return d.liens.filter((l) => l.nature !== "neutre");
  }

  function dessiner() {
    const aretes = aretesVisibles();
    const relies = new Set(aretes.flatMap((e) => [e.un, e.deux]));
    const focalise = mode === "amical" || mode === "hostile";
    const montres = focalise ? d.noeuds.filter((n) => relies.has(n.nom)) : d.noeuds;
    const noms = montres.map((n) => n.nom);
    const pos = disposer(noms, aretes);

    cadre.replaceChildren();
    const svg = svgEl("svg", { class: "graphe-svg", viewBox: `0 0 ${L} ${H}`,
                               preserveAspectRatio: "xMidYMid meet" });
    const defs = svgEl("defs");
    svg.appendChild(defs);

    const groupeLiens = svgEl("g");
    const attaches = new Map();
    for (const e of aretes) {
      const a = pos.get(e.un), b = pos.get(e.deux);
      if (!a || !b) continue;
      const ligne = svgEl("line", {
        x1: a.x.toFixed(1), y1: a.y.toFixed(1),
        x2: b.x.toFixed(1), y2: b.y.toFixed(1),
        stroke: teinte(e.lien),
        "stroke-width": (0.8 + Math.abs(e.lien) * 2.6).toFixed(2),
        "stroke-linecap": "round",
        opacity: (0.2 + Math.abs(e.lien) * 0.55).toFixed(2),
      });
      ligne.appendChild(svgEl("title")).textContent =
        `${e.un} / ${e.deux} · lien ${e.lien} · ${e.minutes} min partagées`
        + (e.frictions ? ` · ${e.frictions} frictions` : "")
        + (e.compartiment ? ` · ${e.compartiment}` : "");
      groupeLiens.appendChild(ligne);
      attaches.set(e.un, (attaches.get(e.un) || []).concat([[ligne, 1]]));
      attaches.set(e.deux, (attaches.get(e.deux) || []).concat([[ligne, 2]]));
    }
    svg.appendChild(groupeLiens);

    const groupeNoeuds = svgEl("g");
    for (const n of montres) {
      const p = pos.get(n.nom);
      const r = 14 + Math.min(10, n.liens * 0.4);
      const g = svgEl("g", { class: "noeud", transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` });
      g.dataset.nom = n.nom;

      const clip = svgEl("clipPath", { id: `portrait-${n.nom}` });
      clip.appendChild(svgEl("circle", { cx: 0, cy: 0, r }));
      defs.appendChild(clip);

      if (n.isolement >= 0.8) {
        g.appendChild(svgEl("circle", {
          cx: 0, cy: 0, r: r + 6, fill: "none", stroke: "var(--attention)",
          "stroke-width": 1.2, "stroke-dasharray": "3 4", opacity: .85,
        }));
      }

      const photo = svgEl("image", {
        x: -r, y: -r, width: r * 2, height: r * 2,
        href: `/static/equipage/${n.nom}.jpg`,
        "clip-path": `url(#portrait-${n.nom})`,
        preserveAspectRatio: "xMidYMid slice",
      });
      g.appendChild(photo);

      g.appendChild(svgEl("circle", {
        cx: 0, cy: 0, r, fill: "none",
        stroke: n.hostile > 0 ? "var(--critique)" : couleur(n.cognitive),
        "stroke-width": n.hostile > 0 ? 2.6 : 2,
      }));

      const etiquette = svgEl("text", { x: 0, y: r + 13, "text-anchor": "middle",
                                        class: "graphe-nom" });
      etiquette.textContent = n.nom;
      g.appendChild(etiquette);

      g.appendChild(svgEl("title")).textContent =
        `${n.nom} · ${n.role}\ncapacité ${n.cognitive} · conduite ${n.conduite}\n`
        + `${n.liens} liens dont ${n.amical} amicaux et ${n.hostile} hostiles`;

      groupeNoeuds.appendChild(g);
      attacherGestes(g, n, p, attaches.get(n.nom) || []);
    }
    svg.appendChild(groupeNoeuds);
    cadre.appendChild(svg);

    function attacherGestes(g, n, p, liens) {
      let depart = null;
      let bouge = false;

      const versSvg = (ev) => {
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      };

      g.addEventListener("pointerdown", (ev) => {
        depart = versSvg(ev);
        bouge = false;
        g.setPointerCapture(ev.pointerId);
        g.classList.add("saisi");
        ev.preventDefault();
      });

      g.addEventListener("pointermove", (ev) => {
        if (!depart) return;
        const q = versSvg(ev);
        p.x = Math.max(MARGE, Math.min(L - MARGE, p.x + q.x - depart.x));
        p.y = Math.max(MARGE, Math.min(H - MARGE, p.y + q.y - depart.y));
        depart = q;
        bouge = true;
        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        for (const [ligne, bout] of liens) {
          ligne.setAttribute(`x${bout}`, p.x.toFixed(1));
          ligne.setAttribute(`y${bout}`, p.y.toFixed(1));
        }
      });

      const relacher = (ev) => {
        if (!depart) return;
        depart = null;
        g.classList.remove("saisi");
        if (g.hasPointerCapture(ev.pointerId)) g.releasePointerCapture(ev.pointerId);
      };
      g.addEventListener("pointerup", relacher);
      g.addEventListener("pointercancel", relacher);

      g.addEventListener("click", () => {
        if (bouge) return;
        location.hash = `#/equipage/${encodeURIComponent(n.nom)}`;
      });

      g.addEventListener("mouseenter", () => surligner(n.nom));
      g.addEventListener("mouseleave", () => surligner(null));
    }

    function surligner(nom) {
      const proches = new Set(nom ? [nom] : []);
      if (nom) {
        for (const e of aretes) {
          if (e.un === nom) proches.add(e.deux);
          if (e.deux === nom) proches.add(e.un);
        }
      }
      let i = 0;
      for (const e of aretes) {
        const ligne = groupeLiens.children[i++];
        const concerne = !nom || e.un === nom || e.deux === nom;
        ligne.style.opacity = concerne ? "" : "0.05";
      }
      for (const g of groupeNoeuds.children) {
        g.style.opacity = !nom || proches.has(g.dataset.nom) ? "" : "0.18";
      }
      if (!nom) {
        detail.textContent = "Survolez un membre pour isoler ses liens, cliquez pour sa fiche.";
        return;
      }
      const n = parNom.get(nom);
      detail.textContent = `${nom} · ${n.role} · capacité ${n.cognitive}, conduite ${n.conduite}`
        + ` · ${n.amical} affinités, ${n.hostile} hostilités`
        + (n.isolement >= 0.8 ? " · isolé du reste de l'équipage" : "");
    }
  }

  dessiner();

  const conflits = bloc("Conflits probables", "avant qu'ils n'arrivent");
  if (!d.conflits.length) {
    conflits.corps.appendChild(el("div", "vide", "Aucune paire hostile détectée."));
  } else {
    conflits.corps.appendChild(el("p", "intro",
      "Paires dont les incidents tombent quand elles partagent un compartiment. "
      + "Le régulateur s'en sert pour refuser une affectation commune."));
    for (const c of d.conflits) {
      const ligne = el("div", "rang");
      const nom = el("span", "nom");
      const a = el("a", null, c.paire[0]);
      a.href = `#/equipage/${encodeURIComponent(c.paire[0])}`;
      const b = el("a", null, c.paire[1]);
      b.href = `#/equipage/${encodeURIComponent(c.paire[1])}`;
      nom.append(a, el("span", "liant", " × "), b);
      nom.appendChild(el("small", null, c.motif));
      const lieu = el("span", "mono", c.compartiment || "—");
      lieu.style.color = "var(--faible)";
      const v = el("span", "val", c.lien.toFixed(2));
      v.style.color = "var(--critique)";
      ligne.append(nom, lieu, v);
      conflits.corps.appendChild(ligne);
    }
  }
  hote.appendChild(conflits.section);

  const mental = bloc("Contagion mentale", "le stress suit les liens");
  if (!d.contagion_mentale.length) {
    mental.corps.appendChild(el("div", "vide", "Aucune propagation attendue."));
  } else {
    mental.corps.appendChild(el("p", "intro",
      "Stress projeté en tenant compte de l'entourage. Un membre entouré de collègues "
      + "sous tension est plus exposé que son propre relevé ne le montre."));
    for (const c of d.contagion_mentale.slice(0, 6)) {
      const ligne = el("div", "rang");
      const nom = el("span", "nom");
      const a = el("a", null, c.nom);
      a.href = `#/equipage/${encodeURIComponent(c.nom)}`;
      nom.appendChild(a);
      nom.appendChild(el("small", null, `entouré de ${c.voisins.join(", ")}`));
      const propre = el("span", "mono", c.stress.toFixed(2));
      propre.style.color = "var(--faible)";
      const fleche = el("span", "liant", "→");
      const projete = el("span", "val", c.projete.toFixed(2));
      projete.style.color = "var(--attention)";
      ligne.append(nom, propre, fleche, projete);
      mental.corps.appendChild(ligne);
    }
  }
  hote.appendChild(mental.section);
}
