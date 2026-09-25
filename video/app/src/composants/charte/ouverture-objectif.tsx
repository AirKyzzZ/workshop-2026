import type React from "react";
import { useId } from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque, courbes } from "./commun";

export type OuvertureObjectifProps = {
  children: React.ReactNode;
  debut?: number;
  duree?: number;
  lames?: number;
  rotation?: number;
  centre?: { x: number; y: number };
  rayonDepart?: number;
};

type Point = { x: number; y: number };

const avancer = (p: Point, angle: number, distance: number): Point => ({
  x: p.x + Math.cos(angle) * distance,
  y: p.y + Math.sin(angle) * distance,
});

const LUMIERE = -Math.PI * 0.7;
const PROFONDEUR = 520;

export const OuvertureObjectif: React.FC<OuvertureObjectifProps> = ({
  children,
  debut = 0,
  duree = 40,
  lames = 7,
  rotation = 70,
  centre = { x: 0.5, y: 0.5 },
  rayonDepart = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ombre = useId().replace(/[^\w-]/g, "");
  const p = avance(frame, debut, duree, courbes.bascule);
  const cx = centre.x * width;
  const cy = centre.y * height;
  const pas = (Math.PI * 2) / lames;
  const rayonFinal = (Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) / Math.cos(pas / 2)) * 1.04;
  const rayon = interpolate(p, [0, 1], [rayonDepart, rayonFinal]);
  const origine = (rotation * p * Math.PI) / 180 - Math.PI / 2;
  const lointain = Math.hypot(width, height) * 2.5;
  const sommets = Array.from({ length: lames }, (_, k) => avancer({ x: cx, y: cy }, origine + k * pas, rayon));
  const directions = Array.from({ length: lames }, (_, k) => origine + k * pas + pas / 2 + Math.PI / 2);
  const ouvert = p >= 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: `${interpolate(p, [0, 1], [1.12, 1], { ...bloque, easing: courbes.entree })}` }}>
        {children}
      </AbsoluteFill>
      {ouvert ? null : (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 0 40px ${alpha("#000000", 0.85)})` }}>
          {sommets.map((_, k) => {
            const a = sommets[(k + 1) % lames];
            const d = sommets[(k + 2) % lames];
            const b = avancer(a, directions[k], lointain);
            const c = avancer(d, directions[(k + 1) % lames], lointain);
            const eclairage = 0.5 + 0.5 * Math.cos(directions[k] - LUMIERE);
            return (
              <g key={k}>
                <path
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`}
                  fill={interpolateColors(eclairage, [0, 1], ["#0F0E0E", "#2B2929"])}
                  stroke={interpolateColors(eclairage, [0, 1], ["#0F0E0E", "#2B2929"])}
                  strokeWidth={1}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={alpha(couleurs.texte, 0.14)} strokeWidth={1.5} />
              </g>
            );
          })}
          <defs>
            <radialGradient id={ombre} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={rayon + PROFONDEUR}>
              <stop offset={rayon / (rayon + PROFONDEUR)} stopColor="#000000" stopOpacity={0.45} />
              <stop offset={1} stopColor="#000000" stopOpacity={0} />
            </radialGradient>
          </defs>
          <path
            d={`M 0 0 H ${width} V ${height} H 0 Z M ${sommets.map((s) => `${s.x} ${s.y}`).join(" L ")} Z`}
            fill={`url(#${ombre})`}
            fillRule="evenodd"
          />
          <polygon
            points={sommets.map((s) => `${s.x},${s.y}`).join(" ")}
            fill="none"
            stroke={alpha(couleurs.texte, 0.3)}
            strokeWidth={1.5}
            opacity={interpolate(p, [0, 0.05], [0, 1], bloque)}
          />
        </svg>
      )}
    </AbsoluteFill>
  );
};
