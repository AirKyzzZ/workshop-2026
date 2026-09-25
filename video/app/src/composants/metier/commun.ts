import { Easing, interpolate } from "remotion";
import { couleurs } from "../../charte";

export type Niveau = "nominal" | "attention" | "critique";

export const ADOUCI = Easing.spring({ damping: 200 });
export const AMORTI = Easing.bezier(0.65, 0, 0.35, 1);

export const progression = (frame: number, debut: number, duree: number, easing = ADOUCI): number =>
  interpolate(frame, [debut, debut + Math.max(1, duree)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const nombreFr = (valeur: number, decimales = 2): string =>
  valeur.toFixed(decimales).replace(".", ",").replace("-", "−");

export const couleurNiveau = (niveau: Niveau): string => couleurs[niveau];

export const alpha = (hex: string, opacite: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, opacite)) * 255)
    .toString(16)
    .padStart(2, "0")}`;
