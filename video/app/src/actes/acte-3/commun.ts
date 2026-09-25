import { ecrireTimecode, versSecondes } from "../../composants/charte/commun";
import { FPS, framesDe, valeurs } from "../../donnees";

const SCENES = ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] as const;
export type SceneActe3 = (typeof SCENES)[number];

export const decalageActe3 = (id: SceneActe3) => SCENES.slice(0, SCENES.indexOf(id)).reduce((s, x) => s + framesDe(x), 0);

const secondesIncident = versSecondes(valeurs.heureIncident);

export const secondesDebutSerre = secondesIncident - decalageActe3("3.5") / FPS;

export const secondesScene = (id: SceneActe3) => {
  if (id === "3.5") return secondesIncident;
  const apresRalenti = SCENES.indexOf(id) > SCENES.indexOf("3.5");
  return secondesDebutSerre + (decalageActe3(id) - (apresRalenti ? framesDe("3.5") : 0)) / FPS;
};

export const heure = (secondes: number) => ecrireTimecode(Math.floor(secondes * FPS), FPS).heure;
