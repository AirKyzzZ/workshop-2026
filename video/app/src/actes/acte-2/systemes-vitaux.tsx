import type React from "react";
import { useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, courbes } from "../../composants/charte/commun";
import { Jauge } from "../../composants/charte/jauge";
import { FondScene } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BAIES, COUPE, CoupeVaisseau } from "./coupe-vaisseau";

const COTE_JAUGE = 320;

const SYSTEMES = [
  { label: "OXYGÈNE", niveau: valeurs.niveauOxygene, debut: 34 },
  { label: "ÉNERGIE", niveau: valeurs.niveauEnergie, debut: 52 },
  { label: "EAU", niveau: valeurs.niveauEau, debut: 70 },
];

const PRINCIPES = [
  { mot: "capteurs", debut: 98 },
  { mot: "seuils", debut: 114 },
  { mot: "redondance", debut: 130 },
];

const Capteurs: React.FC<{ x: number; allumage: number; frame: number }> = ({ x, allumage, frame }) => (
  <>
    {[-1, 1].map((cote) => (
      <div
        key={cote}
        style={{
          position: "absolute",
          left: x + cote * 22 - 5,
          top: 256,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: allumage > 0 ? couleurs.nominal : couleurs.traitClair,
          boxShadow: allumage > 0 ? `0 0 ${8 + 6 * Math.sin(frame / 6 + cote)}px ${alpha(couleurs.nominal, 0.8)}` : undefined,
          opacity: 0.4 + 0.6 * allumage,
        }}
      />
    ))}
  </>
);

export const SystemesVitaux: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("2.1");
  const trace = avance(frame, 0, 46, courbes.bascule);
  const sortie = avance(frame, duree - 18, 16, courbes.bascule);

  return (
    <FondScene>
        <CoupeVaisseau trace={trace} />
        {SYSTEMES.map((s, i) => {
          const p = avance(frame, s.debut - 6, 18);
          return (
            <div key={s.label}>
              <Capteurs x={BAIES[i]} allumage={avance(frame, PRINCIPES[0].debut + i * 3, 10)} frame={frame} />
              <div
                style={{
                  position: "absolute",
                  left: BAIES[i] - COTE_JAUGE / 2,
                  top: COUPE.y - COTE_JAUGE / 2 + 10,
                  opacity: p * (1 - sortie),
                  scale: `${0.94 + 0.06 * p}`,
                }}
              >
                <Jauge
                  forme="arc"
                  label={s.label}
                  depuis={s.niveau}
                  vers={s.niveau}
                  min={0}
                  max={100}
                  seuil={valeurs.seuilSysteme}
                  decimales={0}
                  unite="%"
                  debut={s.debut}
                  largeur={COTE_JAUGE}
                />
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 700,
            display: "flex",
            justifyContent: "center",
            gap: 30,
            fontFamily: polices.donnees,
            fontSize: 28,
            letterSpacing: "0.16em",
            opacity: 1 - sortie,
          }}
        >
          {PRINCIPES.map((p, i) => {
            const e = avance(frame, p.debut, 14);
            return (
              <div key={p.mot} style={{ display: "flex", gap: 30, opacity: e, translate: `0 ${(1 - e) * 12}px` }}>
                {i > 0 ? <span style={{ color: couleurs.texteFaible }}>·</span> : null}
                <span style={{ color: couleurs.texte }}>{p.mot}</span>
              </div>
            );
          })}
        </div>
      {SYSTEMES.map((s) => (
        <Sfx key={s.label} nom="telemetrie-bip" a={s.debut} volume={0.3} />
      ))}
      {PRINCIPES.map((p) => (
        <Sfx key={p.mot} nom="tic-point" a={p.debut} volume={0.3} />
      ))}
    </FondScene>
  );
};
