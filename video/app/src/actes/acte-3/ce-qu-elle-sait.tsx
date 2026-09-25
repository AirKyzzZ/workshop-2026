import type React from "react";
import { useCurrentFrame } from "remotion";
import { avance } from "../../composants/charte/commun";
import { FicheIdentite } from "../../composants/charte/fiche-identite";
import { nombreFr } from "../../composants/metier/commun";
import { ListeControles } from "../../composants/metier/liste-controles";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { Panneau } from "./visee";
import { VueAtria } from "./vue-atria";

const FICHE = 8;
const CONTROLES = 30;
const INTERVALLE = 24;
const ANALYSE = 14;

export const CeQuElleSait: React.FC = () => {
  const frame = useCurrentFrame();
  const fin = (i: number) => CONTROLES + 12 + i * INTERVALLE + ANALYSE;
  return (
    <VueAtria id="3.8" couche={7} voile={0.55}>
      <div style={{ position: "absolute", left: 110, top: 232 }}>
        <FicheIdentite
          surtitre="Équipier"
          nom={valeurs.auteur}
          role={valeurs.roleAuteur}
          statut={`CONDUITE ${nombreFr(valeurs.conduiteApres)} < ${nombreFr(valeurs.seuilConduite)}`}
          etat="critique"
          cote="gauche"
          debut={FICHE}
          largeur={640}
        />
      </div>
      <Panneau x={850} y={206} largeur={970} p={avance(frame, CONTROLES - 8, 18)}>
        <ListeControles
          titre={`POSTE VITAL · ${valeurs.auteur}`}
          libelleNonEvalue="—"
          debut={CONTROLES}
          intervalle={INTERVALLE}
          dureeAnalyse={ANALYSE}
          largeur={914}
          controles={[
            { libelle: "QUALIFICATION", ok: true },
            { libelle: "CONDUITE", detail: nombreFr(valeurs.conduiteApres), ok: false },
            { libelle: "CONFIANCE", ok: true },
            { libelle: "CAPACITÉ", ok: true },
          ]}
        />
      </Panneau>
      <Sfx nom="telemetrie-bip" a={FICHE + 18} volume={0.25} />
      <Sfx nom="tic-point" a={fin(0)} volume={0.3} />
      <Sfx nom="pulsation" a={fin(1)} volume={0.4} />
    </VueAtria>
  );
};
