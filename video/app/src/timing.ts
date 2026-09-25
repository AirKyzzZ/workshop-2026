export type Scene = { id: string; acte: number; dureeMinS: number };
export type Replique = { texte: string; fichier: string; dureeS: number; genere: boolean };

export const MARGE_S = 0.35;
export const DUREE_MAX_S = 285;

export const dureeScene = (scene: Scene, replique?: Replique): number =>
  Math.max(scene.dureeMinS, replique ? replique.dureeS + MARGE_S : 0);

export const framesScene = (scene: Scene, replique: Replique | undefined, fps: number): number =>
  Math.round(dureeScene(scene, replique) * fps);

export const framesTotal = (
  scenes: Scene[],
  repliques: Record<string, Replique>,
  fps: number,
): number => {
  const total = scenes.reduce((somme, s) => somme + framesScene(s, repliques[s.id], fps), 0);
  if (total > DUREE_MAX_S * fps) {
    throw new Error(`vidéo trop longue : ${(total / fps).toFixed(1)} s pour ${DUREE_MAX_S} s maximum`);
  }
  return total;
};
