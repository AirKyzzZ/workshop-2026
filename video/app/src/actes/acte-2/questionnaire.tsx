import type React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe } from "../../donnees";
import { CoupeVaisseau } from "./coupe-vaisseau";
import { grilleEquipage } from "./equipage";

const DEBUT_FICHE = Math.round(framesDe("2.2") * 0.36);
const COCHE = Math.round(framesDe("2.2") * 0.68);

const Case: React.FC<{ libelle: string; coche?: number }> = ({ libelle, coche = 0 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <div style={{ position: "relative", width: 52, height: 52, borderRadius: 8, border: `2px solid ${couleurs.texteDoux}` }}>
      <svg width={72} height={72} viewBox="0 0 72 72" style={{ position: "absolute", left: -6, top: -18, overflow: "visible" }}>
        <path
          d="M 12 40 C 16 43 20 48 25 55 C 32 38 44 22 64 8"
          fill="none"
          stroke={couleurs.blanc}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - coche}
        />
      </svg>
    </div>
    <span style={{ fontFamily: polices.interface, fontSize: 46, color: couleurs.texte }}>{libelle}</span>
  </div>
);

export const Questionnaire: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("2.2");
  const fiche = avance(frame, DEBUT_FICHE, 12);
  const coche = avance(frame, COCHE, 10, courbes.bascule);
  const attenuation = interpolate(fiche, [0, 1], [1, 0.55], bloque);
  const sortie = avance(frame, duree - 8, 7, courbes.bascule);

  return (
    <FondScene>
      <AbsoluteFill style={{ opacity: 1 - sortie }}>
        <Derive duree={duree}>
          <CoupeVaisseau trace={1} interieur={0.35} />
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {grilleEquipage.map((p, i) => {
              const e = avance(frame, random(`apparition-${i}`) * 22, 8);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={7 * e}
                  fill={couleurs.traitClair}
                  opacity={(0.5 + 0.5 * e) * attenuation}
                />
              );
            })}
          </svg>
          <div
            style={{
              position: "absolute",
              left: 960 - 480,
              top: 494,
              width: 960,
              boxSizing: "border-box",
              padding: "44px 60px 48px",
              borderRadius: 16,
              backgroundColor: "#171616",
              border: `1px solid ${couleurs.trait}`,
              boxShadow: `0 40px 90px ${alpha("#000000", 0.55)}`,
              opacity: fiche,
              translate: `0 ${(1 - fiche) * 40}px`,
            }}
          >
            <div style={{ fontFamily: polices.interface, fontWeight: 600, fontSize: 48, lineHeight: 1.15, color: couleurs.texte, whiteSpace: "nowrap" }}>
              COMMENT VOUS SENTEZ-VOUS ?
            </div>
            <div style={{ height: 1, backgroundColor: couleurs.trait, margin: "30px 0 34px" }} />
            <div style={{ display: "flex", gap: 110 }}>
              <Case libelle="bien" coche={coche} />
              <Case libelle="mal" />
            </div>
          </div>
        </Derive>
      </AbsoluteFill>
      <Sfx nom="whoosh" a={DEBUT_FICHE - 4} volume={0.2} />
      <Sfx nom="tic-point" a={COCHE} volume={0.45} />
      <Sfx nom="tic-point" a={COCHE + 6} volume={0.35} />
    </FondScene>
  );
};
