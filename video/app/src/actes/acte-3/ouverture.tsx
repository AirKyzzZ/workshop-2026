import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { Balayage } from "../../composants/charte/balayage";
import { avance, bloque, brouiller, courbes } from "../../composants/charte/commun";
import { OuvertureObjectif } from "../../composants/charte/ouverture-objectif";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { MARQUE, MarqueCentree } from "../acte-2/these";
import { VueAtria } from "./vue-atria";

const OUVERTURE = 2;
const DUREE_OUVERTURE = 26;
const CADRE = 10;
const SCAN = 24;
const DUREE_SCAN = 30;
const PRESENCES = SCAN + DUREE_SCAN;
const CENTRE_MARQUE = { x: 0.5, y: (MARQUE.haut + MARQUE.taille / 2) / 1080 };

export const Ouverture: React.FC = () => {
  const frame = useCurrentFrame();
  const marque = avance(frame, OUVERTURE - 2, 16, courbes.bascule);
  const presences = avance(frame, PRESENCES, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <OuvertureObjectif debut={OUVERTURE} duree={DUREE_OUVERTURE} centre={CENTRE_MARQUE}>
        <VueAtria id="3.1" debutCadre={CADRE} balayage={false} serre={{ vitesse: 0.9 }}>
          <Balayage debut={SCAN} duree={DUREE_SCAN} libelle="ANALYSE" />
          <div
            style={{
              position: "absolute",
              top: 132,
              right: 86,
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              opacity: presences,
              translate: `0 ${(1 - presences) * 10}px`,
              fontFamily: polices.donnees,
              fontSize: tailles.etiquette,
              letterSpacing: "0.08em",
              whiteSpace: "pre",
            }}
          >
            <span style={{ color: couleurs.texteDoux }}>PRÉSENCES</span>
            <span style={{ color: couleurs.nominal, fontSize: 40 }}>{brouiller(String(valeurs.presencesSerre).padStart(2, "0"), presences, frame, "presences")}</span>
          </div>
        </VueAtria>
      </OuvertureObjectif>
      <AbsoluteFill
        style={{
          opacity: 1 - marque,
          scale: `${interpolate(marque, [0, 1], [1, 1.7], bloque)}`,
          transformOrigin: `50% ${CENTRE_MARQUE.y * 100}%`,
          filter: `blur(${marque * 6}px)`,
        }}
      >
        <MarqueCentree debut={-120} />
      </AbsoluteFill>
      <Sfx nom="whoosh" a={OUVERTURE} volume={0.35} />
      <Sfx nom="balayage-scan" a={SCAN} volume={0.4} />
      <Sfx nom="verrouillage" a={PRESENCES} volume={0.22} />
    </AbsoluteFill>
  );
};
