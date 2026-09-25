import type React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "./commun";

export type NomCapture = "bord" | "vaisseau" | "equipage" | "social" | "surete" | "journal";
export type ZoneCapture = { x: number; y: number; largeur: number; hauteur: number };

export type CaptureReelleProps = {
  capture: NomCapture;
  libelle: string;
  largeur: number;
  cible?: { x: number; y: number };
  zoom?: [number, number];
  debut?: number;
  duree: number;
  surbrillance?: ZoneCapture & { debut: number };
};

const FORMAT = 1800 / 2880;
const COINS = [
  [0, 0, 1, 1],
  [1, 0, -1, 1],
  [0, 1, 1, -1],
  [1, 1, -1, -1],
] as const;

export const CaptureReelle: React.FC<CaptureReelleProps> = ({
  capture,
  libelle,
  largeur,
  cible = { x: 0.5, y: 0.5 },
  zoom = [1, 1.18],
  debut = 0,
  duree,
  surbrillance,
}) => {
  const frame = useCurrentFrame();
  const hauteur = Math.round(largeur * FORMAT);
  const entree = avance(frame, debut, 22);
  const cadre = avance(frame, debut + 6, 20);
  const pSurbrillance = surbrillance ? avance(frame, surbrillance.debut, 14) : 0;

  return (
    <div style={{ position: "relative", width: largeur, opacity: interpolate(entree, [0, 0.3], [0, 1], bloque), translate: `0 ${(1 - entree) * 30}px` }}>
      <div
        style={{
          position: "relative",
          width: largeur,
          height: hauteur,
          overflow: "hidden",
          borderRadius: 4,
          outline: `1px solid ${alpha(couleurs.texte, 0.2)}`,
          boxShadow: `0 30px 80px ${alpha("#000000", 0.6)}`,
          clipPath: `inset(0 0 ${(1 - entree) * 100}% 0)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            scale: `${interpolate(frame, [debut, debut + duree], zoom, { ...bloque, easing: courbes.bascule })}`,
            transformOrigin: `${cible.x * 100}% ${cible.y * 100}%`,
          }}
        >
          <Img src={staticFile(`captures/${capture}.png`)} style={{ width: "100%", height: "100%", filter: "brightness(0.9) contrast(1.04)" }} />
          {surbrillance && pSurbrillance > 0 ? (
            <div
              style={{
                position: "absolute",
                left: `${surbrillance.x * 100}%`,
                top: `${surbrillance.y * 100}%`,
                width: `${surbrillance.largeur * 100}%`,
                height: `${surbrillance.hauteur * 100}%`,
                backgroundColor: alpha(couleurs.critique, 0.1 * pSurbrillance),
                outline: `2px solid ${alpha(couleurs.critique, pSurbrillance)}`,
                outlineOffset: 4,
                scale: `${interpolate(pSurbrillance, [0, 1], [1.06, 1])}`,
              }}
            />
          ) : null}
        </div>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 70%, ${alpha(couleurs.fond, 0.35)})` }} />
      </div>
      {COINS.map(([cx, cy, sx, sy]) => (
        <div
          key={`${cx}-${cy}`}
          style={{
            position: "absolute",
            left: cx * largeur - 14 * sx - (cx ? 28 : 0),
            top: cy * hauteur - 14 * sy - (cy ? 28 : 0),
            width: 28,
            height: 28,
            opacity: cadre,
            borderLeft: sx > 0 ? `2px solid ${couleurs.texte}` : undefined,
            borderRight: sx < 0 ? `2px solid ${couleurs.texte}` : undefined,
            borderTop: sy > 0 ? `2px solid ${couleurs.texte}` : undefined,
            borderBottom: sy < 0 ? `2px solid ${couleurs.texte}` : undefined,
            translate: `${-sx * (1 - cadre) * 16}px ${-sy * (1 - cadre) * 16}px`,
          }}
        />
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 26,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          opacity: cadre,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurs.nominal, boxShadow: `0 0 10px ${alpha(couleurs.nominal, 0.7)}` }} />
        {libelle}
      </div>
    </div>
  );
};
