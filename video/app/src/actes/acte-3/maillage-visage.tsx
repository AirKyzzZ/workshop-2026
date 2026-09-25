import type React from "react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance } from "../../composants/charte/commun";

type Point = { x: number; y: number };

const LARGEUR = 244;
const HAUTEUR = 270;
const CENTRE = { x: LARGEUR / 2, y: HAUTEUR / 2 };
const RAYONS = { x: 92, y: 124 };

const anneau = (n: number, rx: number, ry: number, cx = 0, cy = 0, phase = 0): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return { x: CENTRE.x + cx + Math.cos(a) * rx, y: CENTRE.y + cy + Math.sin(a) * ry };
  });

const segment = (a: Point, b: Point, n: number): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / (n - 1), y: a.y + ((b.y - a.y) * i) / (n - 1) }));

const EXTERIEUR = anneau(28, RAYONS.x, RAYONS.y);
const MILIEU = anneau(20, RAYONS.x * 0.72, RAYONS.y * 0.74, 0, 0, 0.15);
const INTERIEUR = anneau(12, RAYONS.x * 0.42, RAYONS.y * 0.46, 0, 6, 0.3);
const YEUX = [anneau(6, 17, 7, -34, -18), anneau(6, 17, 7, 34, -18)];
const SOURCILS = [
  segment({ x: CENTRE.x - 60, y: CENTRE.y - 50 }, { x: CENTRE.x - 14, y: CENTRE.y - 34 }, 4),
  segment({ x: CENTRE.x + 60, y: CENTRE.y - 50 }, { x: CENTRE.x + 14, y: CENTRE.y - 34 }, 4),
];
const NEZ = [
  { x: CENTRE.x, y: CENTRE.y - 8 },
  { x: CENTRE.x - 10, y: CENTRE.y + 24 },
  { x: CENTRE.x, y: CENTRE.y + 30 },
  { x: CENTRE.x + 10, y: CENTRE.y + 24 },
];
const BOUCHE = anneau(10, 32, 8, 0, 62).map((p) => ({ ...p, y: p.y + (Math.abs(p.x - CENTRE.x) / 32) * 7 }));

const proche = (p: Point, liste: Point[]) =>
  liste.reduce((meilleur, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(meilleur.x - p.x, meilleur.y - p.y) ? q : meilleur), liste[0]);

const boucle = (liste: Point[]): [Point, Point][] => liste.map((p, i) => [p, liste[(i + 1) % liste.length]]);
const ligne = (liste: Point[]): [Point, Point][] => liste.slice(1).map((p, i) => [liste[i], p]);

const ARETES: [Point, Point][] = [
  ...boucle(EXTERIEUR),
  ...boucle(MILIEU),
  ...boucle(INTERIEUR),
  ...EXTERIEUR.map((p): [Point, Point] => [p, proche(p, MILIEU)]),
  ...MILIEU.map((p): [Point, Point] => [p, proche(p, INTERIEUR)]),
  ...YEUX.flatMap(boucle),
  ...boucle(NEZ),
  ...INTERIEUR.map((p): [Point, Point] => [p, proche(p, [...YEUX.flat(), ...NEZ, ...BOUCHE])]),
];
const EXPRESSION: [Point, Point][] = [...SOURCILS.flatMap(ligne), ...boucle(BOUCHE)];
const POINTS = [...EXTERIEUR, ...MILIEU, ...INTERIEUR, ...YEUX.flat(), ...SOURCILS.flat(), ...NEZ, ...BOUCHE];

export const MaillageVisage: React.FC<{ debut: number; detection: number }> = ({ debut, detection }) => {
  const frame = useCurrentFrame();
  const hostile = avance(frame, detection, 14);
  const couleurExpression = interpolateColors(hostile, [0, 1], [alpha(couleurs.texte, 0.6), couleurs.attention]);
  const apparition = (p: Point) => avance(frame, debut + (p.y / HAUTEUR) * 22, 10);

  return (
    <svg width={LARGEUR} height={HAUTEUR} style={{ display: "block", overflow: "visible" }}>
      {ARETES.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={alpha(couleurs.texte, 0.28)} strokeWidth={1} opacity={Math.min(apparition(a), apparition(b))} />
      ))}
      {EXPRESSION.map(([a, b], i) => (
        <line key={`e-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={couleurExpression} strokeWidth={2 + hostile} strokeLinecap="round" opacity={Math.min(apparition(a), apparition(b))} />
      ))}
      {POINTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={couleurs.texte} opacity={apparition(p) * 0.9} />
      ))}
    </svg>
  );
};
