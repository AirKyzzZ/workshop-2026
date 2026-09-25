import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, random, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { avance, bloque, courbes } from "../../composants/charte/commun";
import { MarqueAtria } from "../../composants/charte/marque-atria";
import { FondScene } from "../../composants/charte/plateau";
import { TypoCinetique } from "../../composants/charte/typo-cinetique";
import { Sfx } from "../../composants/son";
import { framesDe } from "../../donnees";
import { grilleEquipage, usePointsMarque, type Point } from "./equipage";

export const MARQUE = { taille: 280, haut: 330 };

const DUREE = framesDe("2.4");
const SORTIE_THESE = Math.round(DUREE * 0.6);
const APPARITION = Math.round(DUREE * 0.58);
const ENVOL = Math.round(DUREE * 0.64);
const DUREE_ENVOL = 24;
const DEBUT_MARQUE = Math.round(DUREE * 0.76);

const trierParX = (points: Point[]) => points.map((p, i) => ({ ...p, i })).sort((a, b) => a.x - b.x || a.y - b.y);

export const MarqueCentree: React.FC<{ debut: number; duree?: number }> = ({ debut, duree = 30 }) => (
  <div style={{ position: "absolute", top: MARQUE.haut, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <MarqueAtria taille={MARQUE.taille} debut={debut} duree={duree} />
  </div>
);

export const These: React.FC = () => {
  const frame = useCurrentFrame();
  const cibles = usePointsMarque(MARQUE.taille, MARQUE.haut);
  if (!cibles) return null;

  const depart = trierParX(grilleEquipage);
  const arrivee = trierParX(cibles);
  const fonduPoints = 1 - avance(frame, DEBUT_MARQUE + 6, 12);

  return (
    <FondScene>
      <AbsoluteFill style={{ translate: "0 -40px" }}>
        <TypoCinetique
          lignes={[
            { texte: "LE SYSTÈME DE SURVIE", doux: true },
            { texte: "LE PLUS FRAGILE D'UN VAISSEAU,", doux: true },
            "C'EST SON ÉQUIPAGE.",
          ]}
          taille={128}
          alignement="centre"
          debut={0}
          decalage={6}
          duree={16}
          sortie={SORTIE_THESE}
        />
      </AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {depart.map((d, k) => {
          const a = arrivee[k];
          const retard = random(`envol-${d.i}`) * 10;
          const p = avance(frame, ENVOL + retard, DUREE_ENVOL, courbes.bascule);
          const e = avance(frame, APPARITION + random(`apparait-${d.i}`) * 8, 8);
          const x = interpolate(p, [0, 1], [d.x, a.x]);
          const y = interpolate(p, [0, 1], [d.y, a.y]) - Math.sin(p * Math.PI) * 40;
          return (
            <circle
              key={d.i}
              cx={x}
              cy={y}
              r={interpolate(p, [0, 1], [6, 5])}
              fill={interpolateColors(p, [0, 1], [couleurs.traitClair, couleurs.blanc])}
              opacity={e * fonduPoints}
            />
          );
        })}
      </svg>
      <MarqueCentree debut={DEBUT_MARQUE} />
      <Sfx nom="whoosh" a={ENVOL - 4} volume={0.35} />
      <Sfx nom="impact-titre" a={DEBUT_MARQUE + 4} volume={(f) => interpolate(f, [0, DUREE - DEBUT_MARQUE - 20, DUREE - DEBUT_MARQUE - 4], [0.5, 0.5, 0], bloque)} />
    </FondScene>
  );
};
