import scenesJson from "../data/scenes.json";
import repliquesJson from "../data/repliques.json";
import valeursJson from "../data/valeurs.json";
import { framesScene, type Replique, type Scene } from "./timing";

export const FPS = 30;
export const scenes = scenesJson as Scene[];
export const repliques = repliquesJson as Record<string, Replique>;
export const valeurs = valeursJson;
export type Valeurs = typeof valeursJson;

export const sceneParId = (id: string): Scene => {
  const scene = scenes.find((s) => s.id === id);
  if (!scene) {
    throw new Error(`scène inconnue : ${id}`);
  }
  return scene;
};

export const framesDe = (id: string): number =>
  framesScene(sceneParId(id), repliques[id], FPS);
