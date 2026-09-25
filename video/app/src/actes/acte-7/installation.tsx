import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque } from "../../composants/charte/commun";
import { Rush } from "../../composants/charte/rush";
import { Grain, Vignette } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";

const ORIGINE = { x: 960, y: 470 };
const POUSSEE = 0.09;
const CIBLES: { libelle: string; debut: number; principal?: boolean }[] = [
  {
    libelle: `${valeurs.carte} · ${valeurs.memoireGo} GO`,
    debut: 6,
    principal: true,
  },
  { libelle: `${valeurs.arduinos} ARDUINO`, debut: 22 },
  { libelle: "CAMÉRA · MICRO", debut: 38 },
];

export const Installation: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("7.1");
  const echelle = interpolate(frame, [0, duree], [1, 1 + POUSSEE], bloque);
  const derive = {
    x: interpolate(frame, [0, duree], [0, -18], bloque),
    y: interpolate(frame, [0, duree], [0, -8], bloque),
  };

  return (
    <AbsoluteFill
      style={{ backgroundColor: couleurs.fond, overflow: "hidden" }}
    >
      <AbsoluteFill
        style={{
          scale: `${echelle}`,
          translate: `${derive.x}px ${derive.y}px`,
          transformOrigin: `${ORIGINE.x}px ${ORIGINE.y}px`,
        }}
      >
        <Rush
          nom="table-installation"
          debut={20}
          vitesse={0.85}
          etalonnage="saturate(0.85) contrast(1.08) brightness(0.8)"
          vignette={0}
        />
      </AbsoluteFill>
      <Vignette force={0.7} />
      <AbsoluteFill style={{ backgroundColor: alpha(couleurs.fond, 0.18) }} />
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 64,
          display: "flex",
          gap: 56,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.12em",
        }}
      >
        {CIBLES.map((c) => (
          <span
            key={c.libelle}
            style={{
              color: c.principal ? couleurs.blanc : couleurs.texte,
              opacity: avance(frame, c.debut, 12),
              translate: `0 ${(1 - avance(frame, c.debut, 12)) * 12}px`,
            }}
          >
            {c.libelle}
          </span>
        ))}
      </div>
      <Grain opacite={0.08} />
      {CIBLES.map((c) => (
        <Sfx
          key={c.libelle}
          nom="tic-point"
          a={c.debut + 4}
          volume={c.principal ? 0.34 : 0.24}
        />
      ))}
      <Sfx nom="verrouillage" a={CIBLES[0].debut + 8} volume={0.2} />
    </AbsoluteFill>
  );
};
