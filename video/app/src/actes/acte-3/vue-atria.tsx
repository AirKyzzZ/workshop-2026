import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { Balayage } from "../../composants/charte/balayage";
import { CadreHud } from "../../composants/charte/cadre-hud";
import { alpha, avance, bloque, brouiller } from "../../composants/charte/commun";
import { EtiquetteTournage, PlanFactice, type PlanFacticeProps } from "../../composants/charte/plan-factice";
import { Grain } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { FPS, valeurs } from "../../donnees";
import { ETIQUETTE_SERRE } from "../acte-1/embrouille";
import { decalageActe3, heure, secondesScene, type SceneActe3 } from "./commun";

export const COUCHES = ["QUI", "OÙ", "CE QUI S'ENTEND", "CE QUI SE VOIT", "QUI L'A FAIT", "CE QUE ÇA CHANGE", "CE QU'ELLE SAIT"];
export const DUREE_BALAYAGE = 18;

export type VueAtriaProps = {
  id: SceneActe3;
  couche?: number;
  plan?: React.ReactNode;
  planProps?: PlanFacticeProps;
  tournage?: string;
  voile?: number;
  debutCadre?: number;
  balayage?: boolean;
  children?: React.ReactNode;
};

export const VueAtria: React.FC<VueAtriaProps> = ({
  id,
  couche,
  plan,
  planProps,
  tournage = ETIQUETTE_SERRE,
  voile = 0,
  debutCadre = -30,
  balayage = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const fige = id === "3.5";
  const horodatage = fige ? valeurs.heureIncident : heure(secondesScene(id) + debutCadre / FPS);
  const entete = avance(frame, debutCadre + 20, 16);
  const titre = couche === undefined ? null : COUCHES[couche - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <CadreHud
        etiquette={`${valeurs.compartimentScene} · COMP. ${valeurs.numeroCompartiment}`}
        date={`AN ${valeurs.annee}`}
        horodatage={horodatage}
        horlogeActive={!fige}
        debut={debutCadre}
      >
        <AbsoluteFill>
          {plan ?? <PlanFactice desature decalage={decalageActe3(id)} {...planProps} />}
          <AbsoluteFill style={{ backgroundColor: alpha(couleurs.fond, voile) }} />
          <Grain opacite={0.07} />
        </AbsoluteFill>
      </CadreHud>
      <div
        style={{
          position: "absolute",
          top: 124,
          left: 86,
          display: "flex",
          gap: 14,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          opacity: entete,
        }}
      >
        <span style={{ color: couleurs.texteDoux }}>ANALYSE</span>
        <span style={{ color: couleurs.texte }}>{`${valeurs.frequenceAnalyseHz} Hz`}</span>
      </div>
      <EtiquetteTournage texte={tournage} haut={fige ? 164 : 124} cote={fige ? "gauche" : "droite"} />
      {titre && couche !== undefined ? (
        <div
          style={{
            position: "absolute",
            top: 86,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 18,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            lineHeight: 1,
            letterSpacing: "0.16em",
            whiteSpace: "pre",
          }}
        >
          <span style={{ color: couleurs.texte }}>{String(couche).padStart(2, "0")}</span>
          <span style={{ color: couleurs.texteFaible }}>{`/ ${String(COUCHES.length).padStart(2, "0")}`}</span>
          <span style={{ color: couleurs.nominal }}>{brouiller(titre, avance(frame, 2, 16), frame, titre)}</span>
        </div>
      ) : null}
      {balayage ? (
        <>
          <Balayage debut={0} duree={DUREE_BALAYAGE} libelle="ANALYSE">
            {children}
          </Balayage>
          <Sfx nom="balayage-scan" a={0} volume={(f) => interpolate(f, [0, 24, 48], [0.28, 0.2, 0], bloque)} duree={50} />
        </>
      ) : (
        children
      )}
    </AbsoluteFill>
  );
};
