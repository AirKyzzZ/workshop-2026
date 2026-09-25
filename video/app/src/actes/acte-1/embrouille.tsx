import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, marge, polices } from "../../charte";
import { avance, bloque, courbes } from "../../composants/charte/commun";
import { Grain } from "../../composants/charte/plateau";
import { Rush } from "../../composants/charte/rush";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";

const ENTREE_LIEU = 4;

export const PlanSerre: React.FC<{ lieu?: boolean }> = ({ lieu = true }) => {
  const frame = useCurrentFrame();
  const duree = framesDe("1.2");
  const lieuEntre = avance(frame, ENTREE_LIEU, 12);
  const lieuSort = avance(frame, duree - 16, 10, courbes.bascule);

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: `${interpolate(frame, [0, duree], [1.02, 1.08], bloque)}` }}>
        <Rush nom="embrouille-serre" etalonnage="saturate(0.72) contrast(1.1) brightness(0.62)" vignette={0.6} />
      </AbsoluteFill>
      {lieu ? (
        <div
          style={{
            position: "absolute",
            left: marge,
            bottom: marge + 24,
            display: "flex",
            alignItems: "center",
            gap: 22,
            opacity: 1 - lieuSort,
          }}
        >
          <div style={{ width: 48, height: 2, backgroundColor: couleurs.texte, scale: `${lieuEntre} 1`, transformOrigin: "left" }} />
          <div
            style={{
              fontFamily: polices.donnees,
              fontSize: 30,
              letterSpacing: "0.18em",
              color: couleurs.texte,
              textShadow: `0 2px 16px ${couleurs.fond}`,
              clipPath: `inset(-8px ${(1 - lieuEntre) * 100}% -8px -8px)`,
            }}
          >
            {`${valeurs.compartimentScene} · COMPARTIMENT ${valeurs.numeroCompartiment}`}
          </div>
        </div>
      ) : null}
      <Grain opacite={0.08} />
    </AbsoluteFill>
  );
};

const FIN_GRONDEMENT = framesDe("1.2");

export const Embrouille: React.FC = () => {
  return (
    <AbsoluteFill>
      <PlanSerre />
      <Sfx
        nom="grondement-vaisseau"
        a={0}
        decoupe={framesDe("1.1")}
        volume={(f) => interpolate(f, [0, FIN_GRONDEMENT - 30, FIN_GRONDEMENT - 2], [0.55, 0.45, 0], bloque)}
      />
      <Sfx nom="telemetrie-bip" a={ENTREE_LIEU} volume={0.25} />
    </AbsoluteFill>
  );
};
