import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import mainsJson from "../../../data/mains.json";
import { couleurs } from "../../charte";
import { avance } from "../../composants/charte/commun";
import { Lecture } from "../../composants/charte/lecture";
import { Derive } from "../../composants/charte/plateau";
import { MainSquelette, type ImageMain } from "../../composants/metier/main-squelette";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { MaillageVisage } from "./maillage-visage";
import { Panneau } from "./visee";
import { VueAtria } from "./vue-atria";

const mains = mainsJson as ImageMain[];

const DEBUT_POINTS = 20;
const INTERVALLE_POINT = 6;
const INTERVALLE_DOIGT = 34;
const FIN_SQUELETTE = DEBUT_POINTS + (valeurs.pointsMain - 1) * INTERVALLE_POINT + 18;
const MESURES = 4;
const VERDICT = FIN_SQUELETTE + MESURES * INTERVALLE_DOIGT + 6;
const VISAGE = VERDICT + 26;

const PlanMain: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: couleurs.fond,
      backgroundImage: "radial-gradient(ellipse 46% 60% at 42% 52%, #1F1D1B 0%, #121110 55%, #0B0A0A 100%)",
    }}
  />
);

export const CeQuiSeVoit: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <VueAtria id="3.5" couche={4} plan={<PlanMain />} tournage="GROS PLAN MAIN">
      <Derive duree={framesDe("3.5")} amplitude={0.012} sens={-1}>
        <MainSquelette
          images={mains}
          mesures={[
            { doigt: "majeur", libelle: "MAJEUR", ratio: valeurs.ratioMajeur },
            { doigt: "index", libelle: "INDEX", ratio: valeurs.ratioIndex },
            { doigt: "annulaire", libelle: "ANNULAIRE", ratio: valeurs.ratioAnnulaire },
            { doigt: "auriculaire", libelle: "AURICULAIRE", ratio: valeurs.ratioAuriculaire },
          ]}
          seuils={{ doigt: valeurs.seuilDoigt, pouce: valeurs.seuilPouce }}
          libelles={{ titre: "EXTENSION · BASE → BOUT", points: "POINTS", seuil: "SEUIL", tendu: "TENDU", replie: "REPLIÉ" }}
          verdict={{ titre: "GESTE RECONNU", libelle: "DOIGT D'HONNEUR", score: valeurs.confianceGeste }}
          debut={DEBUT_POINTS}
          intervallePoint={INTERVALLE_POINT}
          intervalleDoigt={INTERVALLE_DOIGT}
          vitesse={0.5}
          zone={{ x: 590, y: 216, largeur: 610, hauteur: 562 }}
          panneau={{ x: 1224, largeur: 600, haut: 226, ligne: 88 }}
          silhouette
        />
      </Derive>
      <Panneau x={110} y={224} largeur={384} p={avance(frame, VISAGE - 8, 18)} titre="MAILLAGE DU VISAGE" accent={couleurs.attention}>
        <MaillageVisage debut={VISAGE} detection={VISAGE + 30} />
        <div style={{ marginTop: 18 }}>
          <Lecture label="Hostilité" valeur={valeurs.hostiliteVisage} decimales={2} etat="attention" taille={52} debut={VISAGE + 26} duree={26} />
        </div>
      </Panneau>
      {Array.from({ length: valeurs.pointsMain }, (_, i) => (
        <Sfx key={i} nom="tic-point" a={DEBUT_POINTS + i * INTERVALLE_POINT} volume={0.32} />
      ))}
      {Array.from({ length: MESURES }, (_, i) => (
        <Sfx key={`m-${i}`} nom="telemetrie-bip" a={FIN_SQUELETTE + i * INTERVALLE_DOIGT + 22} volume={0.2} />
      ))}
      <Sfx nom="pulsation" a={VERDICT} volume={0.45} />
      <Sfx nom="verrouillage" a={VISAGE + 30} volume={0.25} />
    </VueAtria>
  );
};
