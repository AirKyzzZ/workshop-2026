import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { Grain, Vignette } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";

const DEBUT_FRAPPE = 3;
const PAR_CARACTERE = 0.62;
const SEPARATEUR = " · ";

const SEGMENTS = [
  `VAISSEAU ${valeurs.vaisseau}`,
  `AN ${valeurs.annee}`,
  `${valeurs.distanceAl} ANNÉES-LUMIÈRE DE LA TERRE`,
  `${valeurs.aBord} À BORD`,
];

const LIGNE = SEGMENTS.join(SEPARATEUR);
const DEPARTS = SEGMENTS.map((_, i) => SEGMENTS.slice(0, i).reduce((n, s) => n + s.length + SEPARATEUR.length, 0));

export const Telemetrie: React.FC = () => {
  const frame = useCurrentFrame();
  const tapes = Math.max(0, Math.min(LIGNE.length, Math.floor((frame - DEBUT_FRAPPE) / PAR_CARACTERE)));
  const finFrappe = DEBUT_FRAPPE + LIGNE.length * PAR_CARACTERE;
  const regle = avance(frame, 0, 24, courbes.bascule);
  const curseurVisible = frame < finFrappe || Math.floor(frame / 8) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond, justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 10,
              height: 10,
              backgroundColor: couleurs.nominal,
              boxShadow: `0 0 14px ${alpha(couleurs.nominal, 0.7)}`,
              opacity: interpolate(frame, [0, 3], [0, 1], bloque) * (0.6 + 0.4 * Math.cos(frame / 5)),
            }}
          />
          <div style={{ height: 1, flex: 1, backgroundColor: alpha(couleurs.texte, 0.18), scale: `${regle} 1`, transformOrigin: "left" }} />
        </div>
        <div
          style={{
            fontFamily: polices.donnees,
            fontSize: 28,
            lineHeight: 1,
            letterSpacing: "0.02em",
            whiteSpace: "pre",
            paddingLeft: 26,
          }}
        >
          {[...LIGNE].map((c, i) => (
            <span
              key={i}
              style={{
                color: i >= tapes ? "transparent" : c === "·" ? couleurs.texteFaible : i === tapes - 1 ? couleurs.blanc : couleurs.texte,
              }}
            >
              {c}
            </span>
          ))}
          <span
            style={{
              position: "absolute",
              marginLeft: `calc(${tapes - LIGNE.length} * (1ch + 0.02em))`,
              display: "inline-block",
              width: 16,
              height: 30,
              translate: "0 -2px",
              backgroundColor: couleurs.texte,
              opacity: curseurVisible ? 0.85 : 0,
            }}
          />
        </div>
      </div>
      <Vignette force={0.4} />
      <Grain opacite={0.05} />
      <Sfx nom="grondement-vaisseau" a={0} volume={(f) => interpolate(f, [0, 20], [0, 0.55], bloque)} />
      {DEPARTS.map((d) => (
        <Sfx key={d} nom="telemetrie-bip" a={DEBUT_FRAPPE + d * PAR_CARACTERE} volume={0.32} />
      ))}
    </AbsoluteFill>
  );
};
