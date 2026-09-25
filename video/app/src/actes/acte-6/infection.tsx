import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { VueAvenir } from "./vue-avenir";

const GRAPHE = { x: 170, largeur: 820, bas: 630, hauteur: 320 };
const BARRES = 4;
const PAS_BARRE = 6;
const TOUX_GRASSE = 40;
const HAUSSE = 46;
const INFECTION = 66;

const JOURS = valeurs.touxParJour;
const DERNIER = JOURS[JOURS.length - 1];
const HABITUDE = DERNIER / (1 + valeurs.hausseToux / 100);
const MAX = Math.max(...JOURS);
const CASE = GRAPHE.largeur / JOURS.length;
const hauteurDe = (n: number) => (n / MAX) * GRAPHE.hauteur;

export const Infection: React.FC = () => {
  const frame = useCurrentFrame();
  const pHausse = avance(frame, HAUSSE, 24);
  const yHabitude = GRAPHE.bas - hauteurDe(HABITUDE);

  return (
    <VueAvenir couche={4}>
      <div
        style={{
          position: "absolute",
          left: GRAPHE.x,
          top: 196,
          width: GRAPHE.largeur,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          opacity: avance(frame, 0, 12),
          whiteSpace: "pre",
        }}
      >
        <span>{`TOUX PAR JOUR · ${valeurs.equipierInfection}`}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: GRAPHE.x,
          top: GRAPHE.bas + 66,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          opacity: avance(frame, 8, 14),
          whiteSpace: "pre",
        }}
      >
        <svg width={36} height={4}>
          <line x1={0} y1={2} x2={36} y2={2} stroke={couleurs.texteDoux} strokeWidth={2} strokeDasharray="6 5" />
        </svg>
        {`HABITUDE · ${Math.round(HABITUDE)} / JOUR`}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={GRAPHE.x} y1={GRAPHE.bas} x2={GRAPHE.x + GRAPHE.largeur} y2={GRAPHE.bas} stroke={couleurs.trait} strokeWidth={1.5} />
        <line x1={GRAPHE.x} y1={yHabitude} x2={GRAPHE.x + GRAPHE.largeur} y2={yHabitude} stroke={couleurs.texteDoux} strokeWidth={1.5} strokeDasharray="6 7" opacity={avance(frame, 8, 14)} />
        {JOURS.map((n, i) => {
          const p = avance(frame, BARRES + i * PAS_BARRE, 16, courbes.entree);
          const ratio = n / HABITUDE;
          const c = ratio <= 1.3 ? couleurs.traitClair : interpolateColors(ratio, [1.3, 2.5, 4.4], [couleurs.attention, couleurs.attention, couleurs.critique]);
          const h = hauteurDe(n) * p;
          const x = GRAPHE.x + i * CASE + CASE / 2;
          return (
            <g key={i}>
              <rect x={x - 32} y={GRAPHE.bas - h} width={64} height={h} fill={c} style={{ filter: ratio > 1.3 ? `drop-shadow(0 0 12px ${alpha(c, 0.4)})` : undefined }} />
              <text x={x} y={GRAPHE.bas - h - 16} textAnchor="middle" fill={ratio > 1.3 ? c : couleurs.texteDoux} fontFamily={polices.donnees} fontSize={26} opacity={p}>
                {Math.round(n * p)}
              </text>
              <text x={x} y={GRAPHE.bas + 40} textAnchor="middle" fill={i === JOURS.length - 1 ? couleurs.texte : couleurs.texteFaible} fontFamily={polices.donnees} fontSize={tailles.etiquette} opacity={avance(frame, 2 + i, 10)}>
                {i === JOURS.length - 1 ? "J" : `J−${JOURS.length - 1 - i}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 1130, top: 214, width: 680, display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: 18,
            borderBottom: `1px solid ${alpha(couleurs.attention, 0.5)}`,
            fontFamily: polices.donnees,
            fontSize: 30,
            letterSpacing: "0.1em",
            color: couleurs.attention,
            opacity: avance(frame, TOUX_GRASSE, 12),
            translate: `${(1 - avance(frame, TOUX_GRASSE, 12)) * 16}px 0`,
          }}
        >
          <div style={{ width: 12, height: 12, backgroundColor: couleurs.attention, opacity: 0.6 + 0.4 * Math.cos(frame / 5) }} />
          TOUX GRASSE
        </div>
        <div
          style={{
            fontFamily: polices.display,
            fontWeight: 600,
            fontSize: 230,
            lineHeight: 1,
            paddingTop: 30,
            color: couleurs.critique,
            textShadow: `0 0 50px ${alpha(couleurs.critique, 0.3)}`,
            opacity: interpolate(pHausse, [0, 0.2], [0, 1], bloque),
            whiteSpace: "pre",
          }}
        >
          {`+${Math.round(valeurs.hausseToux * pHausse)}\u00a0%`}
        </div>
        <div style={{ overflow: "hidden", paddingTop: 6 }}>
          <div
            style={{
              fontFamily: polices.display,
              fontWeight: 600,
              fontSize: 80,
              lineHeight: 1,
              paddingTop: 8,
              color: couleurs.critique,
              translate: `0 ${(1 - avance(frame, INFECTION, 16)) * 110}%`,
            }}
          >
            INFECTION PROBABLE
          </div>
        </div>
      </div>
      {JOURS.map((_, i) => (
        <Sfx key={i} nom="tic-point" a={BARRES + i * PAS_BARRE} volume={0.12 + i * 0.03} />
      ))}
      <Sfx nom="telemetrie-bip" a={HAUSSE} volume={0.28} />
      <Sfx nom="pulsation" a={INFECTION} volume={0.3} />
    </VueAvenir>
  );
};
