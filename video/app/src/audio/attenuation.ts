export type IntervalleVoix = { debut: number; fin: number };

export type OptionsAttenuation = {
  base?: number;
  sousVoix?: number;
  rampe?: number;
};

const fusionner = (
  voix: IntervalleVoix[],
  ecartMax: number,
): IntervalleVoix[] =>
  [...voix]
    .sort((a, b) => a.debut - b.debut)
    .reduce<IntervalleVoix[]>((fusion, intervalle) => {
      const dernier = fusion.at(-1);
      if (dernier && intervalle.debut - dernier.fin <= ecartMax) {
        dernier.fin = Math.max(dernier.fin, intervalle.fin);
        return fusion;
      }
      fusion.push({ ...intervalle });
      return fusion;
    }, []);

const profondeur = (
  frame: number,
  intervalle: IntervalleVoix,
  rampe: number,
): number => {
  const distance = Math.max(
    intervalle.debut - frame,
    0,
    frame - intervalle.fin,
  );
  if (rampe === 0) {
    return distance === 0 ? 1 : 0;
  }
  return Math.max(0, 1 - distance / rampe);
};

export const volumeMusique = (
  frame: number,
  voix: IntervalleVoix[],
  { base = 0.55, sousVoix = 0.14, rampe = 8 }: OptionsAttenuation = {},
): number => {
  if (rampe < 0) {
    throw new Error(`rampe négative : ${rampe} images`);
  }
  const invalide = voix.find((intervalle) => intervalle.fin < intervalle.debut);
  if (invalide) {
    throw new Error(
      `intervalle de voix inversé : ${invalide.debut} → ${invalide.fin}`,
    );
  }
  const attenuation = fusionner(voix, 2 * rampe).reduce(
    (maximum, intervalle) =>
      Math.max(maximum, profondeur(frame, intervalle, rampe)),
    0,
  );
  return base + (sousVoix - base) * attenuation;
};
