import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs, marge, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "./commun";

export type DirectionBalayage = "bas" | "haut" | "droite" | "gauche";

export type BalayageProps = {
  debut?: number;
  duree?: number;
  direction?: DirectionBalayage;
  couleur?: string;
  libelle?: string;
  trainee?: number;
  children?: React.ReactNode;
};

const SENS_DEGRADE: Record<DirectionBalayage, string> = {
  bas: "to bottom",
  haut: "to top",
  droite: "to right",
  gauche: "to left",
};

export const Balayage: React.FC<BalayageProps> = ({
  debut = 0,
  duree = 30,
  direction = "bas",
  couleur = couleurs.nominal,
  libelle,
  trainee = 320,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = avance(frame, debut, duree, courbes.bascule);
  const vertical = direction === "bas" || direction === "haut";
  const inverse = direction === "haut" || direction === "gauche";
  const etendue = vertical ? height : width;
  const parcouru = p * etendue;
  const position = inverse ? etendue - parcouru : parcouru;
  const reste = etendue - parcouru;
  const visible = interpolate(p, [0, 0.03, 0.94, 1], [0, 1, 1, 0], bloque);
  const decoupe = {
    bas: `inset(0 0 ${reste}px 0)`,
    haut: `inset(${reste}px 0 0 0)`,
    droite: `inset(0 ${reste}px 0 0)`,
    gauche: `inset(0 0 0 ${reste}px)`,
  }[direction];
  const debutTrainee = inverse ? position : position - trainee;
  const grille = `repeating-linear-gradient(0deg, ${alpha(couleur, 0.16)} 0px, ${alpha(couleur, 0.16)} 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, ${alpha(couleur, 0.16)} 0px, ${alpha(couleur, 0.16)} 1px, transparent 1px, transparent 48px)`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {children ? <AbsoluteFill style={{ clipPath: p >= 1 ? undefined : decoupe }}>{children}</AbsoluteFill> : null}
      <div
        style={{
          position: "absolute",
          top: vertical ? debutTrainee : 0,
          left: vertical ? 0 : debutTrainee,
          width: vertical ? "100%" : trainee,
          height: vertical ? trainee : "100%",
          opacity: visible,
          background: `linear-gradient(${SENS_DEGRADE[direction]}, transparent, ${alpha(couleur, 0.22)})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: vertical ? debutTrainee : 0,
          left: vertical ? 0 : debutTrainee,
          width: vertical ? "100%" : trainee,
          height: vertical ? trainee : "100%",
          opacity: visible,
          backgroundImage: grille,
          backgroundPosition: "center",
          maskImage: `linear-gradient(${SENS_DEGRADE[direction]}, transparent, black)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: vertical ? position : 0,
          left: vertical ? 0 : position,
          width: vertical ? "100%" : 2,
          height: vertical ? 2 : "100%",
          translate: vertical ? "0 -50%" : "-50% 0",
          opacity: visible,
          backgroundColor: couleurs.blanc,
          boxShadow: `0 0 12px 2px ${alpha(couleur, 0.9)}, 0 0 48px 8px ${alpha(couleur, 0.35)}`,
        }}
      />
      {libelle ? (
        <div
          style={{
            position: "absolute",
            top: vertical ? position + (inverse ? 18 : -18) : marge,
            left: vertical ? undefined : position + (inverse ? 20 : -20),
            right: vertical ? marge : undefined,
            translate: vertical ? (inverse ? "0 0" : "0 -100%") : inverse ? "0 0" : "-100% 0",
            opacity: visible,
            display: "flex",
            gap: 16,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            lineHeight: 1,
            letterSpacing: "0.12em",
            color: couleur,
            whiteSpace: "nowrap",
          }}
        >
          <span>{libelle}</span>
          <span style={{ color: couleurs.texte }}>{`${String(Math.round(p * 100)).padStart(3, "\u00a0")}\u00a0%`}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
