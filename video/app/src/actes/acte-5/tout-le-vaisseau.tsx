import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque } from "../../composants/charte/commun";
import { FondScene } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { DISPOSITION, LARGEUR_COMP, type IdCompartiment } from "../../composants/metier/plan-vaisseau";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";
import {
  CachePlan,
  centreDe,
  CompartimentBord,
  CoqueBord,
  DefsBord,
  emplacement,
  EquipierBord,
  IDS,
  StatutBarre,
  tousLesEquipiers,
  VAISSEAU,
  vueA,
  type CleCamera,
} from "./plan-bord";

const DEBUT_RECUL = 14;
const FIN_RECUL = 116;
const DEBUT_BALAYAGE = 124;
const PERIODE_BALAYAGE = 96;
const SERRE = centreDe("serre");

if (tousLesEquipiers.length !== valeurs.enService) {
  throw new Error(`equipageBord compte ${tousLesEquipiers.length} équipiers pour ${valeurs.enService} en service`);
}

const apparition = (id: IdCompartiment, rang: number) => {
  if (id === "serre") return -20;
  const c = emplacement(id, rang);
  return 34 + Math.hypot(c.x - SERRE.x, c.y - SERRE.y) / 14 + rang * 2;
};

export const ToutLeVaisseau: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.1");
  const camera: CleCamera[] = [
    { frame: DEBUT_RECUL, cible: SERRE, zoom: 2.5 },
    { frame: FIN_RECUL, cible: VAISSEAU, zoom: 1 },
    { frame: duree, cible: VAISSEAU, zoom: 1.03 },
  ];
  const vue = vueA(camera, frame);
  const repere = 1 - avance(frame, 70, 30);
  const visibles = tousLesEquipiers.filter((m) => frame >= apparition(m.id, m.rang) + 4).length;
  const gauche = vue.versEcran({ x: 170, y: 0 }).x;
  const droite = vue.versEcran({ x: 1752, y: 0 }).x;
  const haut = vue.versEcran({ x: 0, y: 160 }).y;
  const bas = vue.versEcran({ x: 0, y: 920 }).y;
  const cycle = frame >= DEBUT_BALAYAGE ? ((frame - DEBUT_BALAYAGE) % PERIODE_BALAYAGE) / PERIODE_BALAYAGE : -1;
  const xBalayage = gauche + cycle * (droite - gauche);
  const visibiliteBalayage = cycle < 0 ? 0 : interpolate(cycle, [0, 0.08, 0.85, 1], [0, 1, 1, 0], bloque);
  const premiers = IDS.filter((id) => id !== "serre").map((id) => Math.min(...tousLesEquipiers.filter((m) => m.id === id).map((m) => apparition(m.id, m.rang))));

  return (
    <FondScene>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <DefsBord frame={frame} />
        <defs>
          <linearGradient id="bord-balayage" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={couleurs.nominal} stopOpacity={0} />
            <stop offset="1" stopColor={couleurs.nominal} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CoqueBord vue={vue} />
        {IDS.map((id) => {
          const d = vue.versEcran({ x: DISPOSITION[id].x, y: 0 }).x;
          const l = LARGEUR_COMP * vue.echelle;
          return (
            <CompartimentBord
              key={id}
              vue={vue}
              id={id}
              frame={frame}
              etat={id === "serre" ? "repere" : "nominal"}
              pEtat={id === "serre" ? repere : 1}
              eclat={cycle < 0 ? 0 : interpolate(xBalayage - d, [-30, 0, l, l + 260], [0, 1, 1, 0], bloque) * visibiliteBalayage}
            />
          );
        })}
        {tousLesEquipiers.map((m) => {
          const debut = apparition(m.id, m.rang);
          const p = avance(frame, debut, 14);
          return (
            <EquipierBord
              key={m.nom}
              vue={vue}
              nom={m.nom}
              position={emplacement(m.id, m.rang)}
              p={p}
              onde={m.id === "serre" ? 0 : avance(frame, debut, 26)}
              couleur={m.id === "serre" && repere > 0 ? couleurs.nominal : couleurs.texte}
            />
          );
        })}
        {visibiliteBalayage > 0 ? (
          <g opacity={visibiliteBalayage}>
            <rect x={xBalayage - 220} y={haut} width={220} height={bas - haut} fill="url(#bord-balayage)" />
            <line x1={xBalayage} y1={haut} x2={xBalayage} y2={bas} stroke={couleurs.blanc} strokeWidth={2} filter="url(#bord-lueur)" />
            <line x1={xBalayage} y1={haut} x2={xBalayage} y2={bas} stroke={alpha(couleurs.nominal, 0.9)} strokeWidth={6} opacity={0.35} />
          </g>
        ) : null}
      </svg>
      <CachePlan cotes />
      <BarreCommandement p={1} />
      <StatutBarre p={avance(frame, DEBUT_RECUL + 20, 16)}>
        <span>
          <span style={{ color: couleurs.texte, fontWeight: 600 }}>{String(Math.max(visibles, 1)).padStart(2, "0")}</span>
          <span style={{ color: couleurs.texteDoux }}> EN SERVICE</span>
        </span>
        <span style={{ color: couleurs.texteFaible }}>·</span>
        <span>
          <span style={{ color: couleurs.texte, fontWeight: 600 }}>{valeurs.aBord}</span>
          <span style={{ color: couleurs.texteDoux }}> À BORD</span>
        </span>
      </StatutBarre>
      <Sfx nom="whoosh" a={DEBUT_RECUL} volume={0.22} />
      {premiers.map((a, i) => (
        <Sfx key={i} nom="tic-point" a={a} volume={0.12} />
      ))}
      <Sfx nom="telemetrie-bip" a={Math.max(...tousLesEquipiers.map((m) => apparition(m.id, m.rang))) + 6} volume={0.28} />
      <Sfx nom="balayage-scan" a={DEBUT_BALAYAGE} volume={(f) => interpolate(f, [0, 30, 64], [0.14, 0.1, 0], bloque)} duree={66} />
    </FondScene>
  );
};
