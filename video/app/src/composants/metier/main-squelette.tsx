import { useMemo } from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, nombreFr, progression } from "./commun";

export type PointMain = { x: number; y: number; z: number };
export type ImageMain = { frame: number; points: PointMain[] };
export type Doigt = "pouce" | "index" | "majeur" | "annulaire" | "auriculaire";
export type MesureDoigt = { doigt: Doigt; libelle: string; ratio?: number };

export type MainSqueletteProps = {
  images: ImageMain[];
  mesures: MesureDoigt[];
  seuils: { doigt: number; pouce: number };
  libelles: { titre: string; points: string; seuil: string; tendu: string; replie: string };
  verdict?: { titre: string; libelle: string; score: number };
  debut?: number;
  intervallePoint?: number;
  intervalleDoigt?: number;
  vitesse?: number;
  cadrage?: "main" | "image";
  formatSource?: number;
};

type Vec = { x: number; y: number };

const NB_POINTS = 21;
const OS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const BOUTS: Record<Doigt, number> = { pouce: 4, index: 8, majeur: 12, annulaire: 16, auriculaire: 20 };
const PAUME = [0, 5, 9, 13, 17];
const DUREE_OS = 10;
const DUREE_MESURE = 24;
const ZONE_MAIN = { x: 220, y: 150, largeur: 940, hauteur: 830 };
const PANNEAU = { x: 1824 - 600, largeur: 600, haut: 200, ligne: 112 };

const poseA = (images: ImageMain[], source: number): PointMain[] => {
  const suivante = images.findIndex((im) => im.frame > source);
  if (suivante === -1) return images[images.length - 1].points;
  if (suivante === 0) return images[0].points;
  const a = images[suivante - 1];
  const b = images[suivante];
  const t = (source - a.frame) / (b.frame - a.frame);
  return a.points.map((p, i) => ({
    x: p.x + (b.points[i].x - p.x) * t,
    y: p.y + (b.points[i].y - p.y) * t,
    z: p.z + (b.points[i].z - p.z) * t,
  }));
};

const distance3 = (a: PointMain, b: PointMain) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const ratioExtension = (points: PointMain[], doigt: Doigt): number => {
  const bout = BOUTS[doigt];
  const reference = distance3(points[bout - 2], points[bout - 3]);
  return reference ? distance3(points[bout], points[bout - 3]) / reference : 0;
};

const distanceSegment = (p: Vec, a: Vec, b: Vec): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const placerEtiquettes = (pts: Vec[]): Vec[] => {
  const centre = {
    x: PAUME.reduce((s, i) => s + pts[i].x, 0) / PAUME.length,
    y: PAUME.reduce((s, i) => s + pts[i].y, 0) / PAUME.length,
  };
  const placees: (Vec & { l: number })[] = [];
  return pts.map((p, i) => {
    const l = String(i).length * 18 + 6;
    const exterieur = Math.atan2(p.y - centre.y, p.x - centre.x);
    let meilleure = { x: 0, y: 0, cout: Number.POSITIVE_INFINITY };
    for (let k = 0; k < 24; k++) {
      const a = exterieur + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      const c = { x: p.x + Math.cos(a) * (l / 2 + 16), y: p.y + Math.sin(a) * 30 };
      let cout = Math.ceil(k / 2) * 0.9;
      pts.forEach((q, j) => {
        if (j !== i) cout += Math.max(0, 34 - Math.hypot(c.x - q.x, c.y - q.y)) * 3;
      });
      OS.forEach(([a1, b1]) => {
        cout += Math.max(0, 20 - distanceSegment(c, pts[a1], pts[b1])) * 2;
      });
      placees.forEach((e) => {
        const chevauche = Math.abs(c.x - e.x) < (l + e.l) / 2 + 6 && Math.abs(c.y - e.y) < 30;
        if (chevauche) cout += 120;
      });
      if (cout < meilleure.cout) meilleure = { ...c, cout };
    }
    placees.push({ x: meilleure.x, y: meilleure.y, l });
    return { x: meilleure.x - p.x, y: meilleure.y - p.y };
  });
};

export const MainSquelette: React.FC<MainSqueletteProps> = ({
  images,
  mesures,
  seuils,
  libelles,
  verdict,
  debut = 0,
  intervallePoint = 4,
  intervalleDoigt = 30,
  vitesse = 1,
  cadrage = "main",
  formatSource = 16 / 9,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (images.length === 0) throw new Error("MainSquelette : aucune image de main fournie");
  const incomplete = images.find((im) => im.points.length !== NB_POINTS);
  if (incomplete) {
    throw new Error(`MainSquelette : image ${incomplete.frame} avec ${incomplete.points.length} points au lieu de ${NB_POINTS}`);
  }

  const versEcran = useMemo(() => {
    if (cadrage === "image") return (p: PointMain): Vec => ({ x: p.x * width, y: p.y * height });
    const tous = images.flatMap((im) => im.points);
    const minX = Math.min(...tous.map((p) => p.x * formatSource));
    const maxX = Math.max(...tous.map((p) => p.x * formatSource));
    const minY = Math.min(...tous.map((p) => p.y));
    const maxY = Math.max(...tous.map((p) => p.y));
    const echelle = Math.min(ZONE_MAIN.largeur / (maxX - minX), ZONE_MAIN.hauteur / (maxY - minY));
    const ox = ZONE_MAIN.x + (ZONE_MAIN.largeur - (maxX - minX) * echelle) / 2;
    const oy = ZONE_MAIN.y + (ZONE_MAIN.hauteur - (maxY - minY) * echelle) / 2;
    return (p: PointMain): Vec => ({
      x: ox + (p.x * formatSource - minX) * echelle,
      y: oy + (p.y - minY) * echelle,
    });
  }, [cadrage, images, formatSource, width, height]);

  const decalages = useMemo(() => placerEtiquettes(images[0].points.map(versEcran)), [images, versEcran]);

  const source = (f: number) => images[0].frame + f * vitesse;
  const pose = poseA(images, source(frame));
  const pts = pose.map(versEcran);

  const apparitionPoint = (i: number) => debut + i * intervallePoint;
  const finSquelette = apparitionPoint(NB_POINTS - 1) + DUREE_OS + 8;
  const debutMesure = (i: number) => finSquelette + i * intervalleDoigt;
  const debutVerdict = debutMesure(mesures.length) + 6;

  const resultats = mesures.map((m, i) => {
    const ratio = m.ratio ?? ratioExtension(poseA(images, source(debutMesure(i) + DUREE_MESURE)), m.doigt);
    const seuil = m.doigt === "pouce" ? seuils.pouce : seuils.doigt;
    return { ...m, ratio, tendu: ratio >= seuil };
  });

  const doigtsTendus = new Set(resultats.filter((r) => r.tendu).map((r) => BOUTS[r.doigt]));
  const osDuDoigtTendu = (a: number, b: number) =>
    [...doigtsTendus].some((bout) => a >= bout - 3 && b <= bout && a < b);

  const pVerdict = verdict ? progression(frame, debutVerdict, 18) : 0;
  const attenuationNumeros = interpolate(frame, [finSquelette, finSquelette + 15], [1, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pointsVisibles = Math.min(NB_POINTS, Math.max(0, Math.ceil((frame - debut) / intervallePoint)));
  const yVerdict = PANNEAU.haut + mesures.length * PANNEAU.ligne + 44;

  const centrePaume = {
    x: PAUME.reduce((s, i) => s + pts[i].x, 0) / PAUME.length,
    y: PAUME.reduce((s, i) => s + pts[i].y, 0) / PAUME.length,
  };

  const cadre = (liste: Vec[]) => ({
    x0: Math.min(...liste.map((p) => p.x)) - 40,
    x1: Math.max(...liste.map((p) => p.x)) + 40,
    y0: Math.min(...liste.map((p) => p.y)) - 40,
    y1: Math.max(...liste.map((p) => p.y)) + 40,
  });
  const boite = cadre(pts);
  const cadreInitial = cadre(images[0].points.map(versEcran));
  const echelleMax = Math.max(2.5, ...resultats.map((r) => r.ratio * 1.1));
  const x1Panneau = PANNEAU.x + PANNEAU.largeur;
  const debutPanneau = finSquelette - 6;

  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <filter id="main-lueur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="flou" />
          <feMerge>
            <feMergeNode in="flou" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g style={{ opacity: progression(frame, debut - 10, 14) }}>
        <text
          x={cadreInitial.x0}
          y={cadreInitial.y0 - 24}
          fill={couleurs.texteDoux}
          fontFamily={polices.donnees}
          fontSize={24}
          letterSpacing="0.06em"
        >
          {libelles.points}
          <tspan fill={couleurs.texte} dx={14}>
            {String(pointsVisibles).padStart(2, "0")}
          </tspan>
          <tspan fill={couleurs.texteFaible}>/{NB_POINTS}</tspan>
        </text>
      </g>

      {OS.map(([a, b]) => {
        const depart = Math.max(apparitionPoint(a), apparitionPoint(b));
        const p = progression(frame, depart, DUREE_OS);
        if (p <= 0) return null;
        const critique = pVerdict > 0 && osDuDoigtTendu(a, b);
        return (
          <line
            key={`${a}-${b}`}
            x1={pts[a].x}
            y1={pts[a].y}
            x2={pts[a].x + (pts[b].x - pts[a].x) * p}
            y2={pts[a].y + (pts[b].y - pts[a].y) * p}
            stroke={critique ? interpolateColors(pVerdict, [0, 1], [alpha(couleurs.texte, 0.55), couleurs.critique]) : alpha(couleurs.texte, 0.55)}
            strokeWidth={critique ? 2.5 + pVerdict * 2.5 : 2.5}
            strokeLinecap="round"
            filter={critique ? "url(#main-lueur)" : undefined}
          />
        );
      })}

      {pts.map((p, i) => {
        const t0 = apparitionPoint(i);
        const pop = progression(frame, t0, 8);
        if (pop <= 0) return null;
        const onde = progression(frame, t0, 16);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={7 + onde * 22} fill="none" stroke={couleurs.texte} strokeWidth={1.5} opacity={(1 - onde) * 0.7} />
            <circle cx={p.x} cy={p.y} r={11 * pop} fill={couleurs.fond} stroke={alpha(couleurs.texte, 0.35)} strokeWidth={1.5} />
            <circle cx={p.x} cy={p.y} r={5.5 * pop} fill={couleurs.blanc} />
            <text
              x={p.x + decalages[i].x}
              y={p.y + decalages[i].y}
              fill={couleurs.texteDoux}
              fontFamily={polices.donnees}
              fontSize={24}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={pop * attenuationNumeros}
            >
              {i}
            </text>
          </g>
        );
      })}

      {resultats.map((r, i) => {
        const t0 = debutMesure(i);
        const pRef = progression(frame, t0, 8);
        if (pRef <= 0) return null;
        const pLigne = progression(frame, t0 + 6, DUREE_MESURE - 6);
        const pStatut = progression(frame, t0 + DUREE_MESURE - 2, 10);
        const couleurFinale = r.tendu ? couleurs.attention : couleurs.texteDoux;
        const couleur = interpolateColors(pStatut, [0, 1], [couleurs.blanc, couleurFinale]);
        const bout = BOUTS[r.doigt];
        const base = pts[bout - 3];
        const milieu = pts[bout - 2];
        const tip = pts[bout];
        const dx = tip.x - base.x;
        const dy = tip.y - base.y;
        const longueur = Math.hypot(dx, dy) || 1;
        let n = { x: -dy / longueur, y: dx / longueur };
        const coteEtiquettes = [bout - 3, bout - 2, bout - 1, bout].reduce((s, k) => s + n.x * decalages[k].x + n.y * decalages[k].y, 0);
        const versExterieur = n.x * ((base.x + tip.x) / 2 - centrePaume.x) + n.y * ((base.y + tip.y) / 2 - centrePaume.y);
        if (Math.abs(coteEtiquettes) > 8 ? coteEtiquettes > 0 : versExterieur < 0) n = { x: -n.x, y: -n.y };
        const ecart = 34;
        const a = { x: base.x + n.x * ecart, y: base.y + n.y * ecart };
        const fin = { x: a.x + dx * pLigne, y: a.y + dy * pLigne };
        const opaciteMesure = interpolate(frame, [debutMesure(i + 1), debutMesure(i + 1) + 12], [1, 0.45], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const opaciteEtiquette = interpolate(frame, [t0 + 6, t0 + 12, debutMesure(i + 1), debutMesure(i + 1) + 10], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <g key={r.doigt} opacity={opaciteMesure}>
            <line x1={base.x} y1={base.y} x2={base.x + (milieu.x - base.x) * pRef} y2={base.y + (milieu.y - base.y) * pRef} stroke={couleur} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
            <line x1={base.x} y1={base.y} x2={a.x + n.x * 8} y2={a.y + n.y * 8} stroke={couleur} strokeWidth={1.5} opacity={pRef * 0.7} />
            <line x1={tip.x} y1={tip.y} x2={tip.x + n.x * (ecart + 8)} y2={tip.y + n.y * (ecart + 8)} stroke={couleur} strokeWidth={1.5} opacity={pStatut * 0.7} />
            <line x1={a.x} y1={a.y} x2={fin.x} y2={fin.y} stroke={couleur} strokeWidth={2.5} strokeDasharray="10 6" />
            <line x1={a.x - n.y * 10} y1={a.y + n.x * 10} x2={a.x + n.y * 10} y2={a.y - n.x * 10} stroke={couleur} strokeWidth={2.5} opacity={pRef} />
            <circle cx={fin.x} cy={fin.y} r={6} fill={couleur} opacity={pLigne > 0 ? 1 : 0} />
            <g opacity={opaciteEtiquette}>
              <rect x={fin.x + n.x * 30 - 8} y={fin.y + n.y * 30 - 24} width={128} height={48} rx={4} fill={alpha(couleurs.fond, 0.85)} stroke={alpha(couleur, 0.6)} strokeWidth={1} />
              <text x={fin.x + n.x * 30 + 56} y={fin.y + n.y * 30} fill={couleur} fontFamily={polices.donnees} fontSize={30} textAnchor="middle" dominantBaseline="central">
                {nombreFr(r.ratio * pLigne)}
              </text>
            </g>
          </g>
        );
      })}

      {verdict && pVerdict > 0 ? (
        <g opacity={pVerdict} style={{ scale: interpolate(pVerdict, [0, 1], [1.05, 1]), transformOrigin: `${(boite.x0 + boite.x1) / 2}px ${(boite.y0 + boite.y1) / 2}px` }}>
          {[
            [boite.x0, boite.y0, 1, 1],
            [boite.x1, boite.y0, -1, 1],
            [boite.x0, boite.y1, 1, -1],
            [boite.x1, boite.y1, -1, -1],
          ].map(([x, y, sx, sy]) => (
            <path key={`${sx}${sy}`} d={`M ${x} ${y + sy * 48} L ${x} ${y} L ${x + sx * 48} ${y}`} fill="none" stroke={couleurs.critique} strokeWidth={3} />
          ))}
        </g>
      ) : null}

      <g style={{ opacity: progression(frame, debutPanneau, 16), translate: `${interpolate(progression(frame, debutPanneau, 20), [0, 1], [24, 0])}px 0px` }}>
        <text x={PANNEAU.x} y={PANNEAU.haut - 64} fill={couleurs.texteDoux} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.06em">
          {libelles.titre}
        </text>
        <line x1={PANNEAU.x} y1={PANNEAU.haut - 36} x2={x1Panneau} y2={PANNEAU.haut - 36} stroke={couleurs.trait} strokeWidth={1.5} />
      </g>

      {resultats.map((r, i) => {
        const t0 = debutMesure(i);
        const pRangee = progression(frame, t0, 14);
        if (pRangee <= 0) return null;
        const pLigne = progression(frame, t0 + 6, DUREE_MESURE - 6);
        const pStatut = progression(frame, t0 + DUREE_MESURE - 2, 10);
        const couleurStatut = r.tendu ? couleurs.attention : couleurs.texteDoux;
        const y = PANNEAU.haut + i * PANNEAU.ligne;
        const seuil = r.doigt === "pouce" ? seuils.pouce : seuils.doigt;
        const xSeuil = PANNEAU.x + PANNEAU.largeur * (seuil / echelleMax);
        const actif = frame >= t0 && frame < debutMesure(i + 1);
        return (
          <g key={r.doigt} style={{ opacity: pRangee, translate: `${interpolate(pRangee, [0, 1], [18, 0])}px 0px` }}>
            <rect x={PANNEAU.x - 24} y={y + 8} width={4} height={PANNEAU.ligne - 28} fill={couleurs.blanc} opacity={actif ? 1 : 0} />
            <text x={PANNEAU.x} y={y + 50} fill={couleurs.texte} fontFamily={polices.display} fontWeight={500} fontSize={56} letterSpacing="0.02em">
              {r.libelle}
            </text>
            <text x={x1Panneau - 140} y={y + 42} fill={couleurStatut} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.08em" textAnchor="end" opacity={pStatut}>
              {r.tendu ? libelles.tendu : libelles.replie}
            </text>
            <text x={x1Panneau} y={y + 46} fill={pStatut > 0.5 ? couleurStatut : couleurs.texte} fontFamily={polices.donnees} fontSize={38} textAnchor="end">
              {nombreFr(r.ratio * pLigne)}
            </text>
            <rect x={PANNEAU.x} y={y + 72} width={PANNEAU.largeur} height={4} fill={couleurs.trait} />
            <rect x={PANNEAU.x} y={y + 72} width={PANNEAU.largeur * Math.min(1, (r.ratio * pLigne) / echelleMax)} height={4} fill={interpolateColors(pStatut, [0, 1], [couleurs.blanc, couleurStatut])} />
            <line x1={xSeuil} y1={y + 62} x2={xSeuil} y2={y + 86} stroke={couleurs.texteDoux} strokeWidth={2} />
          </g>
        );
      })}

      {mesures.length > 0 ? (
        <text
          x={PANNEAU.x + PANNEAU.largeur * (seuils.doigt / echelleMax)}
          y={PANNEAU.haut + mesures.length * PANNEAU.ligne + 2}
          fill={couleurs.texteDoux}
          fontFamily={polices.donnees}
          fontSize={24}
          letterSpacing="0.06em"
          textAnchor="middle"
          opacity={progression(frame, debutMesure(mesures.length - 1), 14)}
        >
          {libelles.seuil} {nombreFr(seuils.doigt)}
        </text>
      ) : null}

      {verdict && pVerdict > 0 ? (
        <g style={{ opacity: pVerdict, translate: `0px ${interpolate(pVerdict, [0, 1], [16, 0])}px` }}>
          <line x1={PANNEAU.x} y1={yVerdict} x2={PANNEAU.x + PANNEAU.largeur * progression(frame, debutVerdict, 20)} y2={yVerdict} stroke={couleurs.critique} strokeWidth={2} />
          <text x={PANNEAU.x} y={yVerdict + 48} fill={couleurs.texteDoux} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.06em">
            {verdict.titre}
          </text>
          <text x={x1Panneau} y={yVerdict + 50} fill={couleurs.critique} fontFamily={polices.donnees} fontSize={32} textAnchor="end">
            {nombreFr(verdict.score * progression(frame, debutVerdict, 20))}
          </text>
          <text x={PANNEAU.x} y={yVerdict + 148} fill={couleurs.critique} fontFamily={polices.display} fontWeight={600} fontSize={96} filter="url(#main-lueur)" opacity={0.35}>
            {verdict.libelle}
          </text>
          <text x={PANNEAU.x} y={yVerdict + 148} fill={couleurs.critique} fontFamily={polices.display} fontWeight={600} fontSize={96}>
            {verdict.libelle}
          </text>
        </g>
      ) : null}
    </svg>
  );
};
