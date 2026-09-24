import scenesJson from "../data/scenes.json";
import repliquesJson from "../data/repliques.json";
import valeursJson from "../data/valeurs.json";
import type { Replique, Scene } from "./timing";

export const FPS = 30;
export const scenes = scenesJson as Scene[];
export const repliques = repliquesJson as Record<string, Replique>;
export const valeurs = valeursJson;
export type Valeurs = typeof valeursJson;
