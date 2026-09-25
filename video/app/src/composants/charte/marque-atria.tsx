import type React from "react";
import { useId } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "./commun";
import { useTraceSvg } from "./trace-svg";

export type MarqueAtriaProps = {
  debut?: number;
  duree?: number;
  taille?: number;
  nom?: boolean;
  baseline?: string;
  couleur?: string;
  anneau?: boolean;
};

export const MarqueAtria: React.FC<MarqueAtriaProps> = ({
  debut = 0,
  duree = 60,
  taille = 300,
  nom = true,
  baseline,
  couleur = couleurs.blanc,
  anneau = true,
}) => {
  const frame = useCurrentFrame();
  const decoupe = useId().replace(/[^\w-]/g, "");
  const marque = useTraceSvg("brand/atria-mark.svg");
  const logotype = useTraceSvg("brand/atria-wordmark.svg");
  if (!marque || !logotype) return null;

  const t = (debutRelatif: number, dureeRelative: number, courbe = courbes.entree) =>
    avance(frame, debut + debutRelatif * duree, dureeRelative * duree, courbe);
  const cercle = t(0, 0.5, courbes.bascule);
  const pieces = t(0.12, 0.55);
  const contre = t(0.42, 0.35);
  const nette = t(0.1, 0.5);
  const [corps, triangle, bol] = marque.formes;
  const cx = marque.largeur / 2;
  const cy = marque.hauteur / 2;
  const largeurNom = taille * (logotype.largeur / marque.largeur);
  const rayonAnneau = marque.largeur * 0.62;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width={taille}
        height={taille * (marque.hauteur / marque.largeur)}
        viewBox={`0 0 ${marque.largeur} ${marque.hauteur}`}
        style={{
          overflow: "visible",
          filter: `blur(${(1 - nette) * 10}px) drop-shadow(0 0 ${taille * 0.08}px ${alpha(couleur, 0.08 * nette)})`,
        }}
      >
        {anneau ? (
          <g opacity={interpolate(cercle, [0, 0.1], [0, 1], bloque) * (nom ? 1 - t(0.5, 0.3, courbes.bascule) : 1)}>
            <circle
              cx={cx}
              cy={cy}
              r={rayonAnneau}
              fill="none"
              stroke={alpha(couleurs.texte, 0.35)}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray={`${cercle} 1`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            {[0, 90, 180, 270].map((angle) => (
              <line
                key={angle}
                x1={cx}
                y1={cy - rayonAnneau - marque.largeur * 0.035}
                x2={cx}
                y2={cy - rayonAnneau + marque.largeur * 0.035}
                stroke={alpha(couleurs.texte, 0.7)}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                transform={`rotate(${angle} ${cx} ${cy})`}
                opacity={interpolate(cercle, [0.25 + angle / 720, 0.45 + angle / 720], [0, 1], bloque)}
              />
            ))}
          </g>
        ) : null}
        <g fill={couleur}>
          <g transform={`rotate(${(1 - pieces) * -28} ${cx} ${cy})`} opacity={pieces}>
            <path d={corps} transform={marque.transform} />
          </g>
          <g transform={`rotate(${(1 - pieces) * 28} ${cx} ${cy})`} opacity={pieces}>
            <path d={bol} transform={marque.transform} />
          </g>
          <g
            transform={`translate(${cx} ${cy * 0.92}) scale(${interpolate(contre, [0, 1], [0.6, 1])}) translate(${-cx} ${-cy * 0.92})`}
            opacity={contre}
          >
            <path d={triangle} transform={marque.transform} />
          </g>
        </g>
      </svg>
      {nom ? (
        <svg
          width={largeurNom}
          height={largeurNom * (logotype.hauteur / logotype.largeur)}
          viewBox={`0 0 ${logotype.largeur} ${logotype.hauteur}`}
          style={{ marginTop: taille * 0.1 }}
        >
          <defs>
            <clipPath id={decoupe}>
              <rect x={0} y={0} width={logotype.largeur} height={logotype.hauteur} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${decoupe})`} fill={couleur}>
            {logotype.formes.map((lettre, i) => {
              const p = avance(frame, debut + duree * 0.5 + i * 3, duree * 0.4);
              return (
                <g key={lettre.slice(0, 16)} transform={`translate(0 ${(1 - p) * logotype.hauteur})`}>
                  <path d={lettre} transform={logotype.transform} />
                </g>
              );
            })}
          </g>
        </svg>
      ) : null}
      {baseline ? (
        <div
          style={{
            marginTop: taille * 0.1,
            fontFamily: polices.donnees,
            fontSize: Math.max(tailles.etiquette, Math.round(taille * 0.085)),
            letterSpacing: `${interpolate(t(0.75, 0.4), [0, 1], [0.6, 0.26])}em`,
            paddingLeft: `${interpolate(t(0.75, 0.4), [0, 1], [0.6, 0.26])}em`,
            color: couleurs.texteDoux,
            opacity: t(0.75, 0.4),
            whiteSpace: "nowrap",
          }}
        >
          {baseline}
        </div>
      ) : null}
    </div>
  );
};
