import type React from "react";
import { interpolate, interpolateColors } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, bloque, courbes } from "../../composants/charte/commun";
import { COQUE, DISPOSITION, HAUTEUR_COMP, LARGEUR_COMP, Y_COURSIVE, type IdCompartiment } from "../../composants/metier/plan-vaisseau";
import { valeurs } from "../../donnees";

export type Vec = { x: number; y: number };
export type CleCamera = { frame: number; cible: Vec; zoom: number; ecran?: Vec };
export type Vue = { versEcran: (p: Vec) => Vec; echelle: number; zoom: number };
export type EtatBord = "nominal" | "repere" | "feu" | "scelle" | "exposition";

export const ECHELLE_PLAN = 0.84;
export const ECRAN_PLAN: Vec = { x: 960, y: 456 };
export const VAISSEAU: Vec = { x: 961, y: 540 };
export const IDS = Object.keys(DISPOSITION) as IdCompartiment[];

const LARGEUR_PORTE = 64;
const COLONNES = [23.8, 209.5];
const RANGEES = [116.7, 159.5, 202.4];
const TITRE = { x: 23.8, y: 64.3, taille: 42 };

export const equipageDe = (id: IdCompartiment): string[] => valeurs.equipageBord[id].map((n) => n.toLowerCase());
export const compartimentDe = (nom: string): IdCompartiment => {
  const id = IDS.find((c) => equipageDe(c).includes(nom.toLowerCase()));
  if (!id) throw new Error(`équipier « ${nom} » absent de equipageBord`);
  return id;
};
export const rangDe = (nom: string) => equipageDe(compartimentDe(nom)).indexOf(nom.toLowerCase());
export const tousLesEquipiers = IDS.flatMap((id) => equipageDe(id).map((nom, rang) => ({ nom, id, rang })));

export const centreDe = (id: IdCompartiment): Vec => ({
  x: DISPOSITION[id].x + LARGEUR_COMP / 2,
  y: DISPOSITION[id].y + HAUTEUR_COMP / 2,
});

export const emplacement = (id: IdCompartiment, rang: number): Vec => ({
  x: DISPOSITION[id].x + COLONNES[rang % 2],
  y: DISPOSITION[id].y + RANGEES[Math.floor(rang / 2)],
});

export const porte = (id: IdCompartiment) => {
  const d = DISPOSITION[id];
  const x = d.x + LARGEUR_COMP / 2;
  return { interieur: { x, y: d.haut ? d.y + HAUTEUR_COMP : d.y }, coursive: { x, y: Y_COURSIVE } };
};

export const trajetEntre = (depuis: IdCompartiment, rangDepuis: number, vers: IdCompartiment, rangVers: number): Vec[] => {
  const a = porte(depuis);
  const b = porte(vers);
  return [emplacement(depuis, rangDepuis), a.interieur, a.coursive, b.coursive, b.interieur, emplacement(vers, rangVers)];
};

export const surPolyligne = (points: Vec[], t: number): Vec => {
  const longueurs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let reste = Math.min(1, Math.max(0, t)) * longueurs.reduce((s, l) => s + l, 0);
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) {
      const u = longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * u, y: points[i].y + (points[i + 1].y - points[i].y) * u };
    }
    reste -= longueurs[i];
  }
  return points[points.length - 1];
};

export const vueA = (cles: CleCamera[], frame: number): Vue => {
  const suivante = cles.findIndex((c) => c.frame > frame);
  const a = suivante === -1 ? cles[cles.length - 1] : cles[Math.max(0, suivante - 1)];
  const b = suivante <= 0 ? a : cles[suivante];
  const t = a === b ? 0 : courbes.bascule(interpolate(frame, [a.frame, b.frame], [0, 1], bloque));
  const melange = (u: number, v: number) => u + (v - u) * t;
  const ea = a.ecran ?? ECRAN_PLAN;
  const eb = b.ecran ?? ECRAN_PLAN;
  const zoom = a.zoom * Math.pow(b.zoom / a.zoom, t);
  const cible = { x: melange(a.cible.x, b.cible.x), y: melange(a.cible.y, b.cible.y) };
  const ecran = { x: melange(ea.x, eb.x), y: melange(ea.y, eb.y) };
  const echelle = ECHELLE_PLAN * zoom;
  return {
    zoom,
    echelle,
    versEcran: (p) => ({ x: ecran.x + (p.x - cible.x) * echelle, y: ecran.y + (p.y - cible.y) * echelle }),
  };
};

const transformPlan = (vue: Vue) => {
  const o = vue.versEcran({ x: 0, y: 0 });
  return `translate(${o.x} ${o.y}) scale(${vue.echelle})`;
};

export const DefsBord: React.FC<{ frame: number }> = ({ frame }) => (
  <defs>
    <pattern id="bord-hachures" width={28} height={28} patternUnits="userSpaceOnUse" patternTransform={`rotate(45) translate(${(frame * 0.8) % 28} 0)`}>
      <rect width={8} height={28} fill={couleurs.critique} />
    </pattern>
    <pattern id="bord-scelle" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={1.5} height={14} fill={alpha(couleurs.texte, 0.22)} />
    </pattern>
    <radialGradient id="bord-chaleur">
      <stop offset="0" stopColor={couleurs.critique} stopOpacity={0.5} />
      <stop offset="1" stopColor={couleurs.critique} stopOpacity={0} />
    </radialGradient>
    <radialGradient id="bord-exposition">
      <stop offset="0" stopColor={couleurs.attention} stopOpacity={0.28} />
      <stop offset="1" stopColor={couleurs.attention} stopOpacity={0} />
    </radialGradient>
    <filter id="bord-lueur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="flou" />
      <feMerge>
        <feMergeNode in="flou" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

export const CoqueBord: React.FC<{ vue: Vue; trace?: number; interieur?: number }> = ({ vue, trace = 1, interieur = 1 }) => (
  <g transform={transformPlan(vue)}>
    <path
      d={COQUE}
      fill={alpha(couleurs.panneau, 0.5 * trace)}
      stroke={couleurs.traitClair}
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - trace}
    />
    <path
      d={COQUE}
      fill="none"
      stroke={alpha(couleurs.texte, 0.06)}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      transform="translate(960 540) scale(0.985 0.972) translate(-960 -540)"
      opacity={trace}
    />
    <g opacity={interieur}>
      <rect x={220} y={Y_COURSIVE - 12} width={1440} height={24} rx={12} fill={alpha(couleurs.texte, 0.05)} stroke={couleurs.trait} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {IDS.map((id) => {
        const p = porte(id);
        return (
          <rect
            key={id}
            x={p.coursive.x - 12}
            y={Math.min(p.interieur.y, p.coursive.y)}
            width={24}
            height={Math.abs(p.coursive.y - p.interieur.y)}
            fill={alpha(couleurs.texte, 0.05)}
            stroke={couleurs.trait}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  </g>
);

const COULEUR_ETAT: Record<EtatBord, string> = {
  nominal: couleurs.traitClair,
  repere: couleurs.nominal,
  feu: couleurs.critique,
  scelle: couleurs.texte,
  exposition: couleurs.attention,
};

export type CompartimentBordProps = {
  vue: Vue;
  id: IdCompartiment;
  frame: number;
  p?: number;
  etat?: EtatBord;
  pEtat?: number;
  fermeture?: number;
  eclat?: number;
  libelle?: { texte: string; p: number; plein?: boolean };
};

export const CompartimentBord: React.FC<CompartimentBordProps> = ({ vue, id, frame, p = 1, etat = "nominal", pEtat = 1, fermeture = 0, eclat = 0, libelle }) => {
  const d = DISPOSITION[id];
  const o = vue.versEcran({ x: d.x, y: d.y });
  const l = LARGEUR_COMP * vue.echelle;
  const h = HAUTEUR_COMP * vue.echelle;
  const pulsation = 0.5 + 0.5 * Math.sin(frame / 4);
  const couleurTrait = interpolateColors(pEtat, [0, 1], [couleurs.traitClair, COULEUR_ETAT[etat]]);
  const porteEcran = vue.versEcran(porte(id).interieur);
  const demiPorte = (LARGEUR_PORTE / 2) * vue.echelle;
  const tailleTitre = TITRE.taille * Math.sqrt(vue.zoom);
  const couleurLibelle = etat === "nominal" ? couleurs.texteDoux : COULEUR_ETAT[etat];
  const largeurLibelle = libelle ? libelle.texte.length * 16.8 + 34 : 0;
  const yLibelle = d.haut ? o.y : o.y + h;

  return (
    <g opacity={p}>
      <rect x={o.x} y={o.y} width={l} height={h} fill={couleurs.panneau} />
      {etat === "repere" ? <rect x={o.x} y={o.y} width={l} height={h} fill={alpha(couleurs.nominal, 0.08 * pEtat)} /> : null}
      {etat === "feu" ? (
        <g opacity={pEtat}>
          <rect x={o.x} y={o.y} width={l} height={h} fill={alpha(couleurs.critique, 0.1 + 0.08 * pulsation)} />
          <rect x={o.x} y={o.y} width={l} height={h} fill="url(#bord-chaleur)" opacity={0.5 + 0.5 * pulsation} />
          <rect x={o.x} y={o.y} width={l} height={h} fill="url(#bord-hachures)" opacity={0.08} />
        </g>
      ) : null}
      {etat === "exposition" ? (
        <g opacity={pEtat}>
          <rect x={o.x} y={o.y} width={l} height={h} fill="url(#bord-exposition)" />
        </g>
      ) : null}
      {etat === "scelle" ? (
        <g opacity={pEtat}>
          <rect x={o.x} y={o.y} width={l} height={h} fill={alpha(couleurs.fond, 0.62)} />
          <rect x={o.x} y={o.y} width={l} height={h} fill="url(#bord-scelle)" />
        </g>
      ) : null}
      {eclat > 0 ? <rect x={o.x} y={o.y} width={l} height={h} fill={alpha(couleurs.texte, 0.06 * eclat)} /> : null}
      <rect x={o.x} y={o.y} width={l} height={h} fill="none" stroke={couleurTrait} strokeWidth={etat === "nominal" ? 1.5 : 2.5} />
      <rect x={porteEcran.x - demiPorte} y={porteEcran.y - 3} width={demiPorte * 2} height={6} fill={couleurs.fond} />
      {fermeture > 0 ? (
        <>
          <line x1={porteEcran.x - demiPorte} y1={porteEcran.y} x2={porteEcran.x - demiPorte + demiPorte * fermeture} y2={porteEcran.y} stroke={couleurs.critique} strokeWidth={6} />
          <line x1={porteEcran.x + demiPorte} y1={porteEcran.y} x2={porteEcran.x + demiPorte - demiPorte * fermeture} y2={porteEcran.y} stroke={couleurs.critique} strokeWidth={6} />
        </>
      ) : null}
      <text
        x={o.x + TITRE.x * vue.echelle}
        y={o.y + TITRE.y * vue.echelle}
        fill={couleurs.texte}
        fontFamily={polices.display}
        fontWeight={500}
        fontSize={tailleTitre}
        letterSpacing="0.02em"
      >
        {valeurs.compartiments[id]}
      </text>
      {etat === "nominal" || etat === "repere" ? (
        <circle cx={o.x + l - 26 * vue.echelle} cy={o.y + 40 * vue.echelle} r={6} fill={couleurs.nominal} opacity={0.55 + 0.45 * Math.cos(frame / 12 + d.x)} />
      ) : null}
      {libelle && libelle.p > 0 ? (
        <g opacity={libelle.p}>
          <rect
            x={o.x + 24}
            y={yLibelle - 21}
            width={largeurLibelle}
            height={42}
            fill={libelle.plein ? couleurLibelle : couleurs.fond}
            stroke={couleurLibelle}
            strokeWidth={libelle.plein ? 0 : 1.5}
            opacity={libelle.plein ? 0.85 + 0.15 * Math.sin(frame / 3) : 1}
          />
          <text
            x={o.x + 24 + largeurLibelle / 2}
            y={yLibelle + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={libelle.plein ? couleurs.fond : couleurLibelle}
            fontFamily={polices.donnees}
            fontWeight={libelle.plein ? 600 : 400}
            fontSize={tailles.etiquette}
          >
            {libelle.texte}
          </text>
        </g>
      ) : null}
    </g>
  );
};

export type EquipierBordProps = {
  vue: Vue;
  nom: string;
  position: Vec;
  p?: number;
  couleur?: string;
  onde?: number;
  opaciteNom?: number;
  eteint?: number;
};

export const EquipierBord: React.FC<EquipierBordProps> = ({ vue, nom, position, p = 1, couleur = couleurs.texte, onde = 0, opaciteNom = 1, eteint = 0 }) => {
  if (p <= 0) return null;
  const e = vue.versEcran(position);
  const taille = tailles.etiquette * Math.pow(vue.zoom, 0.3);
  return (
    <g opacity={p * (1 - 0.6 * eteint)}>
      {onde > 0 && onde < 1 ? <circle cx={e.x} cy={e.y} r={8 + onde * 34} fill="none" stroke={couleur} strokeWidth={2} opacity={1 - onde} /> : null}
      <circle cx={e.x} cy={e.y} r={7 * Math.min(1, p * 1.4) * Math.pow(vue.zoom, 0.2)} fill={couleur} />
      <text
        x={e.x + 16 * Math.pow(vue.zoom, 0.3)}
        y={e.y}
        fill={couleur === couleurs.texte ? couleurs.texteDoux : couleur}
        stroke={couleurs.panneau}
        strokeWidth={8}
        strokeLinejoin="round"
        paintOrder="stroke"
        fontFamily={polices.donnees}
        fontSize={taille}
        dominantBaseline="central"
        opacity={opaciteNom}
      >
        {nom}
      </text>
    </g>
  );
};

export const StatutBarre: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 104,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 40,
      fontFamily: polices.donnees,
      fontSize: tailles.etiquette,
      letterSpacing: "0.08em",
      whiteSpace: "pre",
      opacity: p,
      translate: `0 ${(1 - p) * -10}px`,
    }}
  >
    {children}
  </div>
);

export const CachePlan: React.FC<{ cotes?: boolean; bas?: boolean }> = ({ cotes = false, bas = false }) => (
  <>
    {bas ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          bottom: 0,
          background: `linear-gradient(to bottom, ${alpha(couleurs.fond, 0)} 0px, ${alpha(couleurs.fond, 0.92)} 110px, ${couleurs.fond} 100%)`,
        }}
      />
    ) : null}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 150,
        background: `linear-gradient(to bottom, ${couleurs.fond} 0px, ${couleurs.fond} 104px, ${alpha(couleurs.fond, 0)} 150px)`,
      }}
    />
    {cotes ? (
      <>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 140, background: `linear-gradient(to right, ${couleurs.fond}, ${alpha(couleurs.fond, 0)})` }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 140, background: `linear-gradient(to left, ${couleurs.fond}, ${alpha(couleurs.fond, 0)})` }} />
      </>
    ) : null}
  </>
);
