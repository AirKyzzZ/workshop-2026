import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { Balayage } from "../../composants/charte/balayage";
import { CadreHud } from "../../composants/charte/cadre-hud";
import { alpha, avance, bloque, brouiller } from "../../composants/charte/commun";
import { Grain } from "../../composants/charte/plateau";
import { Rush, type RushProps } from "../../composants/charte/rush";
import { Sfx } from "../../composants/son";
import { FPS, valeurs } from "../../donnees";
import { heure, secondesScene, type SceneActe3 } from "./commun";

export const COUCHES = ["QUI", "OÙ", "CE QUI S'ENTEND", "CE QUI SE VOIT", "QUI L'A FAIT", "CE QUE ÇA CHANGE", "CE QU'ELLE SAIT"];
export const DUREE_BALAYAGE = 14;

export type VueAtriaProps = {
  id: SceneActe3;
  couche?: number;
  plan?: React.ReactNode;
  serre?: Omit<RushProps, "nom">;
  voile?: number;
  debutCadre?: number;
  balayage?: boolean;
  children?: React.ReactNode;
};

export const VueAtria: React.FC<VueAtriaProps> = ({
  id,
  couche,
  plan,
  serre,
  voile = 0,
  debutCadre = -30,
  balayage = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const fige = id === "3.5";
  const horodatage = fige ? valeurs.heureIncident : heure(secondesScene(id) + debutCadre / FPS);
  const entete = avance(frame, debutCadre + 10, 10);
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
          {plan ?? <Rush nom="embrouille-serre" {...serre} />}
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
          <span style={{ color: couleurs.nominal }}>{brouiller(titre, avance(frame, 0, 10), frame, titre)}</span>
        </div>
      ) : null}
      {balayage ? (
        <>
          <Balayage debut={0} duree={DUREE_BALAYAGE} libelle="ANALYSE">
            {children}
          </Balayage>
          <Sfx nom="balayage-scan" a={0} volume={(f) => interpolate(f, [0, 20, 40], [0.28, 0.2, 0], bloque)} duree={42} />
        </>
      ) : (
        children
      )}
    </AbsoluteFill>
  );
};
