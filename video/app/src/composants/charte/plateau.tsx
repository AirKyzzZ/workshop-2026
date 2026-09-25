import type React from "react";
import { useId } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, bloque } from "./commun";

export const Grain: React.FC<{ opacite?: number }> = ({ opacite = 0.06 }) => {
  const frame = useCurrentFrame();
  const filtre = useId().replace(/[^\w-]/g, "");
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: opacite, mixBlendMode: "screen" }}>
      <svg width="100%" height="100%">
        <filter id={filtre}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 9} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filtre})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ force?: number }> = ({ force = 0.6 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse 78% 72% at 50% 50%, transparent 55%, ${alpha("#000000", force)} 100%)`,
    }}
  />
);

export const Derive: React.FC<{ children: React.ReactNode; duree: number; amplitude?: number; sens?: 1 | -1 }> = ({
  children,
  duree,
  amplitude = 0.025,
  sens = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        scale: `${interpolate(frame, [0, duree], [1, 1 + amplitude], bloque)}`,
        translate: `${interpolate(frame, [0, duree], [0, sens * -14], bloque)}px ${interpolate(frame, [0, duree], [0, -6], bloque)}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const FondScene: React.FC<{ children?: React.ReactNode; lueur?: string }> = ({ children, lueur = couleurs.panneau }) => (
  <AbsoluteFill
    style={{
      backgroundColor: couleurs.fond,
      backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 42%, ${lueur} 0%, ${couleurs.fond} 75%)`,
    }}
  >
    {children}
    <Vignette force={0.5} />
    <Grain />
  </AbsoluteFill>
);
