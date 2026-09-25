import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { TypoCinetique } from "../../composants/charte/typo-cinetique";
import { Sfx } from "../../composants/son";
import { framesDe } from "../../donnees";
import { VueAvenir } from "./vue-avenir";

const TITRE = 6;
const ELARGISSEMENT = 30;
const DUREE_ELARGISSEMENT = 44;

export const VoitVenir: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("6.1");
  const retrait = interpolate(frame, [ELARGISSEMENT, ELARGISSEMENT + DUREE_ELARGISSEMENT], [300, 56], { ...bloque, easing: courbes.bascule });
  const lueur = avance(frame, ELARGISSEMENT, DUREE_ELARGISSEMENT, courbes.bascule);

  return (
    <VueAvenir retrait={retrait} debutCadre={0}>
      <AbsoluteFill
        style={{
          opacity: interpolate(lueur, [0, 0.5, 1], [0, 0.6, 0.25]),
          background: `radial-gradient(ellipse 50% 40% at 50% 50%, ${alpha(couleurs.nominal, 0.07)} 0%, transparent 70%)`,
        }}
      />
      <TypoCinetique
        lignes={["CE QU'ATRIA", { texte: "VOIT VENIR", etat: "nominal" }]}
        taille={150}
        alignement="centre"
        debut={TITRE}
        decalage={8}
        sortie={duree - 26}
      />
      <Sfx nom="impact-titre" a={TITRE + 2} volume={(f) => interpolate(f, [0, 10, 90], [0.3, 0.3, 0], bloque)} duree={100} />
      <Sfx nom="whoosh" a={ELARGISSEMENT} volume={0.22} />
    </VueAvenir>
  );
};
