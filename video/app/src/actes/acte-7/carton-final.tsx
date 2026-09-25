import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { avance, bloque, courbes } from "../../composants/charte/commun";
import { MarqueAtria } from "../../composants/charte/marque-atria";
import { FondScene } from "../../composants/charte/plateau";
import { TypoCinetique } from "../../composants/charte/typo-cinetique";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";

const THESE = 0;
const SORTIE_THESE = 80;
const MARQUE = 86;
const DUREE_MARQUE = 32;
const CREDITS = 110;
const PAS_CREDITS = 6;
const NOIR = 18;

const Credit: React.FC<{ i: number; frame: number; children: React.ReactNode; style: React.CSSProperties }> = ({ i, frame, children, style }) => {
  const p = avance(frame, CREDITS + i * PAS_CREDITS, 14);
  return <div style={{ ...style, opacity: p, translate: `0 ${(1 - p) * 14}px`, whiteSpace: "pre" }}>{children}</div>;
};

export const CartonFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("7.4");
  const noir = interpolate(frame, [duree - NOIR, duree - 10], [0, 1], { ...bloque, easing: courbes.bascule });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
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
            debut={THESE}
            decalage={6}
            duree={16}
            sortie={SORTIE_THESE}
          />
        </AbsoluteFill>
        <div style={{ position: "absolute", top: 140, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {frame >= MARQUE - 2 ? <MarqueAtria taille={200} debut={MARQUE} duree={DUREE_MARQUE} /> : null}
          <Credit
            i={0}
            frame={frame}
            style={{ marginTop: 58, fontFamily: polices.donnees, fontSize: 28, letterSpacing: "0.22em", color: couleurs.texteDoux }}
          >
            {`${valeurs.vaisseau} · ${valeurs.ecole} ${valeurs.anneeConcours} · ${valeurs.groupe}`}
          </Credit>
          <Credit
            i={1}
            frame={frame}
            style={{ marginTop: 26, fontFamily: polices.display, fontWeight: 600, fontSize: 68, lineHeight: 1, paddingTop: 8, letterSpacing: "0.04em", color: couleurs.texte }}
          >
            {valeurs.equipe.join(" · ")}
          </Credit>
          <Credit
            i={2}
            frame={frame}
            style={{ marginTop: 30, fontFamily: polices.donnees, fontSize: tailles.etiquette + 2, letterSpacing: "0.04em", color: couleurs.texteDoux }}
          >
            {valeurs.depot}
          </Credit>
        </div>
      </FondScene>
      <AbsoluteFill style={{ backgroundColor: "#000000", opacity: noir }} />
      <Sfx nom="whoosh" a={SORTIE_THESE - 2} volume={0.14} />
      <Sfx nom="impact-titre" a={MARQUE + 4} volume={(f) => interpolate(f, [0, duree - MARQUE - NOIR, duree - MARQUE - 6], [0.36, 0.3, 0], bloque)} />
      {valeurs.equipe.map((nom, i) => (
        <Sfx key={nom} nom="tic-point" a={CREDITS + i * PAS_CREDITS} volume={0.16} />
      ))}
    </AbsoluteFill>
  );
};
