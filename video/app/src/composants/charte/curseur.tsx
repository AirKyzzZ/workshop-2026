import type React from "react";
import { interpolate } from "remotion";
import { couleurs } from "../../charte";
import { alpha, bloque } from "./commun";

export type ImageCleCurseur = { frame: number; x: number; y: number };

export const positionCurseur = (cles: ImageCleCurseur[], frame: number, courbe: (t: number) => number) => {
  const suivante = cles.findIndex((c) => c.frame > frame);
  if (suivante === -1) return cles[cles.length - 1];
  if (suivante === 0) return cles[0];
  const a = cles[suivante - 1];
  const b = cles[suivante];
  const t = courbe(interpolate(frame, [a.frame, b.frame], [0, 1], bloque));
  return { frame, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

export const Curseur: React.FC<{ x: number; y: number; appui?: number; opacite?: number }> = ({ x, y, appui = 0, opacite = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, opacity: opacite, pointerEvents: "none" }}>
    {appui > 0 ? (
      <div
        style={{
          position: "absolute",
          left: -34,
          top: -34,
          width: 68,
          height: 68,
          borderRadius: 34,
          border: `2px solid ${alpha(couleurs.texte, 1 - appui)}`,
          scale: `${0.4 + appui * 0.8}`,
        }}
      />
    ) : null}
    <svg width={44} height={52} viewBox="0 0 22 26" style={{ scale: `${1 - Math.sin(appui * Math.PI) * 0.12}`, transformOrigin: "0 0", filter: `drop-shadow(0 4px 10px ${alpha("#000000", 0.6)})` }}>
      <path d="M1 1 L1 20 L6 15.5 L9.5 23.5 L13 22 L9.6 14.2 L16 14 Z" fill={couleurs.blanc} stroke={couleurs.fond} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  </div>
);
