import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, nombreFr, progression } from "./commun";

export type SegmentMemoire = { nom: string; taille: number };

export type BarreMemoireProps = {
  capacite: number;
  segments: SegmentMemoire[];
  unite: string;
  libelleLibre: string;
  titre?: string;
  debut?: number;
  intervalle?: number;
  largeur?: number;
};

const PALIER = 50;
const HAUTEUR_BARRE = 76;
const ECART = 3;
const DUREE_REMPLISSAGE = 16;

export const BarreMemoire: React.FC<BarreMemoireProps> = ({
  capacite,
  segments,
  unite,
  libelleLibre,
  titre,
  debut = 0,
  intervalle = 14,
  largeur = 1600,
}) => {
  const frame = useCurrentFrame();
  const total = segments.reduce((s, m) => s + m.taille, 0);
  if (total > capacite) throw new Error(`BarreMemoire : ${total} ${unite} de modèles pour ${capacite} ${unite} de capacité`);

  const echelle = largeur / capacite;
  const yBarre = 90 + segments.length * PALIER;
  const hauteur = yBarre + HAUTEUR_BARRE + 70;
  const debutSegment = (i: number) => debut + 16 + i * intervalle;
  const debutLibre = debutSegment(segments.length) + 6;
  const pCadre = progression(frame, debut, 18);
  const libre = capacite - total;
  const xLibre = total * echelle;
  const pLibre = progression(frame, debutLibre, 20);
  const utilise = segments.reduce((s, m, i) => s + m.taille * progression(frame, debutSegment(i), DUREE_REMPLISSAGE), 0);

  let cumul = 0;
  const places = segments.map((m, i) => {
    const x0 = cumul * echelle;
    cumul += m.taille;
    return { ...m, i, x0, x1: cumul * echelle };
  });

  return (
    <svg width={largeur} height={hauteur} style={{ overflow: "visible" }}>
      <defs>
        <pattern id="memoire-libre" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={2} height={16} fill={alpha(couleurs.nominal, 0.35)} />
        </pattern>
      </defs>

      <g opacity={pCadre}>
        {titre ? (
          <text x={0} y={30} fill={couleurs.texteDoux} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.06em">
            {titre}
          </text>
        ) : null}
        <text x={largeur} y={30} fill={couleurs.texte} fontFamily={polices.donnees} fontSize={32} textAnchor="end">
          {nombreFr(utilise)}
          <tspan fill={couleurs.texteFaible}>
            {" "}
            / {nombreFr(capacite, 0)} {unite}
          </tspan>
        </text>
        <rect x={0} y={yBarre} width={largeur} height={HAUTEUR_BARRE} fill={couleurs.panneau} stroke={couleurs.trait} strokeWidth={1} />
        {Array.from({ length: Math.round(capacite * 4) + 1 }, (_, k) => {
          const valeur = k / 4;
          const entier = Number.isInteger(valeur);
          const x = valeur * echelle;
          return (
            <g key={k}>
              <line x1={x} y1={yBarre + HAUTEUR_BARRE + 6} x2={x} y2={yBarre + HAUTEUR_BARRE + (entier ? 22 : 13)} stroke={entier ? couleurs.texteDoux : couleurs.traitClair} strokeWidth={1.5} />
              {entier ? (
                <text
                  x={x}
                  y={yBarre + HAUTEUR_BARRE + 54}
                  fill={couleurs.texteFaible}
                  fontFamily={polices.donnees}
                  fontSize={24}
                  textAnchor={k === 0 ? "start" : valeur === capacite ? "end" : "middle"}
                >
                  {valeur === capacite ? `${valeur} ${unite}` : valeur}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      {places.map((s) => {
        const p = progression(frame, debutSegment(s.i), DUREE_REMPLISSAGE);
        if (p <= 0) return null;
        const pEtiquette = progression(frame, debutSegment(s.i) + 4, 14);
        const largeurSegment = Math.max(2, s.x1 - s.x0 - ECART);
        const cx = s.x0 + Math.max(1, (s.x1 - s.x0 - ECART) / 2);
        const yEtiquette = 88 + s.i * PALIER;
        const recent = frame < debutSegment(s.i + 1) + 4;
        return (
          <g key={s.nom}>
            <rect
              x={s.x0}
              y={yBarre}
              width={largeurSegment}
              height={HAUTEUR_BARRE}
              fill={alpha(couleurs.texte, s.i % 2 === 0 ? 0.9 : 0.62)}
              style={{ scale: `${p} 1`, transformOrigin: `${s.x0}px 0px` }}
            />
            <g opacity={pEtiquette}>
              <line x1={cx} y1={yEtiquette + 12} x2={cx} y2={yBarre - 6} stroke={recent ? couleurs.texte : couleurs.traitClair} strokeWidth={1.5} style={{ scale: `1 ${pEtiquette}`, transformOrigin: `0px ${yBarre}px` }} />
              <circle cx={cx} cy={yEtiquette + 12} r={3.5} fill={recent ? couleurs.texte : couleurs.traitClair} />
              <text
                x={cx + 14}
                y={yEtiquette + 20}
                fill={recent ? couleurs.blanc : couleurs.texte}
                fontFamily={polices.interface}
                fontWeight={600}
                fontSize={30}
                style={{ translate: `${interpolate(pEtiquette, [0, 1], [-10, 0])}px 0px` }}
              >
                {s.nom}
                <tspan fill={couleurs.texteDoux} fontFamily={polices.donnees} fontWeight={400} fontSize={24} dx={16}>
                  {nombreFr(s.taille)} {unite}
                </tspan>
              </text>
            </g>
          </g>
        );
      })}

      {pLibre > 0 ? (
        <g opacity={pLibre}>
          <rect
            x={xLibre}
            y={yBarre}
            width={largeur - xLibre}
            height={HAUTEUR_BARRE}
            fill="url(#memoire-libre)"
            stroke={couleurs.nominal}
            strokeWidth={2}
            style={{ scale: `${pLibre} 1`, transformOrigin: `${xLibre}px 0px` }}
          />
          <text
            x={xLibre + (largeur - xLibre) / 2}
            y={yBarre + HAUTEUR_BARRE / 2 + 4}
            fill={couleurs.nominal}
            fontFamily={polices.display}
            fontWeight={600}
            fontSize={64}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ textShadow: `0 0 18px ${alpha(couleurs.fond, 1)}` }}
          >
            {nombreFr(libre * pLibre, 1)} {unite} {libelleLibre}
          </text>
        </g>
      ) : null}
    </svg>
  );
};
