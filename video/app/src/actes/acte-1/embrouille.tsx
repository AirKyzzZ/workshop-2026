import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, marge, polices } from "../../charte";
import { avance, bloque, courbes } from "../../composants/charte/commun";
import { EtiquetteTournage, PlanFactice } from "../../composants/charte/plan-factice";
import { Grain } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";

export const DEBUT_GESTE = 150;
export const ETIQUETTE_SERRE = "L'EMBROUILLE DANS LA SERRE";

export const PlanSerre: React.FC<{ lieu?: boolean }> = ({ lieu = true }) => {
  const frame = useCurrentFrame();
  const duree = framesDe("1.2");
  const geste = avance(frame, DEBUT_GESTE, 20, courbes.bascule);
  const lieuEntre = avance(frame, 24, 26);
  const lieuSort = avance(frame, duree - 26, 16, courbes.bascule);

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale: 1.04,
          translate: `${4 * Math.sin(frame / 13) + 2 * Math.sin(frame / 5.3)}px ${3 * Math.sin(frame / 11 + 1) + 1.5 * Math.sin(frame / 4.1)}px`,
          rotate: `${0.15 * Math.sin(frame / 17)}deg`,
        }}
      >
        <PlanFactice agitation={1} geste={geste} decalage={120} />
      </AbsoluteFill>
      <EtiquetteTournage texte={ETIQUETTE_SERRE} />
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

const RESTE_GRONDEMENT = 300 - framesDe("1.1");

export const Embrouille: React.FC = () => {
  return (
    <AbsoluteFill>
      <PlanSerre />
      <Sfx
        nom="grondement-vaisseau"
        a={0}
        decoupe={framesDe("1.1")}
        volume={(f) => interpolate(f, [0, RESTE_GRONDEMENT - 60, RESTE_GRONDEMENT - 2], [0.55, 0.45, 0], bloque)}
      />
      <Sfx nom="telemetrie-bip" a={26} volume={0.25} />
    </AbsoluteFill>
  );
};
