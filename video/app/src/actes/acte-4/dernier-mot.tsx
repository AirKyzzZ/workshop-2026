import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Curseur, positionCurseur } from "../../composants/charte/curseur";
import { FondScene } from "../../composants/charte/plateau";
import { nombreFr } from "../../composants/metier/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";

const PANNEAUX = 6;
const CLIC = 214;
const VALIDE = CLIC + 8;
const GARANTIES = [
  { mot: "HORODATÉ", a: 104 },
  { mot: "SIGNÉ", a: 124 },
  { mot: "JOURNALISÉ", a: 144 },
];

const GAUCHE = { x: 110, largeur: 820 };
const DROITE = { x: 990, largeur: 820 };
const HAUT = 214;
const HAUTEUR = 400;

const CLES = [
  { frame: 28, x: 980, y: 900 },
  { frame: 78, x: 1420, y: 470 },
  { frame: 118, x: 1392, y: 488 },
  { frame: 160, x: 1430, y: 456 },
  { frame: 176, x: 1404, y: 474 },
  { frame: 208, x: 560, y: 450 },
];

const dans = (x: number, y: number, p: { x: number; largeur: number }) => x > p.x && x < p.x + p.largeur && y > HAUT && y < HAUT + HAUTEUR;

const Option: React.FC<{
  x: number;
  largeur: number;
  p: number;
  survol: number;
  choisi: number;
  ecarte: number;
  titre: string;
  children: React.ReactNode;
}> = ({ x, largeur, p, survol, choisi, ecarte, titre, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: HAUT,
      width: largeur,
      height: HAUTEUR,
      boxSizing: "border-box",
      padding: "44px 52px",
      backgroundColor: interpolateColors(choisi, [0, 1], [alpha(couleurs.panneau, 0.9), alpha("#12241B", 0.95)]),
      border: `${1 + choisi}px solid ${interpolateColors(choisi, [0, 1], [alpha(couleurs.texte, 0.1 + 0.35 * survol), couleurs.nominal])}`,
      boxShadow: choisi > 0 ? `0 0 ${50 * choisi}px ${alpha(couleurs.nominal, 0.2)}` : undefined,
      opacity: p * (1 - 0.55 * ecarte),
      translate: `0 ${(1 - p) * 30}px`,
      scale: `${1 + 0.012 * survol - 0.02 * ecarte}`,
    }}
  >
    <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 68, lineHeight: 1, paddingTop: 8, color: couleurs.texte, whiteSpace: "nowrap" }}>{titre}</div>
    <div style={{ height: 1, backgroundColor: couleurs.trait, margin: "30px 0 32px" }} />
    {children}
  </div>
);

export const DernierMot: React.FC = () => {
  const frame = useCurrentFrame();
  const curseur = positionCurseur(CLES, frame, courbes.bascule);
  const appui = interpolate(frame, [CLIC, CLIC + 10], [0, 1], bloque);
  const choisi = avance(frame, VALIDE, 14);
  const survolDroite = dans(curseur.x, curseur.y, DROITE) && frame < CLIC ? 1 : 0;
  const survolGauche = dans(curseur.x, curseur.y, GAUCHE) ? 1 : 0;
  const resultat = avance(frame, VALIDE + 6, 18);

  return (
    <FondScene>
      <BarreCommandement p={1} />
      <Option x={GAUCHE.x} largeur={GAUCHE.largeur} p={avance(frame, PANNEAUX, 20)} survol={survolGauche} choisi={choisi} ecarte={0} titre="AFFECTER LE REMPLAÇANT">
        <div style={{ fontFamily: polices.donnees, fontSize: 32, color: couleurs.texte }}>{`${valeurs.remplacant} → ${valeurs.posteVital}`}</div>
        <div style={{ marginTop: 18, fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.08em", color: couleurs.nominal }}>
          {`CAPACITÉ ${nombreFr(valeurs.capaciteRemplacant)}`}
        </div>
      </Option>
      <Option x={DROITE.x} largeur={DROITE.largeur} p={avance(frame, PANNEAUX + 6, 20)} survol={survolDroite} choisi={0} ecarte={choisi} titre="DÉROGER">
        <div style={{ display: "flex", gap: 20 }}>
          {GARANTIES.map((g, i) => {
            const allume = avance(frame, g.a, 12);
            return (
              <div
                key={g.mot}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  border: `1px solid ${interpolateColors(allume, [0, 1], [couleurs.trait, couleurs.attention])}`,
                  backgroundColor: alpha(couleurs.attention, 0.1 * allume),
                  fontFamily: polices.donnees,
                  fontSize: tailles.etiquette,
                  letterSpacing: "0.06em",
                  color: interpolateColors(allume, [0, 1], [couleurs.texteDoux, couleurs.attention]),
                }}
              >
                <span style={{ color: couleurs.texteFaible }}>{String(i + 1).padStart(2, "0")}</span>
                {g.mot}
              </div>
            );
          })}
        </div>
      </Option>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 668,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 22,
          opacity: resultat,
          translate: `0 ${(1 - resultat) * 16}px`,
        }}
      >
        <svg width={40} height={40} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={18} fill="none" stroke={couleurs.nominal} strokeWidth={2} />
          <path d="M 11 21 L 17 27 L 29 14" fill="none" stroke={couleurs.nominal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - resultat} />
        </svg>
        <div style={{ fontFamily: polices.donnees, fontWeight: 600, fontSize: 40, letterSpacing: "0.06em", color: couleurs.nominal }}>
          {`${valeurs.remplacant} → ${valeurs.posteVital} · VALIDÉ`}
        </div>
      </div>
      <Curseur x={curseur.x} y={curseur.y} appui={appui} opacite={avance(frame, CLES[0].frame, 8)} />
      {GARANTIES.map((g) => (
        <Sfx key={g.mot} nom="tic-point" a={g.a} volume={0.3} />
      ))}
      <Sfx nom="clic-validation" a={CLIC} volume={0.55} />
      <Sfx nom="telemetrie-bip" a={VALIDE + 6} volume={0.3} />
    </FondScene>
  );
};
