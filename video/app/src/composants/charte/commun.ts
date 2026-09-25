import { Easing, interpolate, random } from "remotion";
import { couleurs } from "../../charte";

export type Etat = "nominal" | "attention" | "critique";

export const couleurEtat = (etat: Etat) => couleurs[etat];

export const bloque = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const courbes = {
  entree: Easing.spring({ damping: 200 }),
  bascule: Easing.bezier(0.65, 0, 0.35, 1),
  lineaire: Easing.linear,
};

export const avance = (frame: number, debut: number, duree: number, courbe: (t: number) => number = courbes.entree) =>
  interpolate(frame, [debut, debut + Math.max(1, duree)], [0, 1], { ...bloque, easing: courbe });

export const alpha = (couleur: string, opacite: number) =>
  `${couleur}${Math.round(Math.min(1, Math.max(0, opacite)) * 255)
    .toString(16)
    .padStart(2, "0")}`;

export const formaterNombre = (valeur: number, decimales: number) =>
  valeur
    .toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    .replace(/[\u202f\u00a0]/g, "\u00a0");

const CHIFFRES = "0123456789";
const MAJUSCULES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const brouiller = (texte: string, progres: number, frame: number, graine: string, traine = 4) => {
  const caracteres = [...texte];
  const tete = progres * (caracteres.length + traine);
  return caracteres
    .map((c, i) => {
      if (progres >= 1 || i < tete - traine) return c;
      if (i >= tete) return "\u00a0";
      const jeu = /\p{N}/u.test(c) ? CHIFFRES : /\p{L}/u.test(c) ? MAJUSCULES : null;
      if (!jeu) return c;
      const tire = jeu[Math.floor(random(`${graine}-${i}-${Math.floor(frame / 2)}`) * jeu.length)];
      return c === c.toLowerCase() && c !== c.toUpperCase() ? tire.toLowerCase() : tire;
    })
    .join("");
};

export const versSecondes = (heure: string) => {
  const morceaux = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(heure.trim());
  if (!morceaux) throw new Error(`Heure attendue au format HH:MM:SS, reçu « ${heure} »`);
  return Number(morceaux[1]) * 3600 + Number(morceaux[2]) * 60 + Number(morceaux[3]);
};

const deuxChiffres = (n: number) => String(Math.floor(n)).padStart(2, "0");

export const ecrireTimecode = (images: number, fps: number) => {
  const parJour = 86400 * fps;
  const total = ((Math.round(images) % parJour) + parJour) % parJour;
  const secondes = Math.floor(total / fps);
  return {
    heure: `${deuxChiffres(secondes / 3600)}:${deuxChiffres((secondes / 60) % 60)}:${deuxChiffres(secondes % 60)}`,
    images: deuxChiffres(total % fps),
  };
};
