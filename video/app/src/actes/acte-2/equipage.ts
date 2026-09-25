import { useMemo } from "react";
import { useTraceSvg } from "../../composants/charte/trace-svg";
import { valeurs } from "../../donnees";

export type Point = { x: number; y: number };

export const COLONNES = 25;
const PAS = 40;
const CENTRE = { x: 960, y: 470 };

export const grilleEquipage: Point[] = Array.from({ length: valeurs.aBord }, (_, i) => {
  const lignes = Math.ceil(valeurs.aBord / COLONNES);
  const colonne = i % COLONNES;
  const ligne = Math.floor(i / COLONNES);
  return {
    x: CENTRE.x + (colonne - (COLONNES - 1) / 2) * PAS,
    y: CENTRE.y + (ligne - (lignes - 1) / 2) * PAS,
  };
});

const echantillonner = (formes: string[], cote: number, hauteur: number, nombre: number): Point[] => {
  const contexte = document.createElement("canvas").getContext("2d");
  if (!contexte) throw new Error("Échantillonnage de la marque : contexte 2D indisponible");
  const chemins = formes.map((d) => new Path2D(d));
  const dedans = (x: number, y: number) => chemins.some((c) => contexte.isPointInPath(c, x * 10, (hauteur - y) * 10));
  for (let pas = cote / 16; pas > 2; pas *= 0.94) {
    const trouves: Point[] = [];
    for (let y = pas / 2; y < hauteur; y += pas) {
      const decale = (Math.round(y / pas) % 2) * (pas / 2);
      for (let x = pas / 2 + decale; x < cote; x += pas) {
        if (dedans(x, y)) trouves.push({ x, y });
      }
    }
    if (trouves.length >= nombre) {
      return Array.from({ length: nombre }, (_, k) => trouves[Math.floor((k * trouves.length) / nombre)]);
    }
  }
  throw new Error(`Échantillonnage de la marque : moins de ${nombre} points trouvés`);
};

export const usePointsMarque = (taille: number, haut: number): Point[] | null => {
  const marque = useTraceSvg("brand/atria-mark.svg");
  return useMemo(() => {
    if (!marque) return null;
    const echelle = taille / marque.largeur;
    const gauche = 960 - taille / 2;
    return echantillonner(marque.formes, marque.largeur, marque.hauteur, valeurs.aBord).map((p) => ({
      x: gauche + p.x * echelle,
      y: haut + p.y * echelle,
    }));
  }, [marque, taille, haut]);
};
