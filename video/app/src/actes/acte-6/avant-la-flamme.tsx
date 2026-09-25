import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { VueAvenir } from "./vue-avenir";

const PIECE = { x: 150, y: 196, largeur: 860, hauteur: 470 };
const FOYER = { x: 790, y: 470 };
const Y_LIGNE = 588;
const INTERRUPTEUR = 1470;
const CHAUFFE = 4;
const DUREE_CHAUFFE = 50;
const SUSPICION = 28;
const COUPURE = 66;
const COUPEE = 72;

const EQUIPEMENTS = [
  { x: 210, y: 300, l: 260, h: 110 },
  { x: 210, y: 470, l: 180, h: 150 },
  { x: FOYER.x - 90, y: FOYER.y - 110, l: 180, h: 200 },
  { x: 520, y: 540, l: 130, h: 80 },
];

export const AvantLaFlamme: React.FC = () => {
  const frame = useCurrentFrame();
  const chauffe = avance(frame, CHAUFFE, DUREE_CHAUFFE, courbes.bascule);
  const coupure = avance(frame, COUPURE, 10, courbes.bascule);
  const refroidi = avance(frame, COUPURE + 6, 60);
  const chaleur = chauffe * (1 - 0.45 * refroidi);
  const temperature = interpolate(chauffe, [0, 1], [valeurs.temperatureAmbiante, valeurs.temperatureSuspicion]);
  const pSuspicion = avance(frame, SUSPICION, 12);
  const pCoupee = avance(frame, COUPEE, 14);
  const eclair = interpolate(frame, [COUPURE, COUPURE + 2, COUPURE + 12], [0, 1, 0], bloque);
  const couleurChaleur = interpolateColors(chauffe, [0, 0.6, 1], [couleurs.texteDoux, couleurs.attention, couleurs.critique]);
  const alimentee = 1 - coupure;
  const couleurLigne = interpolateColors(alimentee, [0, 1], [couleurs.traitClair, couleurs.attention]);

  return (
    <VueAvenir couche={5}>
      <AbsoluteFill style={{ translate: "0 24px" }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="flamme-chaleur">
            <stop offset="0" stopColor={couleurs.critique} stopOpacity={0.55} />
            <stop offset="0.45" stopColor={couleurs.attention} stopOpacity={0.22} />
            <stop offset="1" stopColor={couleurs.attention} stopOpacity={0} />
          </radialGradient>
          <clipPath id="flamme-piece">
            <rect x={PIECE.x} y={PIECE.y} width={PIECE.largeur} height={PIECE.hauteur} />
          </clipPath>
        </defs>
        <rect x={PIECE.x} y={PIECE.y} width={PIECE.largeur} height={PIECE.hauteur} fill={alpha(couleurs.panneau, 0.85)} />
        <g clipPath="url(#flamme-piece)">
          <circle cx={FOYER.x} cy={FOYER.y} r={120 + 300 * chaleur} fill="url(#flamme-chaleur)" opacity={chaleur} />
          {[0, 1, 2].map((k) => {
            const onde = ((frame / 45 + k / 3) % 1 + 1) % 1;
            return (
              <ellipse key={k} cx={FOYER.x} cy={FOYER.y} rx={60 + onde * 320} ry={44 + onde * 230} fill="none" stroke={couleurChaleur} strokeWidth={1.5} strokeDasharray="4 8" opacity={(1 - onde) * 0.5 * chaleur} />
            );
          })}
        </g>
        {EQUIPEMENTS.map((q, i) => (
          <rect key={i} x={q.x} y={q.y} width={q.l} height={q.h} fill="none" stroke={i === 2 ? interpolateColors(chaleur, [0, 1], [couleurs.traitClair, couleurs.attention]) : couleurs.traitClair} strokeWidth={i === 2 ? 2 : 1.5} />
        ))}
        <rect x={PIECE.x} y={PIECE.y} width={PIECE.largeur} height={PIECE.hauteur} fill="none" stroke={interpolateColors(pSuspicion, [0, 1], [couleurs.traitClair, couleurs.attention])} strokeWidth={2} />
        <line x1={FOYER.x + 90} y1={Y_LIGNE} x2={PIECE.x + PIECE.largeur} y2={Y_LIGNE} stroke={couleurLigne} strokeWidth={3} />
        <line x1={PIECE.x + PIECE.largeur} y1={Y_LIGNE} x2={INTERRUPTEUR - 40} y2={Y_LIGNE} stroke={couleurLigne} strokeWidth={3} />
        <line x1={INTERRUPTEUR + 40} y1={Y_LIGNE} x2={1800} y2={Y_LIGNE} stroke={couleurs.attention} strokeWidth={3} />
        <circle cx={INTERRUPTEUR - 40} cy={Y_LIGNE} r={7} fill={couleurs.fond} stroke={couleurLigne} strokeWidth={3} />
        <circle cx={INTERRUPTEUR + 40} cy={Y_LIGNE} r={7} fill={couleurs.fond} stroke={couleurs.attention} strokeWidth={3} />
        <line
          x1={INTERRUPTEUR - 40}
          y1={Y_LIGNE}
          x2={INTERRUPTEUR - 40 + 80 * Math.cos((-32 * coupure * Math.PI) / 180)}
          y2={Y_LIGNE + 80 * Math.sin((-32 * coupure * Math.PI) / 180)}
          stroke={couleurs.texte}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {eclair > 0 ? <circle cx={INTERRUPTEUR + 40} cy={Y_LIGNE} r={10 + eclair * 26} fill={alpha(couleurs.blanc, 0.5 * eclair)} /> : null}
        {alimentee > 0 ? (
          <circle cx={interpolate((frame * 6) % 1000, [0, 1000], [1800, FOYER.x + 90])} cy={Y_LIGNE} r={5} fill={couleurs.attention} opacity={alimentee} />
        ) : null}
      </svg>
      <div style={{ position: "absolute", left: PIECE.x + 30, top: PIECE.y + 22, fontFamily: polices.display, fontWeight: 500, fontSize: 56, lineHeight: 1, paddingTop: 6, color: couleurs.texte }}>
        {valeurs.compartimentSuspicion}
      </div>
      <div style={{ position: "absolute", left: 1110, top: 206, width: 690, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "8px 18px",
            border: `1.5px solid ${couleurs.attention}`,
            backgroundColor: alpha(couleurs.attention, 0.1),
            fontFamily: polices.donnees,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: "0.14em",
            color: couleurs.attention,
            opacity: pSuspicion,
            translate: `${(1 - pSuspicion) * 16}px 0`,
          }}
        >
          <div style={{ width: 12, height: 12, backgroundColor: couleurs.attention, opacity: 0.55 + 0.45 * Math.cos(frame / 4) }} />
          SUSPICION
        </div>
        <div style={{ marginTop: 18, fontFamily: polices.display, fontWeight: 600, fontSize: 200, lineHeight: 1, paddingTop: 24, color: couleurChaleur, whiteSpace: "pre", opacity: pSuspicion }}>
          {`${Math.round(temperature)} °C`}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1110,
          top: Y_LIGNE + 40,
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: pCoupee,
          translate: `0 ${(1 - pCoupee) * 14}px`,
        }}
      >
        <svg width={40} height={40} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={18} fill="none" stroke={couleurs.nominal} strokeWidth={2} />
          <path d="M 11 21 L 17 27 L 29 14" fill="none" stroke={couleurs.nominal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pCoupee} />
        </svg>
        <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 64, lineHeight: 1, paddingTop: 8, color: couleurs.nominal }}>ALIMENTATION COUPÉE</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: INTERRUPTEUR - 60,
          top: Y_LIGNE - 86,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          opacity: avance(frame, 10, 12),
        }}
      >
        ALIMENTATION
      </div>
      </AbsoluteFill>
      <Sfx nom="telemetrie-bip" a={SUSPICION} volume={0.28} />
      <Sfx nom="clic-validation" a={COUPURE} volume={0.5} />
      <Sfx nom="verrouillage" a={COUPEE} volume={0.2} />
    </VueAvenir>
  );
};
