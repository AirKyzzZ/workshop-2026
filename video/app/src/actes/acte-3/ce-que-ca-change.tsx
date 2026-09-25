import type React from "react";
import { useCurrentFrame } from "remotion";
import { avance } from "../../composants/charte/commun";
import { Jauge } from "../../composants/charte/jauge";
import { GrapheSocial } from "../../composants/metier/graphe-social";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { Panneau } from "./visee";
import { VueAtria } from "./vue-atria";

const DEBUT_JAUGE = 10;
const VARIATION = 30;
const DUREE_VARIATION = 54;
const DEBUT_GRAPHE = 46;
const BASCULE = 140;

const AUTEUR = valeurs.auteur.toLowerCase();
const TEMOIN = valeurs.temoin.toLowerCase();

export const CeQueCaChange: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <VueAtria id="3.7" couche={6} voile={0.55}>
      <Panneau x={110} y={206} largeur={900} p={avance(frame, DEBUT_JAUGE - 6, 18)}>
        <Jauge
          label={`CONDUITE · ${valeurs.auteur}`}
          depuis={valeurs.conduiteAvant}
          vers={valeurs.conduiteApres}
          seuil={valeurs.seuilConduite}
          note="conduite = 1 − Σ gravité × décroissance"
          debut={DEBUT_JAUGE}
          debutVariation={VARIATION}
          duree={DUREE_VARIATION}
          largeur={844}
        />
      </Panneau>
      <Panneau x={1050} y={206} largeur={770} p={avance(frame, DEBUT_GRAPHE - 6, 18)}>
        <GrapheSocial
          largeur={700}
          hauteur={430}
          debut={DEBUT_GRAPHE}
          intervalle={3}
          noeuds={[
            { id: AUTEUR, nom: AUTEUR, x: 0.28, y: 0.44, allumage: { frame: BASCULE, niveau: "critique" } },
            { id: TEMOIN, nom: TEMOIN, x: 0.72, y: 0.5 },
            { id: "bernard", nom: "bernard", x: 0.08, y: 0.1 },
            { id: "lambert", nom: "lambert", x: 0.06, y: 0.8 },
            { id: "novak", nom: "novak", x: 0.46, y: 0.06 },
            { id: "silva", nom: "silva", x: 0.94, y: 0.12 },
            { id: "leroy", nom: "leroy", x: 0.94, y: 0.8 },
            { id: "dubois", nom: "dubois", x: 0.48, y: 0.84 },
          ]}
          liens={[
            { de: AUTEUR, vers: TEMOIN, force: 0.55, nature: "neutre", bascule: { frame: BASCULE, libelle: "HOSTILE" } },
            { de: AUTEUR, vers: "bernard", force: 0.7, nature: "affinite" },
            { de: AUTEUR, vers: "lambert", force: 0.4, nature: "affinite" },
            { de: TEMOIN, vers: "silva", force: 0.6, nature: "affinite" },
            { de: TEMOIN, vers: "leroy", force: 0.3, nature: "neutre" },
            { de: "bernard", vers: "novak", force: 0.5, nature: "affinite" },
            { de: "novak", vers: "silva", force: 0.8, nature: "affinite" },
            { de: "dubois", vers: "lambert", force: 0.45, nature: "affinite" },
            { de: "dubois", vers: "leroy", force: 0.3, nature: "neutre" },
          ]}
        />
      </Panneau>
      <Sfx nom="pulsation" a={VARIATION + DUREE_VARIATION * 0.8} volume={0.4} />
      <Sfx nom="buzzer-refus" a={BASCULE} volume={0.16} duree={30} />
      <Sfx nom="tic-point" a={BASCULE + 18} volume={0.3} />
    </VueAtria>
  );
};
