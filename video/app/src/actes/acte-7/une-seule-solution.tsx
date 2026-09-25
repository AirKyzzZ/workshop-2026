import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { TypoCinetique } from "../../composants/charte/typo-cinetique";
import { Sfx } from "../../composants/son";
import { framesDe } from "../../donnees";

const QUESTION = 0;
const SORTIE_QUESTION = 58;
const PREMIERE_LIGNE = 66;
const PAS = 12;

const LIGNES = ["TOUT EN DÉPEND", "ELLE VOIT VENIR", "ELLE TIENT SANS LA TERRE"];

export const UneSeuleSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("7.3");

  return (
    <FondScene>
      <Derive duree={duree} amplitude={0.012}>
        <AbsoluteFill style={{ translate: "0 -50px" }}>
          <TypoCinetique
            lignes={["SI L'ESA NE DEVAIT EMBARQUER", { texte: "QU'UNE SEULE SOLUTION", etat: "nominal" }]}
            taille={120}
            alignement="centre"
            debut={QUESTION}
            decalage={8}
            sortie={SORTIE_QUESTION}
          />
        </AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 200,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {LIGNES.map((ligne, i) => {
              const debut = PREMIERE_LIGNE + i * PAS;
              const entree = avance(frame, debut, 14);
              const filet = avance(frame, debut + 4, 16, courbes.bascule);
              return (
                <div key={ligne} style={{ position: "relative", display: "flex", alignItems: "center", gap: 40, height: 150 }}>
                  <div
                    style={{
                      width: 64,
                      fontFamily: polices.donnees,
                      fontSize: 28,
                      letterSpacing: "0.08em",
                      color: couleurs.nominal,
                      opacity: entree,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ overflow: "hidden", paddingTop: 14 }}>
                    <div
                      style={{
                        fontFamily: polices.display,
                        fontWeight: 600,
                        fontSize: 116,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        color: couleurs.texte,
                        translate: `0 ${(1 - entree) * 108}%`,
                      }}
                    >
                      {ligne}
                    </div>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 1,
                      backgroundColor: alpha(couleurs.texte, 0.16),
                      scale: `${filet} 1`,
                      transformOrigin: "left",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Derive>
      <Sfx nom="impact-titre" a={QUESTION + 2} volume={(f) => interpolate(f, [0, 10, 100], [0.3, 0.3, 0], bloque)} duree={110} />
      <Sfx nom="whoosh" a={SORTIE_QUESTION} volume={0.16} />
      {LIGNES.map((ligne, i) => (
        <Sfx key={ligne} nom="tic-point" a={PREMIERE_LIGNE + i * PAS} volume={0.32} />
      ))}
    </FondScene>
  );
};
