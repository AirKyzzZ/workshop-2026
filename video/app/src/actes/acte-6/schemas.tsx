import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes, formaterNombre } from "../../composants/charte/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { compartimentDe } from "../acte-5/plan-bord";
import { VueAvenir } from "./vue-avenir";

const FRISE = { x: 150, largeur: 980 };
const JOURS = valeurs.joursObservation;
const COLONNE = FRISE.largeur / JOURS;
const Y_JOURS = 196;
const RANGEES = [{ libelle: 244, marques: 290 }, { libelle: 328, marques: 374 }, { libelle: 412, marques: 500 }];
const COURBE = { haut: 578, bas: 702 };
const PANNEAU = { x: 1214, largeur: 576, haut: 236, hauteur: 300 };

const AGRESSIVITE = 6;
const FIXATION = 18;
const ISOLEMENT = 28;
const TRACE = 42;
const DUREE_TRACE = 44;
const PANNEAU_DEBUT = 80;
const PUCE = 92;
const APPUI = 108;
const FERMETURE = 114;
const DUREE_FERMETURE = 18;

const cx = (jour: number) => FRISE.x + (jour + 0.5) * COLONNE;
const risqueA = (jour: number) => 0.1 + (valeurs.risqueEscalade - 0.1) * Math.pow(jour / (JOURS - 1), 2.2);
const yRisque = (r: number) => interpolate(r, [0, 1], [COURBE.bas, COURBE.haut]);
const courbeInverse = (cible: number) => {
  let t = 0;
  while (t < 1 && courbes.bascule(t) < cible) t += 0.01;
  return t;
};
const JOUR_FRANCHI = Array.from({ length: JOURS * 10 }, (_, k) => k / 10).find((j) => risqueA(j) >= valeurs.seuilEscalade) ?? JOURS - 1;
const FRANCHISSEMENT = TRACE + DUREE_TRACE * courbeInverse(JOUR_FRANCHI / (JOURS - 1));

const AGRESSEUR = valeurs.agresseur;
const MENACES = valeurs.menaces;
const LIEU = valeurs.compartiments[compartimentDe(MENACES[0])];
const MAX_CONTACTS = Math.max(...valeurs.contactsIsolement);
const ENCEINTE = { x: PANNEAU.x + 250, y: PANNEAU.haut + 96, largeur: 290, hauteur: 176 };

const Libelle: React.FC<{ y: number; p: number; gauche: string; droite?: string; couleurDroite?: string }> = ({ y, p, gauche, droite, couleurDroite = couleurs.attention }) => (
  <div
    style={{
      position: "absolute",
      left: FRISE.x,
      top: y,
      width: FRISE.largeur,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: polices.donnees,
      fontSize: tailles.etiquette,
      letterSpacing: "0.08em",
      opacity: p,
      whiteSpace: "pre",
    }}
  >
    <span style={{ color: couleurs.texteDoux }}>{gauche}</span>
    {droite ? <span style={{ color: couleurDroite }}>{droite}</span> : null}
  </div>
);

const Cloison: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number }> = ({ x1, y1, x2, y2, p }) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <>
      <line x1={x1} y1={y1} x2={x1 + (mx - x1) * p} y2={y1 + (my - y1) * p} stroke={couleurs.texte} strokeWidth={6} strokeLinecap="square" />
      <line x1={x2} y1={y2} x2={x2 + (mx - x2) * p} y2={y2 + (my - y2) * p} stroke={couleurs.texte} strokeWidth={6} strokeLinecap="square" />
    </>
  );
};

export const Schemas: React.FC = () => {
  const frame = useCurrentFrame();
  const pGrille = avance(frame, 0, 12);
  const pTrace = avance(frame, TRACE, DUREE_TRACE, courbes.bascule);
  const joursTraces = pTrace * (JOURS - 1);
  const pointsCourbe = Array.from({ length: Math.floor(joursTraces * 4) + 1 }, (_, k) => k / 4)
    .concat(joursTraces)
    .map((j) => `${cx(j)},${yRisque(risqueA(j))}`)
    .join(" ");
  const risqueCourant = risqueA(joursTraces);
  const franchi = avance(frame, FRANCHISSEMENT, 12);
  const pPanneau = avance(frame, PANNEAU_DEBUT, 18);
  const pPuce = avance(frame, PUCE, 14);
  const appui = interpolate(frame, [APPUI, APPUI + 4, APPUI + 16], [0, 1, 0], bloque);
  const choisi = avance(frame, APPUI, 8);
  const fermeture = avance(frame, FERMETURE, DUREE_FERMETURE, courbes.bascule);
  const protege = avance(frame, FERMETURE + DUREE_FERMETURE - 4, 12);
  const ySeuil = yRisque(valeurs.seuilEscalade);
  const couleurRisque = interpolateColors(franchi, [0, 1], [couleurs.attention, couleurs.critique]);
  const e = ENCEINTE;

  return (
    <VueAvenir couche={3}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: JOURS + 1 }, (_, i) => (
          <line key={i} x1={FRISE.x + i * COLONNE} y1={Y_JOURS + 34} x2={FRISE.x + i * COLONNE} y2={COURBE.bas} stroke={alpha(couleurs.texte, 0.06)} strokeWidth={1} opacity={pGrille} />
        ))}
        {valeurs.joursAgressivite.map((j, k) => {
          const p = avance(frame, AGRESSIVITE + k * 5, 12);
          const c = interpolateColors(k / (valeurs.joursAgressivite.length - 1), [0, 1], [couleurs.attention, couleurs.critique]);
          return <circle key={j} cx={cx(j)} cy={RANGEES[0].marques} r={(7 + k * 1.6) * p} fill={c} opacity={0.9} />;
        })}
        {valeurs.joursFixation.map((j, k) => {
          const p = avance(frame, FIXATION + k * 5, 12);
          return (
            <g key={j} opacity={p}>
              <circle cx={cx(j)} cy={RANGEES[1].marques} r={13} fill="none" stroke={couleurs.attention} strokeWidth={2} />
              <circle cx={cx(j)} cy={RANGEES[1].marques} r={4} fill={couleurs.attention} />
            </g>
          );
        })}
        {valeurs.contactsIsolement.map((n, j) => {
          const p = avance(frame, ISOLEMENT + j * 2, 12);
          const h = (n / MAX_CONTACTS) * 40 * p;
          return (
            <rect
              key={j}
              x={cx(j) - 12}
              y={RANGEES[2].marques - h}
              width={24}
              height={h}
              fill={interpolateColors(n / MAX_CONTACTS, [0, 0.5, 1], [couleurs.attention, couleurs.texteDoux, couleurs.traitClair])}
            />
          );
        })}
        <line x1={FRISE.x} y1={COURBE.bas} x2={FRISE.x + FRISE.largeur} y2={COURBE.bas} stroke={couleurs.trait} strokeWidth={1.5} opacity={pGrille} />
        <line x1={FRISE.x} y1={ySeuil} x2={FRISE.x + FRISE.largeur} y2={ySeuil} stroke={couleurs.critique} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.75 * pGrille} />
        {pTrace > 0 ? <polyline points={pointsCourbe} fill="none" stroke={couleurRisque} strokeWidth={3} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${alpha(couleurs.critique, 0.4 * franchi)})` }} /> : null}
        {pTrace > 0 ? <circle cx={cx(joursTraces)} cy={yRisque(risqueCourant)} r={6} fill={couleurs.blanc} /> : null}
        {franchi > 0 && franchi < 1 ? (
          <circle cx={cx(JOUR_FRANCHI)} cy={ySeuil} r={10 + franchi * 30} fill="none" stroke={couleurs.critique} strokeWidth={2} opacity={1 - franchi} />
        ) : null}
      </svg>

      {Array.from({ length: JOURS }, (_, j) => (
        <div
          key={j}
          style={{
            position: "absolute",
            left: cx(j) - COLONNE / 2,
            width: COLONNE,
            top: Y_JOURS,
            textAlign: "center",
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            color: j === JOURS - 1 ? couleurs.texte : couleurs.texteFaible,
            opacity: avance(frame, 2 + j, 10) * ((JOURS - 1 - j) % 2 === 0 ? 1 : 0),
          }}
        >
          {j === JOURS - 1 ? "J" : `J−${JOURS - 1 - j}`}
        </div>
      ))}
      <Libelle y={RANGEES[0].libelle} p={avance(frame, AGRESSIVITE - 6, 12)} gauche="AGRESSIVITÉ RÉPÉTÉE" droite={AGRESSEUR} couleurDroite={couleurs.critique} />
      <Libelle y={RANGEES[1].libelle} p={avance(frame, FIXATION - 6, 12)} gauche="FIXATION SUR UNE PERSONNE" droite={`→ ${MENACES[0]}`} />
      <Libelle
        y={RANGEES[2].libelle}
        p={avance(frame, ISOLEMENT - 6, 12)}
        gauche="ISOLEMENT"
        droite={`CONTACTS ${valeurs.contactsIsolement[0]} → ${valeurs.contactsIsolement[JOURS - 1]}`}
      />
      <Libelle y={COURBE.haut - 40} p={avance(frame, TRACE - 6, 12)} gauche="RISQUE D'ESCALADE" />
      <div
        style={{
          position: "absolute",
          left: FRISE.x + FRISE.largeur - 220,
          top: COURBE.haut - 50,
          width: 220,
          textAlign: "right",
          fontFamily: polices.donnees,
          fontSize: 40,
          color: couleurRisque,
          opacity: avance(frame, TRACE, 10),
        }}
      >
        {formaterNombre(risqueCourant, 2)}
      </div>

      <div
        style={{
          position: "absolute",
          left: PANNEAU.x,
          top: Y_JOURS,
          width: PANNEAU.largeur,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          opacity: pPanneau,
        }}
      >
        PERSONNES MENACÉES
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: pPanneau }}>
        <rect x={PANNEAU.x} y={PANNEAU.haut} width={PANNEAU.largeur} height={PANNEAU.hauteur} fill={alpha(couleurs.panneau, 0.9)} stroke={couleurs.traitClair} strokeWidth={1.5} />
        <text x={PANNEAU.x + 24} y={PANNEAU.haut + 52} fill={couleurs.texte} fontFamily={polices.display} fontWeight={500} fontSize={44} letterSpacing="0.02em">
          {LIEU}
        </text>
        <rect x={e.x} y={e.y} width={e.largeur} height={e.hauteur} fill={alpha(couleurs.nominal, 0.08 * protege)} />
        <Cloison x1={e.x} y1={e.y} x2={e.x + e.largeur} y2={e.y} p={fermeture} />
        <Cloison x1={e.x + e.largeur} y1={e.y} x2={e.x + e.largeur} y2={e.y + e.hauteur} p={fermeture} />
        <Cloison x1={e.x + e.largeur} y1={e.y + e.hauteur} x2={e.x} y2={e.y + e.hauteur} p={fermeture} />
        <Cloison x1={e.x} y1={e.y + e.hauteur} x2={e.x} y2={e.y} p={fermeture} />
        {[
          { nom: AGRESSEUR, x: PANNEAU.x + 64, y: PANNEAU.haut + 184, c: couleurs.critique },
          ...MENACES.map((nom, i) => ({
            nom,
            x: e.x + 48,
            y: e.y + 58 + i * 64,
            c: interpolateColors(protege, [0, 1], [couleurs.attention, couleurs.nominal]),
          })),
        ].map((m) => (
          <g key={m.nom}>
            <circle cx={m.x} cy={m.y} r={9} fill={m.c} />
            <circle cx={m.x} cy={m.y} r={9 + ((frame / 30) % 1) * 22} fill="none" stroke={m.c} strokeWidth={1.5} opacity={(1 - ((frame / 30) % 1)) * 0.6} />
            <text x={m.x + 22} y={m.y} dominantBaseline="central" fill={m.c} fontFamily={polices.donnees} fontSize={tailles.etiquette}>
              {m.nom.toLowerCase()}
            </text>
          </g>
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: PANNEAU.x,
          top: PANNEAU.haut + PANNEAU.hauteur + 30,
          width: PANNEAU.largeur,
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          padding: "16px 0",
          border: `1.5px solid ${couleurs.attention}`,
          backgroundColor: alpha(couleurs.attention, 0.05 + 0.15 * choisi),
          boxShadow: `0 0 ${30 * appui}px ${alpha(couleurs.attention, 0.5)}`,
          fontFamily: polices.donnees,
          fontSize: 26,
          letterSpacing: "0.06em",
          color: couleurs.attention,
          whiteSpace: "pre",
          opacity: pPuce,
          translate: `0 ${(1 - pPuce) * 14}px`,
          scale: `${1 - 0.03 * appui}`,
        }}
      >
        <span style={{ fontWeight: 600 }}>PROTÉGER</span>
        <span style={{ color: alpha(couleurs.attention, 0.6) }}>·</span>
        <span>{`${valeurs.gestesProtection} GESTE DU ${valeurs.roleCommandant}`}</span>
      </div>

      {valeurs.joursAgressivite.map((j, k) => (
        <Sfx key={j} nom="tic-point" a={AGRESSIVITE + k * 5} volume={0.16} />
      ))}
      <Sfx nom="pulsation" a={FRANCHISSEMENT} volume={0.32} />
      <Sfx nom="clic-validation" a={APPUI} volume={0.45} />
      <Sfx nom="porte-etanche" a={FERMETURE - 2} volume={0.4} />
    </VueAvenir>
  );
};
