import type React from "react";
import { Fragment } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, bloque } from "./commun";

export type SousTitresProps = {
  texte: string;
  duree: number;
  debut?: number;
  tenue?: number;
  taille?: number;
  largeurMax?: number;
  bas?: number;
};

const APPARITION_MOT = 6;

const decouperMots = (texte: string) =>
  texte
    .trim()
    .split(/ +/)
    .reduce<string[]>((mots, brut) => {
      const precedent = mots[mots.length - 1];
      if (precedent !== undefined && (/^[?!:;»%]+$/.test(brut) || precedent.endsWith("«"))) {
        return [...mots.slice(0, -1), `${precedent}\u00a0${brut}`];
      }
      return [...mots, brut];
    }, []);

export const SousTitres: React.FC<SousTitresProps> = ({
  texte,
  duree,
  debut = 0,
  tenue,
  taille = 42,
  largeurMax = 1480,
  bas = 120,
}) => {
  const frame = useCurrentFrame();
  const mots = decouperMots(texte);
  const poids = mots.map((mot) => [...mot].length + 2);
  const total = poids.reduce((somme, p) => somme + p, 0);
  const departs = poids.map((_, i) => debut + (duree * poids.slice(0, i).reduce((s, p) => s + p, 0)) / total);
  const sortie = tenue === undefined ? 1 : 1 - avance(frame, debut + duree + tenue, 8);
  const voile = Math.min(avance(frame, debut - 2, 10), sortie);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: bas, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: bas - taille * 1.6,
          width: largeurMax + taille * 6,
          height: taille * 6.4,
          translate: "-50% 0",
          opacity: voile,
          background: `radial-gradient(closest-side, ${alpha(couleurs.fond, 0.82)} 0%, ${alpha(couleurs.fond, 0.6)} 55%, ${alpha(couleurs.fond, 0)} 100%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: largeurMax,
          opacity: sortie,
          textAlign: "center",
          textWrap: "balance",
          fontFamily: polices.interface,
          fontWeight: 600,
          fontSize: taille,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          color: couleurs.blanc,
          textShadow: `0 2px 18px ${alpha(couleurs.fond, 0.9)}, 0 0 3px ${alpha(couleurs.fond, 0.9)}`,
        }}
      >
        {mots.map((mot, i) => {
          const p = avance(frame, departs[i], APPARITION_MOT);
          return (
            <Fragment key={`${i}-${mot}`}>
              {i > 0 ? " " : null}
              <span
                style={{
                  display: "inline-block",
                  opacity: p,
                  translate: `0 ${interpolate(p, [0, 1], [10, 0], bloque)}px`,
                }}
              >
                {mot}
              </span>
            </Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
