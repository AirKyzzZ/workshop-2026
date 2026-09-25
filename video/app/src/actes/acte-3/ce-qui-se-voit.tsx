import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import mainsJson from "../../../data/mains.json";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, formaterNombre } from "../../composants/charte/commun";
import { Derive } from "../../composants/charte/plateau";
import { Rush, imageRush } from "../../composants/charte/rush";
import { MainSquelette, type ImageMain, type MainSqueletteProps } from "../../composants/metier/main-squelette";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { cadreVisage, DECALAGE_MAIN, imageMainReelle, mainsReelles } from "./main-reelle";
import { Visee } from "./visee";
import { VueAtria } from "./vue-atria";

const mainsSynthetiques = mainsJson as ImageMain[];

const DUREE = framesDe("3.5");
const RALENTI = { debut: 56, vitesse: 0.5 };
const DEBUT_POINTS = 10;
const INTERVALLE_POINT = 2;
const INTERVALLE_DOIGT = 36;
const FIN_SQUELETTE = DEBUT_POINTS + (valeurs.pointsMain - 1) * INTERVALLE_POINT + 16;
const MESURES = 4;
const VERDICT = FIN_SQUELETTE + MESURES * INTERVALLE_DOIGT + 6;
const VISAGE = Math.round(DUREE * 0.8);
const X_PANNEAU = 1290;
const ETALONNAGE_MAIN = "saturate(0.55) contrast(1.16) brightness(0.44)";

const MESURES_DOIGTS: MainSqueletteProps["mesures"] = [
  { doigt: "majeur", libelle: "MAJEUR", ratio: valeurs.ratioMajeur },
  { doigt: "index", libelle: "INDEX", ratio: valeurs.ratioIndex },
  { doigt: "annulaire", libelle: "ANNULAIRE", ratio: valeurs.ratioAnnulaire },
  { doigt: "auriculaire", libelle: "AURICULAIRE", ratio: valeurs.ratioAuriculaire },
];

const COMMUN: Omit<MainSqueletteProps, "images"> = {
  mesures: MESURES_DOIGTS,
  seuils: { doigt: valeurs.seuilDoigt, pouce: valeurs.seuilPouce },
  libelles: { titre: "EXTENSION · BASE → BOUT", points: "POINTS", seuil: "SEUIL", tendu: "TENDU", replie: "REPLIÉ" },
  verdict: { titre: "GESTE RECONNU", libelle: "DOIGT D'HONNEUR", score: valeurs.confianceGeste },
  debut: DEBUT_POINTS,
  intervallePoint: INTERVALLE_POINT,
  intervalleDoigt: INTERVALLE_DOIGT,
};

const FondPanneau: React.FC<{ gauche: number }> = ({ gauche }) => (
  <div
    style={{
      position: "absolute",
      left: gauche,
      top: 0,
      right: 0,
      bottom: 0,
      background: `linear-gradient(to right, ${alpha(couleurs.fond, 0)} 0px, ${alpha(couleurs.fond, 0.82)} 90px, ${couleurs.fond} 100%)`,
    }}
  />
);

const MainSurImage: React.FC = () => {
  const frame = useCurrentFrame();
  const image = imageMainReelle(RALENTI.debut, RALENTI.vitesse, frame);
  const visage = cadreVisage(image.visage);
  const pVisage = avance(frame, VISAGE, 10);
  return (
    <Derive duree={DUREE} amplitude={0.012} sens={-1}>
      <AbsoluteFill style={{ translate: `${DECALAGE_MAIN}px 0` }}>
        <Rush nom="doigt-honneur" debut={RALENTI.debut} vitesse={RALENTI.vitesse} etalonnage={ETALONNAGE_MAIN} vignette={0.4} />
        <FondPanneau gauche={X_PANNEAU - DECALAGE_MAIN - 140} />
        <Visee
          x={visage.x + visage.largeur / 2}
          y={visage.y + visage.hauteur / 2}
          largeur={visage.largeur}
          hauteur={visage.hauteur}
          p={pVisage}
          couleur={couleurs.attention}
        />
        <div
          style={{
            position: "absolute",
            left: visage.x,
            top: visage.y + visage.hauteur + 18,
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            padding: "8px 16px",
            backgroundColor: alpha(couleurs.fond, 0.78),
            borderLeft: `3px solid ${couleurs.attention}`,
            opacity: pVisage,
            translate: `0 ${(1 - pVisage) * 10}px`,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.08em", color: couleurs.texteDoux }}>VISAGE · HOSTILITÉ</span>
          <span style={{ fontFamily: polices.donnees, fontSize: 44, color: couleurs.nominal }}>{formaterNombre(image.hostilite * pVisage, 2)}</span>
        </div>
        <MainSquelette
          {...COMMUN}
          images={mainsReelles}
          cadrage="image"
          sourceA={(f) => imageRush("doigt-honneur", RALENTI.debut, RALENTI.vitesse, f)}
          panneau={{ x: X_PANNEAU - DECALAGE_MAIN, largeur: 540, haut: 226, ligne: 88 }}
        />
      </AbsoluteFill>
    </Derive>
  );
};

const MainEnPanneau: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: "absolute", left: 110, top: 200, width: 720, height: 405, overflow: "hidden", borderRadius: 4, outline: `1px solid ${alpha(couleurs.texte, 0.25)}` }}>
      <Rush nom="doigt-honneur" debut={RALENTI.debut} vitesse={RALENTI.vitesse} etalonnage={ETALONNAGE_MAIN} vignette={0.4} />
    </div>
    <MainSquelette
      {...COMMUN}
      images={mainsSynthetiques}
      vitesse={RALENTI.vitesse}
      zone={{ x: 880, y: 200, largeur: 400, hauteur: 560 }}
      panneau={{ x: X_PANNEAU, largeur: 540, haut: 226, ligne: 88 }}
      silhouette
    />
  </AbsoluteFill>
);

export const CeQuiSeVoit: React.FC = () => (
  <VueAtria id="3.5" couche={4} plan={<AbsoluteFill style={{ backgroundColor: couleurs.fond }} />}>
    {valeurs.mainsReelles ? <MainSurImage /> : <MainEnPanneau />}
    {Array.from({ length: valeurs.pointsMain }, (_, i) => (
      <Sfx key={i} nom="tic-point" a={DEBUT_POINTS + i * INTERVALLE_POINT} volume={0.2} />
    ))}
    {Array.from({ length: MESURES }, (_, i) => (
      <Sfx key={`m-${i}`} nom="telemetrie-bip" a={FIN_SQUELETTE + i * INTERVALLE_DOIGT + 16} volume={0.2} />
    ))}
    <Sfx nom="pulsation" a={VERDICT} volume={0.45} />
    <Sfx nom="verrouillage" a={VISAGE} volume={0.25} />
  </VueAtria>
);
