import type React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes, formaterNombre } from "../../composants/charte/commun";
import { CaptureReelle } from "../../composants/charte/capture-reelle";
import { FicheIdentite } from "../../composants/charte/fiche-identite";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";

const CAPTURE = 2;
const SURBRILLANCE = 36;
const DEPLACEMENT = 54;
const FICHE = 66;
const HISTORIQUE = 80;
const PROJECTION = 110;
const FRANCHISSEMENT = 132;
const RISQUE = 146;

const CAPTURE_FINALE = { x: 1110, y: 176, largeur: 700 };
const CENTRE_FINAL = { x: CAPTURE_FINALE.x + CAPTURE_FINALE.largeur / 2, y: CAPTURE_FINALE.y + 219 };
const CENTRE_DEPART = { x: 960, y: 430 };
const ECHELLE_DEPART = 1.45;

const HEURES_AVANT_SEUIL = Number(valeurs.heuresAvantSeuil.replace(",", "."));
const PENTE = (valeurs.seuilPropulsion - valeurs.capacitePrediction) / HEURES_AVANT_SEUIL;
const DEBUT_DECLIN = -6;
const PALIER = valeurs.capacitePrediction + PENTE * DEBUT_DECLIN;

const LARGEUR = 830;
const HAUTEUR = 204;
const MARGE_BAS = 44;
const MIN = 0.5;
const MAX = 0.95;
const H_MIN = -valeurs.historiquePredictionH;
const H_MAX = valeurs.horizonRuptureH;

const xH = (h: number) => interpolate(h, [H_MIN, H_MAX], [0, LARGEUR]);
const yV = (v: number) => interpolate(v, [MIN, MAX], [HAUTEUR - MARGE_BAS, 10]);

const HISTORIQUE_POINTS = Array.from({ length: valeurs.historiquePredictionH * 2 + 1 }, (_, i) => {
  const h = H_MIN + i / 2;
  const tendance = h < DEBUT_DECLIN ? PALIER : valeurs.capacitePrediction + PENTE * h;
  const bruit = h === 0 ? 0 : (random(`andre-${i}`) - 0.5) * 0.028;
  return { x: xH(h), y: yV(tendance + bruit) };
});

const CourbeCapacite: React.FC<{ frame: number }> = ({ frame }) => {
  const pHistorique = avance(frame, HISTORIQUE, 30, courbes.bascule);
  const pProjection = avance(frame, PROJECTION, 22, courbes.bascule);
  const pFranchi = avance(frame, FRANCHISSEMENT, 10);
  const pAxes = avance(frame, HISTORIQUE - 10, 10);
  const maintenant = { x: xH(0), y: yV(valeurs.capacitePrediction) };
  const fin = { x: xH(H_MAX), y: yV(valeurs.capacitePrediction + PENTE * H_MAX) };
  const croisement = { x: xH(HEURES_AVANT_SEUIL), y: yV(valeurs.seuilPropulsion) };
  const ySeuil = yV(valeurs.seuilPropulsion);
  const chemin = HISTORIQUE_POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg width={LARGEUR} height={HAUTEUR} style={{ display: "block", overflow: "visible" }}>
      <g opacity={pAxes}>
        <rect x={xH(0)} y={4} width={xH(H_MAX) - xH(0)} height={HAUTEUR - MARGE_BAS - 4} fill={alpha(couleurs.critique, 0.06)} />
        <line x1={0} y1={HAUTEUR - MARGE_BAS} x2={LARGEUR} y2={HAUTEUR - MARGE_BAS} stroke={couleurs.trait} strokeWidth={1.5} />
        <line x1={0} y1={ySeuil} x2={LARGEUR} y2={ySeuil} stroke={couleurs.critique} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.8} />
        <text x={0} y={ySeuil - 12} fill={couleurs.critique} fontFamily={polices.donnees} fontSize={tailles.etiquette}>
          {`SEUIL ${valeurs.postePrediction} ${formaterNombre(valeurs.seuilPropulsion, 2)}`}
        </text>
        <line x1={maintenant.x} y1={-6} x2={maintenant.x} y2={HAUTEUR - MARGE_BAS + 8} stroke={alpha(couleurs.texte, 0.5)} strokeWidth={1.5} />
        <text x={maintenant.x - 12} y={4} fill={couleurs.texteDoux} fontFamily={polices.donnees} fontSize={tailles.etiquette} textAnchor="end">
          MAINTENANT
        </text>
        {[
          { h: H_MIN, texte: `−${valeurs.historiquePredictionH} H`, ancre: "start" as const },
          { h: H_MAX, texte: `+${valeurs.horizonRuptureH} H`, ancre: "end" as const },
        ].map((r) => (
          <text key={r.texte} x={xH(r.h)} y={HAUTEUR - 6} fill={couleurs.texteFaible} fontFamily={polices.donnees} fontSize={tailles.etiquette} textAnchor={r.ancre}>
            {r.texte}
          </text>
        ))}
      </g>
      <path d={chemin} fill="none" stroke={couleurs.texte} strokeWidth={2.5} strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pHistorique} />
      {pHistorique >= 1 ? <circle cx={maintenant.x} cy={maintenant.y} r={6} fill={couleurs.blanc} /> : null}
      <line
        x1={maintenant.x}
        y1={maintenant.y}
        x2={maintenant.x + (fin.x - maintenant.x) * pProjection}
        y2={maintenant.y + (fin.y - maintenant.y) * pProjection}
        stroke={couleurs.attention}
        strokeWidth={2.5}
        strokeDasharray="10 8"
      />
      <g opacity={pFranchi}>
        <line x1={croisement.x} y1={croisement.y} x2={croisement.x} y2={HAUTEUR - MARGE_BAS} stroke={couleurs.attention} strokeWidth={1.5} strokeDasharray="3 5" />
        <circle cx={croisement.x} cy={croisement.y} r={9 + (1 - pFranchi) * 16} fill="none" stroke={couleurs.attention} strokeWidth={2} />
        <circle cx={croisement.x} cy={croisement.y} r={5} fill={couleurs.attention} />
        <text x={croisement.x - 12} y={ySeuil + 36} fill={couleurs.attention} fontFamily={polices.donnees} fontSize={tailles.etiquette} textAnchor="end">
          {`${valeurs.heuresAvantSeuil} H`}
        </text>
      </g>
    </svg>
  );
};

export const ChaqueEquipier: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.2");
  const deplacement = avance(frame, DEPLACEMENT, 24, courbes.bascule);
  const pRisque = avance(frame, RISQUE, 12);
  const risque = interpolate(pRisque, [0, 1], [0, valeurs.risqueRupture], bloque);

  return (
    <FondScene>
      <BarreCommandement p={1} />
      <Derive duree={duree} amplitude={0.012}>
        <div
          style={{
            position: "absolute",
            left: CAPTURE_FINALE.x,
            top: CAPTURE_FINALE.y,
            scale: `${interpolate(deplacement, [0, 1], [ECHELLE_DEPART, 1])}`,
            translate: `${interpolate(deplacement, [0, 1], [CENTRE_DEPART.x - CENTRE_FINAL.x, 0])}px ${interpolate(deplacement, [0, 1], [CENTRE_DEPART.y - CENTRE_FINAL.y, 0])}px`,
            transformOrigin: `${CAPTURE_FINALE.largeur / 2}px 219px`,
          }}
        >
          <CaptureReelle
            capture="equipage"
            libelle="CAPTURE RÉELLE · ÉQUIPAGE"
            largeur={CAPTURE_FINALE.largeur}
            cible={{ x: 0.5, y: 0.76 }}
            zoom={[1, 1.6]}
            debut={CAPTURE}
            duree={duree - CAPTURE}
            surbrillance={{ x: 0.19, y: 0.738, largeur: 0.62, hauteur: 0.046, debut: SURBRILLANCE }}
          />
        </div>
        <div style={{ position: "absolute", left: 110, top: 150 }}>
          <FicheIdentite
            surtitre="Prédiction"
            nom={valeurs.equipierPrediction}
            role={valeurs.postePrediction}
            statut={`SOUS LE SEUIL ${valeurs.postePrediction} DANS ${valeurs.heuresAvantSeuil} H`}
            etat="attention"
            cote="gauche"
            debut={FICHE}
            duree={24}
            largeur={920}
          >
            <CourbeCapacite frame={frame} />
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 18,
                marginTop: 18,
                paddingTop: 16,
                borderTop: `1px solid ${alpha(couleurs.critique, 0.5 * pRisque)}`,
                fontFamily: polices.donnees,
                fontSize: 30,
                letterSpacing: "0.04em",
                whiteSpace: "pre",
                color: couleurs.critique,
                opacity: pRisque,
                translate: `0 ${(1 - pRisque) * 14}px`,
              }}
            >
              <span>{`RUPTURE D'APTITUDE · ${valeurs.horizonRuptureH} H · RISQUE`}</span>
              <span style={{ fontWeight: 600, fontSize: 40 }}>{formaterNombre(risque, 2)}</span>
            </div>
          </FicheIdentite>
        </div>
      </Derive>
      <Sfx nom="whoosh" a={CAPTURE} volume={0.18} />
      <Sfx nom="tic-point" a={SURBRILLANCE} volume={0.32} />
      <Sfx nom="whoosh" a={DEPLACEMENT} volume={0.14} />
      <Sfx nom="telemetrie-bip" a={FICHE + 22} volume={0.28} />
      <Sfx nom="tic-point" a={FRANCHISSEMENT} volume={0.35} />
      <Sfx nom="pulsation" a={RISQUE} volume={0.32} />
    </FondScene>
  );
};
