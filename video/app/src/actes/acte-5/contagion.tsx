import { Audio } from "@remotion/media";
import type React from "react";
import {
  interpolate,
  interpolateColors,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Lecture } from "../../composants/charte/lecture";
import { FondScene } from "../../composants/charte/plateau";
import { nombreFr } from "../../composants/metier/commun";
import { OndeSonore } from "../../composants/metier/onde-sonore";
import type { IdCompartiment } from "../../composants/metier/plan-vaisseau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";
import {
  CachePlan,
  centreDe,
  compartimentDe,
  CompartimentBord,
  CoqueBord,
  DefsBord,
  emplacement,
  EquipierBord,
  IDS,
  rangDe,
  StatutBarre,
  tousLesEquipiers,
  VAISSEAU,
  vueA,
  type Vec,
} from "./plan-bord";

const TOUX = 20;
const RECUL = 64;
const ONDE_1 = 96;
const ONDE_2 = 124;
const PAS_CONTACT = 4;
const INFIRMERIE: IdCompartiment = "infirmerie";

const position = (nom: string): Vec =>
  emplacement(compartimentDe(nom), rangDe(nom));
const SOURCE = valeurs.equipierToux.toLowerCase();
const RANG_1 = valeurs.contactsRang1.map((n) => n.toLowerCase());
const RANG_2 = valeurs.contactsRang2
  .map((n) => n.toLowerCase())
  .map((nom) => {
    const p = position(nom);
    const lien = [...RANG_1].sort(
      (a, b) =>
        Math.hypot(position(a).x - p.x, position(a).y - p.y) -
        Math.hypot(position(b).x - p.x, position(b).y - p.y),
    )[0];
    return { nom, lien };
  });
const TEINTE_RANG_2 = interpolateColors(
  0.62,
  [0, 1],
  [couleurs.texteDoux, couleurs.attention],
);

const Puce: React.FC<{
  couleur: string;
  texte: string;
  nombre: number;
  p: number;
}> = ({ couleur, texte, nombre, p }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      opacity: p,
      translate: `0 ${(1 - p) * -8}px`,
    }}
  >
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: couleur,
        boxShadow: `0 0 12px ${alpha(couleur, 0.7)}`,
      }}
    />
    <span style={{ color: couleur }}>{texte}</span>
    <span style={{ color: couleurs.texte, fontWeight: 600 }}>
      {String(nombre).padStart(2, "0")}
    </span>
  </span>
);

export const Contagion: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.4");
  const vue = vueA(
    [
      {
        frame: RECUL,
        cible: centreDe(INFIRMERIE),
        zoom: 1.75,
        ecran: { x: 1300, y: 450 },
      },
      { frame: RECUL + 28, cible: VAISSEAU, zoom: 1 },
      { frame: duree, cible: VAISSEAU, zoom: 1.02 },
    ],
    frame,
  );
  const pToux = avance(frame, TOUX, 12);
  const sortiePanneau = avance(frame, RECUL - 6, 16, courbes.bascule);
  const pPanneau = avance(frame, 0, 10) * (1 - sortiePanneau);
  const source = vue.versEcran(position(SOURCE));
  const onde = (debut: number, portee: number) => {
    const p = avance(frame, debut, 34, courbes.lineaire);
    return p > 0 && p < 1
      ? { r: 20 + p * portee * vue.echelle, o: (1 - p) * 0.7 }
      : null;
  };
  const onde1 = onde(ONDE_1 - 6, 900);
  const onde2 = onde(ONDE_2 - 6, 1500);
  const allumage = (nom: string) => {
    const i1 = RANG_1.indexOf(nom);
    if (i1 >= 0)
      return { frame: ONDE_1 + i1 * PAS_CONTACT, couleur: couleurs.attention };
    const i2 = RANG_2.findIndex((c) => c.nom === nom);
    if (i2 >= 0)
      return { frame: ONDE_2 + i2 * PAS_CONTACT, couleur: TEINTE_RANG_2 };
    return null;
  };

  return (
    <FondScene>
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <DefsBord frame={frame} />
        <CoqueBord vue={vue} />
        {IDS.map((id) => (
          <CompartimentBord
            key={id}
            vue={vue}
            id={id}
            frame={frame}
            etat={id === INFIRMERIE ? "exposition" : "nominal"}
            pEtat={id === INFIRMERIE ? pToux : 1}
            libelle={
              id === INFIRMERIE
                ? { texte: `TOUX · ${nombreFr(valeurs.scoreToux)}`, p: pToux }
                : undefined
            }
          />
        ))}
        {onde1 ? (
          <circle
            cx={source.x}
            cy={source.y}
            r={onde1.r}
            fill="none"
            stroke={couleurs.attention}
            strokeWidth={2}
            opacity={onde1.o}
          />
        ) : null}
        {onde2 ? (
          <circle
            cx={source.x}
            cy={source.y}
            r={onde2.r}
            fill="none"
            stroke={couleurs.attention}
            strokeWidth={1.5}
            strokeDasharray="8 10"
            opacity={onde2.o * 0.7}
          />
        ) : null}
        {RANG_1.map((nom, i) => {
          const b = vue.versEcran(position(nom));
          const p = avance(frame, ONDE_1 + i * PAS_CONTACT - 4, 14);
          return p > 0 ? (
            <line
              key={nom}
              x1={source.x}
              y1={source.y}
              x2={source.x + (b.x - source.x) * p}
              y2={source.y + (b.y - source.y) * p}
              stroke={couleurs.attention}
              strokeWidth={2}
              opacity={0.55}
            />
          ) : null;
        })}
        {RANG_2.map((c, i) => {
          const a = vue.versEcran(position(c.lien));
          const b = vue.versEcran(position(c.nom));
          const p = avance(frame, ONDE_2 + i * PAS_CONTACT - 4, 14);
          return p > 0 ? (
            <line
              key={c.nom}
              x1={a.x}
              y1={a.y}
              x2={a.x + (b.x - a.x) * p}
              y2={a.y + (b.y - a.y) * p}
              stroke={TEINTE_RANG_2}
              strokeWidth={1.5}
              strokeDasharray="6 7"
              opacity={0.8}
            />
          ) : null;
        })}
        {tousLesEquipiers.map((m) => {
          const a = allumage(m.nom);
          const estSource = m.nom === SOURCE;
          const pA = a ? avance(frame, a.frame, 12) : 0;
          const couleur = estSource
            ? interpolateColors(
                pToux,
                [0, 1],
                [couleurs.texte, couleurs.attention],
              )
            : a
              ? interpolateColors(pA, [0, 1], [couleurs.texte, a.couleur])
              : couleurs.texte;
          return (
            <EquipierBord
              key={m.nom}
              vue={vue}
              nom={m.nom}
              position={emplacement(m.id, m.rang)}
              couleur={couleur}
              onde={
                estSource
                  ? frame >= TOUX
                    ? ((frame - TOUX) / 30) % 1
                    : 0
                  : a
                    ? avance(frame, a.frame, 24)
                    : 0
              }
              eteint={
                frame >= ONDE_1 && !a && !estSource
                  ? avance(frame, ONDE_1, 20)
                  : 0
              }
            />
          );
        })}
      </svg>
      <CachePlan cotes bas />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 190,
          width: 720,
          boxSizing: "border-box",
          padding: "26px 34px 34px",
          backgroundColor: couleurs.panneau,
          border: `1px solid ${alpha(couleurs.texte, 0.1)}`,
          borderLeft: `3px solid ${interpolateColors(pToux, [0, 1], [alpha(couleurs.texte, 0.35), couleurs.attention])}`,
          opacity: pPanneau,
          translate: `${-sortiePanneau * 60}px ${(1 - avance(frame, 0, 10)) * 20}px`,
        }}
      >
        <div
          style={{
            paddingBottom: 14,
            borderBottom: `1px solid ${couleurs.trait}`,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.08em",
            color: couleurs.texteDoux,
          }}
        >
          {`${valeurs.compartiments[INFIRMERIE]} · MICRO`}
        </div>
        <div style={{ marginTop: 6 }}>
          <OndeSonore
            largeur={650}
            hauteur={110}
            graine="infirmerie-toux"
            debut={4}
            evenements={[
              { frame: 4, duree: 12, niveau: 0.3 },
              {
                frame: TOUX,
                duree: 8,
                niveau: 0.95,
                ton: "attention",
                libelle: `TOUX · ${nombreFr(valeurs.scoreToux)}`,
              },
              { frame: TOUX + 16, duree: 6, niveau: 0.75, ton: "attention" },
              { frame: TOUX + 30, duree: 7, niveau: 0.85, ton: "attention" },
              { frame: TOUX + 58, duree: 12, niveau: 0.28 },
            ]}
          />
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 18 }}>
          <Lecture
            label="YAMNet · toux"
            valeur={valeurs.scoreToux}
            decimales={2}
            etat="attention"
            taille={64}
            debut={TOUX + 2}
            duree={16}
          />
          <Lecture
            label="Équipier"
            valeur={SOURCE.toUpperCase()}
            taille={64}
            debut={TOUX + 8}
            duree={16}
          />
        </div>
      </div>
      <BarreCommandement p={1} />
      <StatutBarre p={avance(frame, ONDE_1 - 4, 12)}>
        <Puce
          couleur={couleurs.attention}
          texte={`RANG 1 · ${valeurs.fenetreRang1H === 1 ? "DANS L'HEURE" : `SUR ${valeurs.fenetreRang1H} H`}`}
          nombre={RANG_1.length}
          p={avance(frame, ONDE_1 - 4, 12)}
        />
        <Puce
          couleur={TEINTE_RANG_2}
          texte={`RANG 2 · SUR ${valeurs.fenetreRang2H} H`}
          nombre={RANG_2.length}
          p={avance(frame, ONDE_2 - 4, 12)}
        />
      </StatutBarre>
      <Sequence from={TOUX - 1} durationInFrames={26} layout="none">
        <Audio
          src={staticFile("rushes/toux-micro.mp4")}
          trimBefore={77}
          trimAfter={103}
          volume={0.55}
        />
      </Sequence>
      <Sfx nom="pulsation" a={TOUX} volume={0.3} />
      <Sfx nom="telemetrie-bip" a={TOUX + 6} volume={0.26} />
      <Sfx nom="whoosh" a={RECUL} volume={0.18} />
      {RANG_1.map((nom, i) => (
        <Sfx
          key={nom}
          nom="tic-point"
          a={ONDE_1 + i * PAS_CONTACT}
          volume={0.3}
        />
      ))}
      {RANG_2.map((c, i) => (
        <Sfx
          key={c.nom}
          nom="tic-point"
          a={ONDE_2 + i * PAS_CONTACT}
          volume={0.18}
        />
      ))}
      <Sfx
        nom="balayage-scan"
        a={ONDE_1 - 8}
        volume={(f) => interpolate(f, [0, 20, 60], [0.16, 0.1, 0], bloque)}
        duree={62}
      />
    </FondScene>
  );
};
