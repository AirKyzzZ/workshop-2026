import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha } from "./commun";

export type PlanFacticeProps = {
  desature?: boolean;
  decalage?: number;
  agitation?: number;
  geste?: number;
  etiquette?: string;
  hautEtiquette?: number;
  coteEtiquette?: "gauche" | "droite";
};

type Point = { x: number; y: number };

const ECHELLE = 1.08;
const SILHOUETTES = [
  { x: 0.4 * 1920, y: 330 },
  { x: 0.58 * 1920, y: 354 },
];
const EPAULE = { x: 255, y: 205 };
const BRAS = 240;
const EPAISSEUR_BRAS = 58;
const ANGLE_BAISSE = 100;
const ANGLE_LEVE = -62;

const derive = (f: number) => -70 * (1 - Math.exp(-Math.max(0, f) / 1500));

const balancement = (indice: number, f: number, agitation: number): Point => ({
  x: agitation * (Math.sin(f / 9 + indice * 2) * 10 + (indice === 0 ? 1 : -1) * (0.5 + 0.5 * Math.sin(f / 23)) * 14),
  y: agitation * Math.sin(f / 6 + indice) * 3,
});

const versEcran = (p: Point, f: number): Point => ({
  x: 960 + (p.x - 960) * ECHELLE + derive(f),
  y: 540 + (p.y - 540) * ECHELLE,
});

export const positionTete = (indice: 0 | 1, f: number, agitation = 0) => {
  const s = SILHOUETTES[indice];
  const b = balancement(indice, f, agitation);
  const centre = versEcran({ x: s.x + 150 + b.x, y: s.y + 75 + b.y }, f);
  return { ...centre, largeur: 130 * ECHELLE, hauteur: 150 * ECHELLE };
};

const angleBras = (geste: number) => ANGLE_BAISSE + (ANGLE_LEVE - ANGLE_BAISSE) * geste;

export const positionMain = (f: number, geste = 1, agitation = 0): Point => {
  const s = SILHOUETTES[0];
  const b = balancement(0, f, agitation);
  const a = (angleBras(geste) * Math.PI) / 180;
  return versEcran({ x: s.x + EPAULE.x + b.x + Math.cos(a) * (BRAS - 10), y: s.y + EPAULE.y + b.y + Math.sin(a) * (BRAS - 10) }, f);
};

export const EtiquetteTournage: React.FC<{ texte: string; haut?: number; cote?: "gauche" | "droite" }> = ({
  texte,
  haut = 86,
  cote = "droite",
}) => (
  <div
    style={{
      position: "absolute",
      top: haut,
      left: cote === "gauche" ? 86 : undefined,
      right: cote === "droite" ? 86 : undefined,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "6px 14px",
      backgroundColor: alpha(couleurs.fond, 0.6),
      border: `1px dashed ${alpha(couleurs.attention, 0.45)}`,
      fontFamily: polices.donnees,
      fontSize: tailles.etiquette,
      lineHeight: 1.2,
      letterSpacing: "0.08em",
      color: couleurs.texteDoux,
      whiteSpace: "nowrap",
    }}
  >
    <div style={{ width: 10, height: 10, backgroundColor: couleurs.attention, opacity: 0.8 }} />
    {`PLAN À TOURNER · ${texte}`}
  </div>
);

export const PlanFactice: React.FC<PlanFacticeProps> = ({
  desature = false,
  decalage = 0,
  agitation = 0,
  geste = 0,
  etiquette,
  hautEtiquette,
  coteEtiquette,
}) => {
  const f = useCurrentFrame() + decalage;
  const epaule = { x: SILHOUETTES[0].x + EPAULE.x, y: SILHOUETTES[0].y + EPAULE.y };
  const b0 = balancement(0, f, agitation);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0C110E", overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: desature ? "saturate(0.35) brightness(0.8)" : undefined }}>
        <AbsoluteFill
          style={{
            scale: ECHELLE,
            translate: `${derive(f)}px 0`,
            background:
              "radial-gradient(ellipse 42% 38% at 24% 18%, #4F7355 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 80% 34%, #35553E 0%, transparent 72%), radial-gradient(ellipse 90% 45% at 50% 105%, #1E3024 0%, transparent 70%), linear-gradient(180deg, #17221B 0%, #0A0E0B 100%)",
          }}
        >
          {[0.1, 0.32, 0.68, 0.9].map((x) => (
            <div
              key={x}
              style={{
                position: "absolute",
                top: -40,
                left: `${x * 100}%`,
                width: 520,
                height: 260,
                translate: "-50% 0",
                background: "radial-gradient(ellipse closest-side, rgba(220, 240, 204, 0.32), transparent)",
              }}
            />
          ))}
          {[0.08, 0.2, 0.74, 0.86].map((x, i) => (
            <div
              key={x}
              style={{
                position: "absolute",
                top: 360 + (i % 2) * 60,
                left: `${x * 100}%`,
                width: 260,
                height: 420,
                borderRadius: "48% 52% 20% 20%",
                background: "radial-gradient(ellipse at 50% 30%, #3E6B45 0%, #1C3322 60%, transparent 75%)",
                filter: "blur(10px)",
                opacity: 0.9,
              }}
            />
          ))}
          <div style={{ position: "absolute", inset: 0, filter: "blur(5px)" }}>
            {SILHOUETTES.map((s, i) => {
              const b = balancement(i, f, agitation);
              return (
                <div key={s.x} style={{ position: "absolute", left: s.x, top: s.y, translate: `${b.x}px ${b.y}px` }}>
                  <div style={{ width: 130, height: 150, borderRadius: "50%", backgroundColor: "#0A0C0B", marginLeft: 85 }} />
                  <div style={{ width: 300, height: 700, marginTop: 14, borderRadius: "120px 120px 20px 20px", backgroundColor: "#0A0C0B" }} />
                </div>
              );
            })}
            {geste > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: epaule.x - EPAISSEUR_BRAS / 2,
                  top: epaule.y - EPAISSEUR_BRAS / 2,
                  width: BRAS + 110,
                  height: EPAISSEUR_BRAS,
                  translate: `${b0.x}px ${b0.y}px`,
                  rotate: `${angleBras(geste)}deg`,
                  transformOrigin: `${EPAISSEUR_BRAS / 2}px ${EPAISSEUR_BRAS / 2}px`,
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, width: BRAS, height: EPAISSEUR_BRAS, borderRadius: EPAISSEUR_BRAS / 2, backgroundColor: "#0A0C0B" }} />
                <div style={{ position: "absolute", left: BRAS - 52, top: -14, width: 86, height: 86, borderRadius: 30, backgroundColor: "#0A0C0B" }} />
                <div style={{ position: "absolute", left: BRAS + 20, top: 16, width: 84, height: 26, borderRadius: 13, backgroundColor: "#0A0C0B" }} />
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />
      </AbsoluteFill>
      {etiquette ? <EtiquetteTournage texte={etiquette} haut={hautEtiquette} cote={coteEtiquette} /> : null}
    </AbsoluteFill>
  );
};
