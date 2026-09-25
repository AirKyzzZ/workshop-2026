import mainsReellesJson from "../../../data/mains-reelles.json";
import { IMAGES_RUSH, imageRush } from "../../composants/charte/rush";
import type { ImageMain } from "../../composants/metier/main-squelette";

export type CadreVisage = { x: number; y: number; l: number; h: number };
export type ImageMainReelle = ImageMain & { visage: CadreVisage; hostilite: number };

export const DECALAGE_MAIN = -180;
export const LARGEUR_SOURCE = mainsReellesJson.largeur;
export const HAUTEUR_SOURCE = mainsReellesJson.hauteur;
export const mainsReelles: ImageMainReelle[] = mainsReellesJson.images;

if (mainsReelles.length !== IMAGES_RUSH["doigt-honneur"]) {
  throw new Error(`mains-reelles.json compte ${mainsReelles.length} images pour ${IMAGES_RUSH["doigt-honneur"]} dans doigt-honneur.mp4`);
}

export const imageMainReelle = (debut: number, vitesse: number, frame: number) => mainsReelles[imageRush("doigt-honneur", debut, vitesse, frame)];

export const cadreVisage = (v: CadreVisage) => ({
  x: v.x * LARGEUR_SOURCE,
  y: v.y * HAUTEUR_SOURCE,
  largeur: v.l * LARGEUR_SOURCE,
  hauteur: v.h * HAUTEUR_SOURCE,
});
