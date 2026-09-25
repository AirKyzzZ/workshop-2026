import { Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Freeze, staticFile, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { Vignette } from "./plateau";

export const IMAGES_RUSH = {
  "embrouille-serre": 121,
  "doigt-honneur": 221,
  "badge-equipier": 83,
  "carte-nfc-captaine": 92,
  "lcd-reacteur": 268,
  "toux-micro": 181,
  "table-installation": 358,
} as const;

export type NomRush = keyof typeof IMAGES_RUSH;

export const ETALONNAGE = "saturate(0.6) contrast(1.14) brightness(0.5)";

export type RushProps = {
  nom: NomRush;
  debut?: number;
  vitesse?: number;
  fige?: number;
  volume?: number;
  etalonnage?: string;
  vignette?: number;
  style?: React.CSSProperties;
};

export const imageRush = (nom: NomRush, debut: number, vitesse: number, frame: number) =>
  Math.min(IMAGES_RUSH[nom] - 1, Math.max(0, Math.round(debut + frame * vitesse)));

export const Rush: React.FC<RushProps> = ({ nom, debut = 0, vitesse = 1, fige, volume = 0, etalonnage = ETALONNAGE, vignette = 0.55, style }) => {
  const frame = useCurrentFrame();
  const derniere = IMAGES_RUSH[nom] - 1;
  const finLecture = Math.floor((derniere - debut) / vitesse);
  const fixe = fige !== undefined ? Math.min(derniere, Math.max(0, Math.round(fige))) : frame > finLecture ? derniere : null;
  const video = (
    <Video
      src={staticFile(`rushes/${nom}.mp4`)}
      trimBefore={fixe === null ? debut : 0}
      playbackRate={fixe === null ? vitesse : 1}
      volume={volume}
      muted={volume === 0}
      objectFit="cover"
      style={{ width: "100%", height: "100%", filter: etalonnage }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond, overflow: "hidden", ...style }}>
      {fixe === null ? video : <Freeze frame={fixe}>{video}</Freeze>}
      {vignette > 0 ? <Vignette force={vignette} /> : null}
    </AbsoluteFill>
  );
};
