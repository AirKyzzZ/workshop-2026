import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { TypoCinetique } from "../../composants/charte/typo-cinetique";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { grilleEquipage } from "./equipage";

const DUREE = framesDe("2.3");
const SORTIE_TEXTE = Math.round(DUREE * 0.48);
const DEBUT_POINTS = Math.round(DUREE * 0.5);
const REPERAGE = Math.round(DUREE * 0.62);
const BASCULE = Math.round(DUREE * 0.68);
const DECROCHE = Math.round(DUREE * 0.72);
const EQUIPIER = 137;

export const SansReleve: React.FC = () => {
  const frame = useCurrentFrame();
  const reperage = avance(frame, REPERAGE, 10);
  const bascule = avance(frame, BASCULE, 8);
  const chute = avance(frame, DECROCHE, 38, courbes.bascule);
  const cible = grilleEquipage[EQUIPIER];
  const y = cible.y + chute * 54;
  const pulsation = 0.5 + 0.5 * Math.sin(frame / 5);
  const sortie = avance(frame, DUREE - 8, 7, courbes.bascule);

  return (
    <FondScene>
      <Derive duree={DUREE}>
        <AbsoluteFill style={{ translate: "0 -30px" }}>
          <TypoCinetique
            surtitre="SI LOIN DE LA TERRE"
            lignes={[
              `${valeurs.distanceAl} ANNÉES-LUMIÈRE`,
              `${valeurs.releve} RELÈVE`,
              { texte: `${valeurs.psychiatres} PSYCHIATRE`, etat: "critique" },
            ]}
            taille={150}
            debut={0}
            decalage={10}
            duree={16}
            sortie={SORTIE_TEXTE}
          />
        </AbsoluteFill>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - sortie }}>
          {grilleEquipage.map((p, i) => {
            if (i === EQUIPIER) return null;
            const e = avance(frame, DEBUT_POINTS + (Math.abs(p.x - cible.x) + Math.abs(p.y - cible.y)) / 60, 8);
            return <circle key={i} cx={p.x} cy={p.y} r={6} fill={couleurs.traitClair} opacity={e * interpolate(reperage, [0, 1], [0.8, 0.45])} />;
          })}
          <circle
            cx={cible.x}
            cy={y}
            r={7}
            fill={interpolateColors(bascule, [0, 1], [couleurs.traitClair, couleurs.attention])}
            opacity={avance(frame, DEBUT_POINTS, 8) * interpolate(chute, [0, 1], [1, 0.55])}
            style={{ filter: bascule > 0 ? `drop-shadow(0 0 ${6 + 6 * pulsation}px ${alpha(couleurs.attention, 0.8)})` : undefined }}
          />
          <g opacity={reperage} style={{ scale: `${interpolate(reperage, [0, 1], [1.8, 1])}`, transformOrigin: `${cible.x}px ${y}px` }}>
            <circle cx={cible.x} cy={y} r={26} fill="none" stroke={couleurs.attention} strokeWidth={2} strokeDasharray="6 7" style={{ rotate: `${frame * 1.5}deg`, transformOrigin: `${cible.x}px ${y}px` }} />
            {[0, 90, 180, 270].map((a) => (
              <line
                key={a}
                x1={cible.x + Math.cos((a * Math.PI) / 180) * 34}
                y1={y + Math.sin((a * Math.PI) / 180) * 34}
                x2={cible.x + Math.cos((a * Math.PI) / 180) * 46}
                y2={y + Math.sin((a * Math.PI) / 180) * 46}
                stroke={couleurs.attention}
                strokeWidth={2}
              />
            ))}
          </g>
          <line
            x1={cible.x}
            y1={cible.y}
            x2={cible.x}
            y2={y}
            stroke={alpha(couleurs.attention, 0.5)}
            strokeWidth={1.5}
            strokeDasharray="3 5"
            opacity={interpolate(chute, [0, 0.1], [0, 1], bloque)}
          />
        </svg>
      </Derive>
      <Sfx nom="impact-titre" a={20} volume={(f) => interpolate(f, [0, 10, 70], [0.28, 0.28, 0], bloque)} duree={76} />
      <Sfx nom="verrouillage" a={REPERAGE} volume={0.3} />
      <Sfx nom="pulsation" a={BASCULE} volume={0.3} />
    </FondScene>
  );
};
