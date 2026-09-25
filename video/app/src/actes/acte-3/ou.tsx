import type React from "react";
import { random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import {
  alpha,
  avance,
  courbes,
  type Etat,
} from "../../composants/charte/commun";
import { Lecture } from "../../composants/charte/lecture";
import { Rush } from "../../composants/charte/rush";
import {
  COQUE,
  DISPOSITION,
  HAUTEUR_COMP,
  LARGEUR_COMP,
  type IdCompartiment,
} from "../../composants/metier/plan-vaisseau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { Panneau } from "./visee";
import { VueAtria } from "./vue-atria";

const ECHELLE_PLAN = 0.34;
const ORIGINE_PLAN = { x: 170, y: 160 };
const SERRE: IdCompartiment = "serre";
const DUREE = framesDe("3.3");
const DEBUT_PLAN = 2;
const ALLUMAGE = 14;
const DEBUT_LECTURES = [0.16, 0.26, 0.36, 0.45].map((f) =>
  Math.round(DUREE * f),
);

const LECTURES: {
  label: string;
  valeur: number;
  unite?: string;
  decimales: number;
  etat?: Etat;
}[] = [
  {
    label: "Température",
    valeur: Number(valeurs.temperature.replace(",", ".")),
    unite: "°C",
    decimales: 1,
  },
  { label: "Humidité", valeur: valeurs.humidite, unite: "%", decimales: 0 },
  {
    label: "Bruit",
    valeur: valeurs.bruitDb,
    unite: "dB",
    decimales: 0,
    etat: "attention",
  },
  { label: "Fumée", valeur: valeurs.fumee, decimales: 0, etat: "nominal" },
];

const Trace: React.FC<{ graine: string; p: number; couleur: string }> = ({
  graine,
  p,
  couleur,
}) => {
  const frame = useCurrentFrame();
  const points = Array.from({ length: 40 }, (_, i) => {
    const k = i + Math.floor(frame / 3);
    const v =
      0.5 +
      0.28 * Math.sin(k * 0.45 + random(graine) * 6) +
      0.18 * (random(`${graine}-${k}`) - 0.5);
    return `${i * 8 - ((frame / 3) % 1) * 8},${34 - v * 28}`;
  });
  return (
    <svg
      width={312}
      height={40}
      style={{
        display: "block",
        marginTop: 18,
        opacity: p,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
      }}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={alpha(couleur, 0.7)}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const Ou: React.FC = () => {
  const frame = useCurrentFrame();
  const plan = avance(frame, DEBUT_PLAN, 18, courbes.bascule);
  const allume = avance(frame, ALLUMAGE, 10);
  const serre = DISPOSITION[SERRE];
  const onde = ((frame - ALLUMAGE) / 40) % 1;

  return (
    <VueAtria id="3.3" couche={2} voile={0.25} serre={{ vitesse: 0.6 }}>
      <Panneau x={110} y={190} largeur={616} p={avance(frame, 0, 10)}>
        <svg
          width={560}
          height={270}
          style={{ display: "block", overflow: "visible" }}
        >
          <g
            transform={`scale(${ECHELLE_PLAN}) translate(${-ORIGINE_PLAN.x} ${-ORIGINE_PLAN.y})`}
          >
            <path
              d={COQUE}
              fill="none"
              stroke={alpha(couleurs.texte, 0.5)}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - plan}
            />
            {(Object.keys(DISPOSITION) as IdCompartiment[]).map((id) => {
              const d = DISPOSITION[id];
              const actif = id === SERRE;
              return (
                <rect
                  key={id}
                  x={d.x}
                  y={d.y}
                  width={LARGEUR_COMP}
                  height={HAUTEUR_COMP}
                  fill={
                    actif
                      ? alpha(couleurs.nominal, 0.16 * allume)
                      : alpha(couleurs.panneau, 0.6)
                  }
                  stroke={
                    actif && allume > 0 ? couleurs.nominal : couleurs.traitClair
                  }
                  strokeWidth={actif ? 2.5 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  opacity={plan}
                />
              );
            })}
            {allume > 0 ? (
              <circle
                cx={serre.x + LARGEUR_COMP / 2}
                cy={serre.y + HAUTEUR_COMP / 2}
                r={40 + onde * 260}
                fill="none"
                stroke={couleurs.nominal}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                opacity={(1 - onde) * 0.6 * allume}
              />
            ) : null}
          </g>
          <text
            x={(serre.x - ORIGINE_PLAN.x) * ECHELLE_PLAN + 18}
            y={(serre.y - ORIGINE_PLAN.y) * ECHELLE_PLAN + 40}
            fill={couleurs.nominal}
            fontFamily={polices.donnees}
            fontSize={tailles.etiquette}
            letterSpacing="0.08em"
            opacity={allume}
          >
            {valeurs.compartimentScene}
          </text>
        </svg>
      </Panneau>

      <Panneau
        x={1110}
        y={190}
        largeur={700}
        titre="NŒUD RÉACTEUR · ÉCRAN RÉEL"
        p={avance(frame, 6, 12)}
      >
        <div
          style={{
            position: "relative",
            width: 644,
            height: 262,
            overflow: "hidden",
            borderRadius: 4,
          }}
        >
          <Rush
            nom="lcd-reacteur"
            debut={40}
            vitesse={0.7}
            etalonnage="saturate(0.9) contrast(1.08) brightness(0.85)"
            vignette={0.25}
          />
        </div>
      </Panneau>

      <Panneau
        x={110}
        y={524}
        largeur={1700}
        p={avance(frame, DEBUT_LECTURES[0] - 8, 10)}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {LECTURES.map((l, i) => (
            <div key={l.label} style={{ width: 380 }}>
              <Lecture
                label={l.label}
                valeur={l.valeur}
                unite={l.unite}
                decimales={l.decimales}
                etat={l.etat}
                taille={76}
                debut={DEBUT_LECTURES[i]}
                duree={16}
              />
              <Trace
                graine={l.label}
                p={avance(frame, DEBUT_LECTURES[i] + 10, 12)}
                couleur={
                  l.etat === "attention" ? couleurs.attention : couleurs.texte
                }
              />
            </div>
          ))}
        </div>
      </Panneau>

      <Sfx nom="telemetrie-bip" a={ALLUMAGE} volume={0.3} />
      {LECTURES.map((l, i) => (
        <Sfx
          key={l.label}
          nom="tic-point"
          a={DEBUT_LECTURES[i]}
          volume={0.28}
        />
      ))}
    </VueAtria>
  );
};
