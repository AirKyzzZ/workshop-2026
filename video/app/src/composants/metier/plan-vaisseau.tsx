import { useMemo } from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs, polices } from "../../charte";
import { ADOUCI, AMORTI, alpha, couleurNiveau, progression, type Niveau } from "./commun";

export type IdCompartiment = "pont" | "infirmerie" | "reacteur" | "serre" | "atelier" | "laboratoire";
export type EtatCompartiment = "nominal" | "feu" | "evacuation" | "scelle" | "exposition";
export type CompartimentPlan = { id: IdCompartiment; nom: string; detail?: string };
export type ChangementEtat = { compartiment: IdCompartiment; etat: EtatCompartiment; frame: number; libelle?: string };
export type EquipierPlan = {
  nom: string;
  trajet: { frame: number; compartiment: IdCompartiment }[];
  alertes?: { frame: number; niveau: Niveau }[];
};
export type CadragePlan = { frame: number; cible: IdCompartiment | "vaisseau"; zoom?: number };

export type PlanVaisseauProps = {
  compartiments: CompartimentPlan[];
  etats?: ChangementEtat[];
  equipage?: EquipierPlan[];
  camera?: CadragePlan[];
  reperes?: { poupe: string; proue: string };
  debut?: number;
  dureeTrajet?: number;
};

type Vec = { x: number; y: number };

const LARGEUR_COMP = 420;
const HAUTEUR_COMP = 250;
const Y_HAUT = 222;
const Y_BAS = 608;
const Y_COURSIVE = 540;
const LARGEUR_PORTE = 64;
const DUREE_TRANSITION = 14;
const COLONNES = [262, 722, 1182];
const DISPOSITION: Record<IdCompartiment, { x: number; y: number; haut: boolean }> = {
  laboratoire: { x: COLONNES[0], y: Y_HAUT, haut: true },
  infirmerie: { x: COLONNES[1], y: Y_HAUT, haut: true },
  pont: { x: COLONNES[2], y: Y_HAUT, haut: true },
  atelier: { x: COLONNES[0], y: Y_BAS, haut: false },
  serre: { x: COLONNES[1], y: Y_BAS, haut: false },
  reacteur: { x: COLONNES[2], y: Y_BAS, haut: false },
};
const COQUE =
  "M 330 160 L 1530 160 C 1600 160 1628 196 1648 250 L 1752 540 L 1648 830 C 1628 884 1600 920 1530 920 L 330 920 C 236 920 170 856 170 762 L 170 318 C 170 224 236 160 330 160 Z";

const COULEUR_ETAT: Record<EtatCompartiment, string> = {
  nominal: couleurs.traitClair,
  feu: couleurs.critique,
  evacuation: couleurs.critique,
  scelle: couleurs.texte,
  exposition: couleurs.attention,
};

const porte = (id: IdCompartiment): { interieur: Vec; coursive: Vec } => {
  const d = DISPOSITION[id];
  const x = d.x + LARGEUR_COMP / 2;
  return {
    interieur: { x, y: d.haut ? d.y + HAUTEUR_COMP : d.y },
    coursive: { x, y: Y_COURSIVE },
  };
};

const emplacement = (id: IdCompartiment, rang: number): Vec => {
  const d = DISPOSITION[id];
  return { x: d.x + 40 + (rang % 2) * 196, y: d.y + 150 + Math.floor(rang / 2) * 40 };
};

const surPolyligne = (points: Vec[], t: number): Vec => {
  const longueurs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = longueurs.reduce((s, l) => s + l, 0);
  let reste = t * total;
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) {
      const u = longueurs[i] ? Math.min(1, reste / longueurs[i]) : 1;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * u, y: points[i].y + (points[i + 1].y - points[i].y) * u };
    }
    reste -= longueurs[i];
  }
  return points[points.length - 1];
};

const centreCible = (cible: IdCompartiment | "vaisseau"): Vec =>
  cible === "vaisseau"
    ? { x: 960, y: 540 }
    : { x: DISPOSITION[cible].x + LARGEUR_COMP / 2, y: DISPOSITION[cible].y + HAUTEUR_COMP / 2 };

const cadrageA = (camera: CadragePlan[], frame: number): { centre: Vec; zoom: number } => {
  const vue = (c: CadragePlan) => ({ centre: centreCible(c.cible), zoom: Math.max(1, c.zoom ?? (c.cible === "vaisseau" ? 1 : 2)) });
  if (camera.length === 0) return { centre: { x: 960, y: 540 }, zoom: 1 };
  const suivante = camera.findIndex((c) => c.frame > frame);
  if (suivante === -1) return vue(camera[camera.length - 1]);
  if (suivante === 0) return vue(camera[0]);
  const a = vue(camera[suivante - 1]);
  const b = vue(camera[suivante]);
  const t = progression(frame, camera[suivante - 1].frame, camera[suivante].frame - camera[suivante - 1].frame, AMORTI);
  return {
    centre: { x: a.centre.x + (b.centre.x - a.centre.x) * t, y: a.centre.y + (b.centre.y - a.centre.y) * t },
    zoom: a.zoom * Math.pow(b.zoom / a.zoom, t),
  };
};

const CoucheEtat: React.FC<{ etat: EtatCompartiment; x: number; y: number; opacite: number; frame: number; motif: string }> = ({
  etat,
  x,
  y,
  opacite,
  frame,
  motif,
}) => {
  if (opacite <= 0 || etat === "nominal") return null;
  const pulsation = 0.5 + 0.5 * Math.sin(frame / 4);
  if (etat === "feu") {
    return (
      <g opacity={opacite}>
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={alpha(couleurs.critique, 0.1 + 0.08 * pulsation)} />
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={`url(#${motif}-chaleur)`} opacity={0.5 + 0.5 * pulsation} />
      </g>
    );
  }
  if (etat === "evacuation") {
    return (
      <g opacity={opacite}>
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={alpha(couleurs.critique, 0.12 + 0.06 * pulsation)} />
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={`url(#${motif}-hachures)`} opacity={0.5} />
      </g>
    );
  }
  if (etat === "scelle") {
    return (
      <g opacity={opacite}>
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={alpha(couleurs.fond, 0.6)} />
        <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={`url(#${motif}-scelle)`} />
      </g>
    );
  }
  const cx = x + LARGEUR_COMP / 2;
  const cy = y + HAUTEUR_COMP / 2;
  return (
    <g opacity={opacite} clipPath={`url(#${motif}-clip-${x}-${y})`}>
      <rect x={x} y={y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={alpha(couleurs.attention, 0.08)} />
      {[0, 1, 2].map((k) => {
        const onde = ((frame / 40 + k / 3) % 1 + 1) % 1;
        return (
          <circle key={k} cx={cx} cy={cy} r={20 + onde * 260} fill="none" stroke={couleurs.attention} strokeWidth={2} opacity={(1 - onde) * 0.5} />
        );
      })}
    </g>
  );
};

export const PlanVaisseau: React.FC<PlanVaisseauProps> = ({
  compartiments,
  etats = [],
  equipage = [],
  camera = [],
  reperes,
  debut = 0,
  dureeTrajet = 36,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const motif = "plan";

  const connus = new Set(compartiments.map((c) => c.id));
  const inconnu = [...etats.map((e) => e.compartiment), ...equipage.flatMap((m) => m.trajet.map((t) => t.compartiment))].find(
    (id) => !connus.has(id),
  );
  if (inconnu) throw new Error(`PlanVaisseau : compartiment « ${inconnu} » absent de la liste des compartiments`);

  const rangs = useMemo(() => {
    const parCompartiment = new Map<IdCompartiment, string[]>();
    equipage.forEach((m) =>
      m.trajet.forEach((t) => {
        const liste = parCompartiment.get(t.compartiment) ?? [];
        if (!liste.includes(m.nom)) liste.push(m.nom);
        parCompartiment.set(t.compartiment, liste);
      }),
    );
    return (id: IdCompartiment, nom: string) => (parCompartiment.get(id) ?? []).indexOf(nom);
  }, [equipage]);

  const vue = cadrageA(camera, frame);
  const echelle = vue.zoom;
  const tx = width / 2 - vue.centre.x * echelle;
  const ty = height / 2 - vue.centre.y * echelle;
  const pCoque = progression(frame, debut, 40, AMORTI);

  const etatsDe = (id: IdCompartiment) =>
    etats.filter((e) => e.compartiment === id && e.frame <= frame).sort((a, b) => a.frame - b.frame);

  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={`${motif}-hachures`} width={28} height={28} patternUnits="userSpaceOnUse" patternTransform={`rotate(45) translate(${(frame * 0.8) % 28} 0)`}>
          <rect width={12} height={28} fill={couleurs.critique} />
        </pattern>
        <pattern id={`${motif}-scelle`} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={1.5} height={14} fill={alpha(couleurs.texte, 0.22)} />
        </pattern>
        <radialGradient id={`${motif}-chaleur`}>
          <stop offset="0" stopColor={couleurs.critique} stopOpacity={0.45} />
          <stop offset="1" stopColor={couleurs.critique} stopOpacity={0} />
        </radialGradient>
        {compartiments.map((c) => {
          const d = DISPOSITION[c.id];
          return (
            <clipPath key={c.id} id={`${motif}-clip-${d.x}-${d.y}`}>
              <rect x={d.x} y={d.y} width={LARGEUR_COMP} height={HAUTEUR_COMP} />
            </clipPath>
          );
        })}
      </defs>

      <g style={{ translate: `${tx}px ${ty}px`, scale: String(echelle), transformOrigin: "0px 0px" }}>
        <path d={COQUE} fill={alpha(couleurs.panneau, 0.5 * pCoque)} stroke={couleurs.traitClair} strokeWidth={1.5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pCoque} />
        <path
          d={COQUE}
          fill="none"
          stroke={alpha(couleurs.texte, 0.06)}
          strokeWidth={1}
          transform="translate(960 540) scale(0.985 0.972) translate(-960 -540)"
          opacity={pCoque}
        />

        <g opacity={progression(frame, debut + 14, 20)}>
          <rect x={220} y={Y_COURSIVE - 12} width={1440} height={24} rx={12} fill={alpha(couleurs.texte, 0.05)} stroke={couleurs.trait} strokeWidth={1} />
          {compartiments.map((c) => {
            const p = porte(c.id);
            return (
              <rect
                key={c.id}
                x={p.coursive.x - 12}
                y={Math.min(p.interieur.y, p.coursive.y)}
                width={24}
                height={Math.abs(p.coursive.y - p.interieur.y)}
                fill={alpha(couleurs.texte, 0.05)}
                stroke={couleurs.trait}
                strokeWidth={1}
              />
            );
          })}
          {reperes ? (
            <>
              <text x={236} y={Y_COURSIVE - 30} fill={couleurs.texteFaible} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.1em">
                {reperes.poupe}
              </text>
              <text x={1644} y={Y_COURSIVE - 30} fill={couleurs.texteFaible} fontFamily={polices.donnees} fontSize={24} letterSpacing="0.1em" textAnchor="end">
                {reperes.proue}
              </text>
            </>
          ) : null}
        </g>

        {compartiments.map((c, i) => {
          const d = DISPOSITION[c.id];
          const pEntree = progression(frame, debut + 10 + i * 4, 22);
          const historique = etatsDe(c.id);
          const actuel = historique[historique.length - 1];
          const precedent = historique[historique.length - 2];
          const etat = actuel?.etat ?? "nominal";
          const etatAvant = precedent?.etat ?? "nominal";
          const pTransition = actuel ? progression(frame, actuel.frame, DUREE_TRANSITION) : 1;
          const couleurTrait = interpolateColors(pTransition, [0, 1], [COULEUR_ETAT[etatAvant], COULEUR_ETAT[etat]]);
          const pScelle = etat === "scelle" && actuel ? progression(frame, actuel.frame, 18, AMORTI) : etatAvant === "scelle" ? 1 - pTransition : 0;
          const p = porte(c.id);
          const libelleEtat = actuel?.libelle;
          const couleurLibelle = COULEUR_ETAT[etat] === couleurs.traitClair ? couleurs.texteDoux : COULEUR_ETAT[etat];
          const badgePlein = etat === "evacuation";
          return (
            <g
              key={c.id}
              style={{ opacity: pEntree, translate: `0px ${interpolate(pEntree, [0, 1], [d.haut ? -14 : 14, 0])}px` }}
            >
              <rect x={d.x} y={d.y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill={couleurs.panneau} />
              <CoucheEtat etat={etatAvant} x={d.x} y={d.y} opacite={1 - pTransition} frame={frame} motif={motif} />
              <CoucheEtat etat={etat} x={d.x} y={d.y} opacite={pTransition} frame={frame} motif={motif} />
              <rect x={d.x} y={d.y} width={LARGEUR_COMP} height={HAUTEUR_COMP} fill="none" stroke={couleurTrait} strokeWidth={etat === "nominal" ? 1.5 : 2.5} />
              <rect x={p.interieur.x - LARGEUR_PORTE / 2} y={p.interieur.y - 3} width={LARGEUR_PORTE} height={6} fill={couleurs.fond} />
              <line x1={p.interieur.x - LARGEUR_PORTE / 2} y1={p.interieur.y} x2={p.interieur.x - LARGEUR_PORTE / 2 + (LARGEUR_PORTE / 2) * pScelle} y2={p.interieur.y} stroke={couleurs.critique} strokeWidth={6} />
              <line x1={p.interieur.x + LARGEUR_PORTE / 2} y1={p.interieur.y} x2={p.interieur.x + LARGEUR_PORTE / 2 - (LARGEUR_PORTE / 2) * pScelle} y2={p.interieur.y} stroke={couleurs.critique} strokeWidth={6} />

              <text x={d.x + 32} y={d.y + 64} fill={couleurs.texte} fontFamily={polices.display} fontWeight={500} fontSize={52} letterSpacing="0.02em">
                {c.nom}
              </text>
              {c.detail ? (
                <text x={d.x + 32} y={d.y + 102} fill={couleurs.texteDoux} fontFamily={polices.donnees} fontSize={24}>
                  {c.detail}
                </text>
              ) : null}
              {etat === "nominal" && !libelleEtat ? (
                <circle cx={d.x + LARGEUR_COMP - 32} cy={d.y + 44} r={6} fill={couleurs.nominal} />
              ) : null}
              {libelleEtat ? (
                <g opacity={pTransition}>
                  <rect
                    x={d.x + 24}
                    y={(d.haut ? d.y : d.y + HAUTEUR_COMP) - 20}
                    width={libelleEtat.length * 15.4 + 32}
                    height={40}
                    fill={badgePlein ? couleurs.critique : couleurs.fond}
                    stroke={couleurLibelle}
                    strokeWidth={badgePlein ? 0 : 1.5}
                    opacity={badgePlein ? 0.8 + 0.2 * Math.sin(frame / 3) : 1}
                  />
                  <text
                    x={d.x + 40}
                    y={(d.haut ? d.y : d.y + HAUTEUR_COMP) + 1}
                    fill={badgePlein ? couleurs.fond : couleurLibelle}
                    fontFamily={polices.donnees}
                    fontWeight={badgePlein ? 600 : 400}
                    fontSize={24}
                    dominantBaseline="central"
                  >
                    {libelleEtat}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {equipage.map((m, i) => {
          if (m.trajet.length === 0) return null;
          const pApparition = progression(frame, debut + 30 + i * 2, 14);
          if (pApparition <= 0) return null;
          const etape = m.trajet.reduce((idx, t, k) => (t.frame <= frame ? k : idx), 0);
          const courant = m.trajet[etape];
          const avant = etape > 0 ? m.trajet[etape - 1] : null;
          const arrivee = emplacement(courant.compartiment, rangs(courant.compartiment, m.nom));
          let position = arrivee;
          let enRoute = false;
          if (avant && avant.compartiment !== courant.compartiment) {
            const t = progression(frame, courant.frame, dureeTrajet, AMORTI);
            const depart = emplacement(avant.compartiment, rangs(avant.compartiment, m.nom));
            const pa = porte(avant.compartiment);
            const pb = porte(courant.compartiment);
            position = surPolyligne([depart, pa.interieur, pa.coursive, pb.coursive, pb.interieur, arrivee], t);
            enRoute = t < 1;
          }
          const alerte = (m.alertes ?? []).filter((a) => a.frame <= frame).sort((a, b) => a.frame - b.frame).pop();
          const pAlerte = alerte ? progression(frame, alerte.frame, 12) : 0;
          const couleur = alerte ? interpolateColors(pAlerte, [0, 1], [couleurs.texte, couleurNiveau(alerte.niveau)]) : couleurs.texte;
          const onde = alerte ? progression(frame, alerte.frame, 24, ADOUCI) : 0;
          return (
            <g key={m.nom} opacity={pApparition}>
              {alerte && onde < 1 ? (
                <circle cx={position.x} cy={position.y} r={8 + onde * 30} fill="none" stroke={couleur} strokeWidth={2} opacity={1 - onde} />
              ) : null}
              <circle cx={position.x} cy={position.y} r={8 * pApparition} fill={couleur} />
              <text
                x={position.x + 18}
                y={position.y}
                fill={alerte ? couleur : couleurs.texteDoux}
                fontFamily={polices.donnees}
                fontSize={24}
                dominantBaseline="central"
                opacity={enRoute ? 0.6 : 1}
              >
                {m.nom}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
