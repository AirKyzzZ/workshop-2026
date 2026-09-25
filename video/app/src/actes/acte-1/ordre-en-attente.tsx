import type React from "react";
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, bloque, brouiller, courbes, versSecondes } from "../../composants/charte/commun";
import { MarqueAtria } from "../../composants/charte/marque-atria";
import { Rembobinage } from "../../composants/charte/rembobinage";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { secondesDebutSerre } from "../acte-3/commun";
import { PlanSerre } from "./embrouille";
import { OrdreCommandant } from "./ordre";

const DEBUT_REMBOBINAGE = 92;
const FIN_OVERLAY = DEBUT_REMBOBINAGE - 4;

export const OrdreEnAttente: React.FC = () => {
  const frame = useCurrentFrame();
  const dureeRembobinage = framesDe("1.4") - DEBUT_REMBOBINAGE - 14;
  const finRembobinage = DEBUT_REMBOBINAGE + dureeRembobinage;
  const bascule = Math.round(DEBUT_REMBOBINAGE + dureeRembobinage * 0.3);
  const derniereOrdre = framesDe("1.3") - 1;
  const desature = avance(frame, 0, 18);
  const overlay = avance(frame, 6, 18) * (1 - avance(frame, FIN_OVERLAY, 10, courbes.bascule));
  const texte = avance(frame, 26, 24);
  const recul = versSecondes(valeurs.heureOrdre) - secondesDebutSerre;
  const imageOrdre = Math.round(interpolate(frame, [DEBUT_REMBOBINAGE, bascule], [derniereOrdre, 0], bloque));
  const imageSerre = Math.round(interpolate(frame, [bascule, finRembobinage], [framesDe("1.2") - 1, 0], { ...bloque, easing: courbes.bascule }));

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <Rembobinage heureDepart={valeurs.heureOrdre} recul={recul} duree={dureeRembobinage} debut={DEBUT_REMBOBINAGE} bas={300}>
        {frame < bascule ? (
          <AbsoluteFill style={{ filter: `saturate(${1 - 0.9 * desature}) brightness(${1 - 0.62 * desature * (1 - avance(frame, DEBUT_REMBOBINAGE, 10))})` }}>
            <Freeze frame={imageOrdre}>
              <OrdreCommandant />
            </Freeze>
          </AbsoluteFill>
        ) : (
          <Freeze frame={imageSerre}>
            <PlanSerre lieu={false} />
          </Freeze>
        )}
      </Rembobinage>

      <AbsoluteFill style={{ backgroundColor: couleurs.blanc, opacity: interpolate(frame, [0, 2, 12], [0.16, 0.16, 0], bloque) }} />

      <AbsoluteFill style={{ opacity: overlay, background: `radial-gradient(ellipse 34% 40% at 50% 44%, ${alpha(couleurs.fond, 0.92)} 0%, ${alpha(couleurs.fond, 0.6)} 55%, transparent 100%)` }} />
      <AbsoluteFill style={{ opacity: overlay, justifyContent: "center", alignItems: "center", paddingBottom: 150 }}>
        <div style={{ scale: `${interpolate(frame, [0, FIN_OVERLAY + 10], [1, 1.06], bloque)}` }}>
          <MarqueAtria nom={false} taille={170} debut={6} duree={36} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 44 }}>
          <div
            style={{
              width: 12,
              height: 12,
              backgroundColor: couleurs.attention,
              boxShadow: `0 0 16px ${alpha(couleurs.attention, 0.7)}`,
              opacity: texte * (0.55 + 0.45 * Math.cos(frame / 5)),
            }}
          />
          <div style={{ fontFamily: polices.donnees, fontWeight: 600, fontSize: 36, letterSpacing: "0.22em", color: couleurs.attention, whiteSpace: "pre" }}>
            {brouiller("ORDRE EN ATTENTE", texte, frame, "ordre-attente")}
          </div>
        </div>
      </AbsoluteFill>

      <Sfx nom="pulsation" a={0} volume={0.45} />
      <Sfx nom="telemetrie-bip" a={26} volume={0.3} />
      <Sfx nom="rembobinage" a={DEBUT_REMBOBINAGE} volume={0.55} />
      <Sfx nom="whoosh" a={finRembobinage - 20} volume={0.25} />
    </AbsoluteFill>
  );
};
