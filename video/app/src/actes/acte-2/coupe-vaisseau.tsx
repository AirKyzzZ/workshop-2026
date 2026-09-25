import type React from "react";
import { couleurs } from "../../charte";
import { alpha } from "../../composants/charte/commun";
import { COQUE } from "../../composants/metier/plan-vaisseau";

export const COUPE = { x: 960, y: 470, echelle: 0.72 };
const CENTRE_COQUE = { x: 961, y: 540 };
const CLOISONS = [710, 1210];
const PONTS = [350, 730];

export const versCoupe = (x: number) => COUPE.x + (x - CENTRE_COQUE.x) * COUPE.echelle;
export const BAIES = [440, 960, 1481].map(versCoupe);

export const CoupeVaisseau: React.FC<{ trace: number; interieur?: number }> = ({ trace, interieur = 1 }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <g transform={`translate(${COUPE.x} ${COUPE.y}) scale(${COUPE.echelle}) translate(${-CENTRE_COQUE.x} ${-CENTRE_COQUE.y})`}>
      <path
        d={COQUE}
        fill={alpha(couleurs.panneau, 0.35 * trace)}
        stroke={alpha(couleurs.texte, 0.55)}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - trace}
      />
      <path
        d={COQUE}
        fill="none"
        stroke={alpha(couleurs.texte, 0.12)}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        transform="translate(961 540) scale(0.975 0.955) translate(-961 -540)"
        opacity={trace}
      />
      <g opacity={trace * interieur} stroke={alpha(couleurs.texte, 0.16)} strokeWidth={1} vectorEffect="non-scaling-stroke">
        {CLOISONS.map((x) => (
          <line key={x} x1={x} y1={182} x2={x} y2={898} strokeDasharray="6 8" vectorEffect="non-scaling-stroke" />
        ))}
        {PONTS.map((y) => (
          <line key={y} x1={200} y1={y} x2={1640} y2={y} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </g>
  </svg>
);
