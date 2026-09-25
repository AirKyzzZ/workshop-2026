import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { CadreHud } from "../../composants/charte/cadre-hud";
import { alpha, avance, brouiller } from "../../composants/charte/commun";
import { Grain, Vignette } from "../../composants/charte/plateau";
import { valeurs } from "../../donnees";

export const COUCHES_AVENIR = ["LE TON", "LE SENS", "LES SCHÉMAS", "L'INFECTION", "LE FEU"];

export type VueAvenirProps = {
  couche?: number;
  retrait?: number;
  debutCadre?: number;
  children?: React.ReactNode;
};

export const ChampAvenir: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: couleurs.fond,
        backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 42%, ${couleurs.panneau} 0%, ${couleurs.fond} 75%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${alpha(couleurs.texte, 0.1)} 1.2px, transparent 1.6px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `${(frame * 0.25) % 48}px ${(frame * 0.12) % 48}px`,
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, black 20%, transparent 80%)",
        }}
      />
      <Vignette force={0.55} />
      <Grain opacite={0.06} />
    </AbsoluteFill>
  );
};

export const VueAvenir: React.FC<VueAvenirProps> = ({ couche, retrait = 56, debutCadre = -60, children }) => {
  const frame = useCurrentFrame();
  const titre = couche === undefined ? null : COUCHES_AVENIR[couche - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <CadreHud etiquette={`${valeurs.vaisseau} · AN ${valeurs.annee}`} debut={debutCadre} retrait={retrait}>
        <ChampAvenir />
      </CadreHud>
      {titre && couche !== undefined ? (
        <div
          style={{
            position: "absolute",
            top: 86,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 18,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            lineHeight: 1,
            letterSpacing: "0.16em",
            whiteSpace: "pre",
          }}
        >
          <span style={{ color: couleurs.texte }}>{String(couche).padStart(2, "0")}</span>
          <span style={{ color: couleurs.texteFaible }}>{`/ ${String(COUCHES_AVENIR.length).padStart(2, "0")}`}</span>
          <span style={{ color: couleurs.nominal }}>{brouiller(titre, avance(frame, 2, 16), frame, titre)}</span>
        </div>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};
