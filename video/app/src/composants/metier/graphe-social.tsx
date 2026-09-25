import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { AMORTI, alpha, couleurNiveau, progression, type Niveau } from "./commun";

export type NatureLien = "affinite" | "neutre" | "hostile";
export type NoeudSocial = { id: string; nom: string; x: number; y: number; allumage?: { frame: number; niveau: Niveau } };
export type LienSocial = {
  de: string;
  vers: string;
  force: number;
  nature: NatureLien;
  bascule?: { frame: number; libelle?: string };
};

export type GrapheSocialProps = {
  noeuds: NoeudSocial[];
  liens: LienSocial[];
  largeur: number;
  hauteur: number;
  debut?: number;
  intervalle?: number;
};

const RAYON = 34;
const DUREE_TRACE = 18;
const DUREE_BASCULE = 24;

const COULEUR_NATURE: Record<NatureLien, string> = {
  affinite: couleurs.nominal,
  neutre: couleurs.traitClair,
  hostile: couleurs.critique,
};

export const GrapheSocial: React.FC<GrapheSocialProps> = ({ noeuds, liens, largeur, hauteur, debut = 0, intervalle = 4 }) => {
  const frame = useCurrentFrame();
  const parId = new Map(noeuds.map((n) => [n.id, n]));
  const absent = liens.flatMap((l) => [l.de, l.vers]).find((id) => !parId.has(id));
  if (absent) throw new Error(`GrapheSocial : lien vers le nœud inconnu « ${absent} »`);

  const position = (n: NoeudSocial) => ({ x: n.x * largeur, y: n.y * hauteur });
  const debutLiens = debut + noeuds.length * intervalle + 6;

  return (
    <svg width={largeur} height={hauteur} style={{ overflow: "visible" }}>
      <defs>
        <filter id="graphe-lueur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="flou" />
          <feMerge>
            <feMergeNode in="flou" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {liens.map((l, j) => {
        const a = position(parId.get(l.de) as NoeudSocial);
        const b = position(parId.get(l.vers) as NoeudSocial);
        const longueur = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / longueur;
        const uy = (b.y - a.y) / longueur;
        const depart = { x: a.x + ux * (RAYON + 6), y: a.y + uy * (RAYON + 6) };
        const arrivee = { x: b.x - ux * (RAYON + 6), y: b.y - uy * (RAYON + 6) };
        const pTrace = progression(frame, debutLiens + j * intervalle, DUREE_TRACE, AMORTI);
        if (pTrace <= 0) return null;
        const pBascule = l.bascule ? progression(frame, l.bascule.frame, DUREE_BASCULE) : 0;
        const couleur = interpolateColors(pBascule, [0, 1], [COULEUR_NATURE[l.nature], couleurs.critique]);
        const epaisseur = 1.5 + l.force * 4 + pBascule * 2;
        const opacite = interpolate(pBascule, [0, 1], [0.35 + l.force * 0.55, 1]);
        const impulsion = l.bascule ? progression(frame, l.bascule.frame, DUREE_BASCULE, AMORTI) : 0;
        const milieu = { x: (depart.x + arrivee.x) / 2, y: (depart.y + arrivee.y) / 2 };
        const pEtiquette = l.bascule?.libelle ? progression(frame, l.bascule.frame + DUREE_BASCULE - 6, 14) : 0;
        const largeurEtiquette = (l.bascule?.libelle?.length ?? 0) * 15.4 + 32;
        return (
          <g key={`${l.de}-${l.vers}`}>
            <path
              d={`M ${depart.x} ${depart.y} L ${arrivee.x} ${arrivee.y}`}
              stroke={couleur}
              strokeWidth={epaisseur}
              strokeLinecap="round"
              opacity={opacite}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - pTrace}
              filter={pBascule > 0 ? "url(#graphe-lueur)" : undefined}
            />
            {l.bascule && impulsion > 0 && impulsion < 1 ? (
              <circle
                cx={depart.x + (arrivee.x - depart.x) * impulsion}
                cy={depart.y + (arrivee.y - depart.y) * impulsion}
                r={7}
                fill={couleurs.blanc}
                filter="url(#graphe-lueur)"
              />
            ) : null}
            {pEtiquette > 0 && l.bascule?.libelle ? (
              <g opacity={pEtiquette} style={{ translate: `0px ${interpolate(pEtiquette, [0, 1], [8, 0])}px` }}>
                <rect
                  x={milieu.x - largeurEtiquette / 2}
                  y={milieu.y - 22}
                  width={largeurEtiquette}
                  height={44}
                  fill={couleurs.fond}
                  stroke={couleurs.critique}
                  strokeWidth={1.5}
                />
                <text
                  x={milieu.x}
                  y={milieu.y + 1}
                  fill={couleurs.critique}
                  fontFamily={polices.donnees}
                  fontSize={24}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {l.bascule.libelle}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {noeuds.map((n, i) => {
        const { x, y } = position(n);
        const pEntree = progression(frame, debut + i * intervalle, 16);
        if (pEntree <= 0) return null;
        const pAllumage = n.allumage ? progression(frame, n.allumage.frame, 14) : 0;
        const onde = n.allumage ? progression(frame, n.allumage.frame, 30) : 0;
        const teinte = n.allumage ? couleurNiveau(n.allumage.niveau) : couleurs.traitClair;
        const anneau = interpolateColors(pAllumage, [0, 1], [couleurs.traitClair, teinte]);
        return (
          <g key={n.id} style={{ opacity: pEntree, scale: String(interpolate(pEntree, [0, 1], [0.6, 1])), transformOrigin: `${x}px ${y}px` }}>
            {n.allumage && onde > 0 && onde < 1 ? (
              <circle cx={x} cy={y} r={RAYON + onde * 46} fill="none" stroke={teinte} strokeWidth={2} opacity={1 - onde} />
            ) : null}
            <circle cx={x} cy={y} r={RAYON} fill={interpolateColors(pAllumage, [0, 1], [couleurs.panneau, alpha(teinte, 0.18)])} stroke={anneau} strokeWidth={2 + pAllumage} />
            <text
              x={x}
              y={y + 3}
              fill={couleurs.texte}
              fontFamily={polices.display}
              fontWeight={500}
              fontSize={42}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {n.nom.charAt(0).toUpperCase()}
            </text>
            <text
              x={x}
              y={y + RAYON + 30}
              fill={pAllumage > 0 ? anneau : couleurs.texteDoux}
              stroke={couleurs.fond}
              strokeWidth={10}
              strokeLinejoin="round"
              paintOrder="stroke"
              fontFamily={polices.donnees}
              fontSize={24}
              textAnchor="middle"
            >
              {n.nom}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
