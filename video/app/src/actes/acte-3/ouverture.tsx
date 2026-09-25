import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { Balayage } from "../../composants/charte/balayage";
import { avance, bloque, courbes } from "../../composants/charte/commun";
import { OuvertureObjectif } from "../../composants/charte/ouverture-objectif";
import { positionTete } from "../../composants/charte/plan-factice";
import { Sfx } from "../../composants/son";
import { MARQUE, MarqueCentree } from "../acte-2/these";
import { decalageActe3 } from "./commun";
import { Visee } from "./visee";
import { VueAtria } from "./vue-atria";

const OUVERTURE = 24;
const DUREE_OUVERTURE = 42;
const CADRE = OUVERTURE + 26;
const SCAN = OUVERTURE + 40;
const PRESENCES = SCAN + 44;
const CENTRE_MARQUE = { x: 0.5, y: (MARQUE.haut + MARQUE.taille / 2) / 1080 };

export const Ouverture: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame + decalageActe3("3.1");
  const marque = avance(frame, OUVERTURE - 6, 22, courbes.bascule);

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <OuvertureObjectif debut={OUVERTURE} duree={DUREE_OUVERTURE} centre={CENTRE_MARQUE}>
        <VueAtria id="3.1" debutCadre={CADRE} balayage={false}>
          <Balayage debut={SCAN} duree={40} libelle="ANALYSE" />
          {([0, 1] as const).map((i) => {
            const t = positionTete(i, f);
            return (
              <Visee
                key={i}
                x={t.x}
                y={t.y + 150}
                largeur={330}
                hauteur={540}
                coin={34}
                couleur={couleurs.texte}
                p={avance(frame, PRESENCES + i * 6, 18)}
              />
            );
          })}
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
      <Sfx nom="whoosh" a={OUVERTURE - 4} volume={0.35} />
      <Sfx nom="balayage-scan" a={SCAN} volume={0.4} />
      <Sfx nom="verrouillage" a={PRESENCES + 8} volume={0.22} />
    </AbsoluteFill>
  );
};
