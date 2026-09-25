import type React from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, brouiller } from "../../composants/charte/commun";
import { nombreFr } from "../../composants/metier/commun";
import { ListeControles } from "../../composants/metier/liste-controles";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { OrdreCommandant } from "../acte-1/ordre";

const DEBUT = 6;
const INTERVALLE = 22;
const ANALYSE = 14;
const debutControle = (i: number) => DEBUT + 12 + i * INTERVALLE;

export const Controles: React.FC = () => {
  const frame = useCurrentFrame();
  const panneau = avance(frame, 0, 12);
  const etiquette = avance(frame, 0, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <AbsoluteFill style={{ filter: "saturate(0.1) brightness(0.32)" }}>
        <Freeze frame={framesDe("1.3") - 1}>
          <OrdreCommandant />
        </Freeze>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.22em",
          color: couleurs.attention,
          opacity: etiquette,
          whiteSpace: "pre",
        }}
      >
        <div style={{ width: 10, height: 10, backgroundColor: couleurs.attention, opacity: 0.55 + 0.45 * Math.cos(frame / 5) }} />
        {brouiller("ORDRE EN ATTENTE", etiquette, frame, "attente-4")}
      </div>
      <div
        style={{
          position: "absolute",
          left: 960 - 580,
          top: 236,
          width: 1160,
          boxSizing: "border-box",
          padding: "30px 40px 36px",
          backgroundColor: alpha(couleurs.panneau, 0.94),
          border: `1px solid ${alpha(couleurs.texte, 0.12)}`,
          boxShadow: `0 40px 100px ${alpha("#000000", 0.6)}`,
          opacity: panneau,
          translate: `0 ${(1 - panneau) * 24}px`,
        }}
      >
        <ListeControles
          titre={`CONTRÔLES · ${valeurs.auteur} → ${valeurs.posteVital}`}
          libelleNonEvalue="—"
          debut={DEBUT}
          intervalle={INTERVALLE}
          dureeAnalyse={ANALYSE}
          largeur={1080}
          controles={[
            { libelle: "QUALIFICATION", detail: valeurs.posteVital.toLowerCase(), ok: true },
            { libelle: "CONDUITE", detail: `${nombreFr(valeurs.conduiteApres)} < ${nombreFr(valeurs.seuilConduite)}`, ok: false },
            { libelle: "CONFIANCE", ok: true },
            { libelle: "CAPACITÉ", ok: true },
          ]}
        />
      </div>
      {[0, 1].flatMap((c) =>
        Array.from({ length: Math.floor(ANALYSE / 4) }, (_, k) => (
          <Sfx key={`${c}-${k}`} nom="tic-point" a={debutControle(c) + k * 4} volume={0.16} />
        )),
      )}
      <Sfx nom="tic-point" a={debutControle(0) + ANALYSE} volume={0.35} />
      <Sfx nom="verrouillage" a={debutControle(1) + ANALYSE} volume={0.3} />
    </AbsoluteFill>
  );
};
