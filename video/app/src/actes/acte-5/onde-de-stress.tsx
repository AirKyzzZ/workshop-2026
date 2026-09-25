import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { FicheIdentite } from "../../composants/charte/fiche-identite";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { nombreFr } from "../../composants/metier/commun";
import { GrapheSocial, type LienSocial, type NoeudSocial } from "../../composants/metier/graphe-social";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";

const GRAPHE = { x: 150, y: 214, largeur: 920, hauteur: 470 };
const RAYON = 34;
const CRAQUE = 40;
const DEBUT_ONDE = 50;
const DUREE_SAUT = 22;
const FICHE = 78;
const X_FICHE = 1122;

const SOURCE = valeurs.equipierCraque.toLowerCase();
const CIBLE = valeurs.equipierTouche.toLowerCase();

const NOEUDS: NoeudSocial[] = [
  { id: SOURCE, nom: SOURCE, x: 0.3, y: 0.52, allumage: { frame: CRAQUE, niveau: "critique" } },
  { id: CIBLE, nom: CIBLE, x: 0.56, y: 0.28, allumage: { frame: DEBUT_ONDE + DUREE_SAUT, niveau: "attention" } },
  { id: "bianchi", nom: "bianchi", x: 0.8, y: 0.08 },
  { id: "novak", nom: "novak", x: 0.98, y: 0.44 },
  { id: "leroy", nom: "leroy", x: 0.06, y: 0.12 },
  { id: "roux", nom: "roux", x: 0.32, y: 0.0 },
  { id: "blanc", nom: "blanc", x: 0.0, y: 0.66 },
  { id: "rossi", nom: "rossi", x: 0.14, y: 0.98 },
  { id: "bernard", nom: "bernard", x: 0.4, y: 0.94 },
  { id: "lambert", nom: "lambert", x: 0.62, y: 0.68 },
  { id: "reyes", nom: "reyes", x: 0.88, y: 0.8 },
  { id: "dubois", nom: "dubois", x: 0.7, y: 1.0 },
];

const LIENS: LienSocial[] = [
  { de: SOURCE, vers: CIBLE, force: 0.8, nature: "affinite" },
  { de: CIBLE, vers: "bianchi", force: 0.6, nature: "affinite" },
  { de: "bianchi", vers: "novak", force: 0.55, nature: "affinite" },
  { de: SOURCE, vers: "leroy", force: 0.35, nature: "hostile" },
  { de: "leroy", vers: "roux", force: 0.5, nature: "hostile" },
  { de: "leroy", vers: "blanc", force: 0.45, nature: "hostile" },
  { de: "rossi", vers: "bernard", force: 0.7, nature: "affinite" },
  { de: SOURCE, vers: "bernard", force: 0.2, nature: "neutre" },
  { de: CIBLE, vers: "lambert", force: 0.25, nature: "neutre" },
  { de: "lambert", vers: "reyes", force: 0.6, nature: "affinite" },
  { de: "reyes", vers: "dubois", force: 0.5, nature: "affinite" },
  { de: "dubois", vers: "lambert", force: 0.4, nature: "affinite" },
];

const ONDE = [
  { de: SOURCE, vers: CIBLE, intensite: 1 },
  { de: CIBLE, vers: "bianchi", intensite: 0.55 },
  { de: "bianchi", vers: "novak", intensite: 0.3 },
];

const positionDe = (id: string) => {
  const n = NOEUDS.find((m) => m.id === id);
  if (!n) throw new Error(`nœud inconnu : ${id}`);
  return { x: n.x * GRAPHE.largeur, y: n.y * GRAPHE.hauteur };
};

export const OndeDeStress: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.6");
  const cible = positionDe(CIBLE);
  const pLiaison = avance(frame, FICHE - 4, 18, courbes.bascule);

  return (
    <FondScene>
      <BarreCommandement p={1} />
      <Derive duree={duree} amplitude={0.012}>
        <div style={{ position: "absolute", left: GRAPHE.x, top: GRAPHE.y }}>
          <GrapheSocial noeuds={NOEUDS} liens={LIENS} largeur={GRAPHE.largeur} hauteur={GRAPHE.hauteur} debut={0} intervalle={1} />
          <svg width={GRAPHE.largeur} height={GRAPHE.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <defs>
              <filter id="onde-stress-lueur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="flou" />
                <feMerge>
                  <feMergeNode in="flou" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {ONDE.map((s, i) => {
              const a = positionDe(s.de);
              const b = positionDe(s.vers);
              const l = Math.hypot(b.x - a.x, b.y - a.y);
              const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
              const depart = { x: a.x + u.x * (RAYON + 6), y: a.y + u.y * (RAYON + 6) };
              const arrivee = { x: b.x - u.x * (RAYON + 6), y: b.y - u.y * (RAYON + 6) };
              const debut = DEBUT_ONDE + i * (DUREE_SAUT + 6);
              const t = avance(frame, debut, DUREE_SAUT, courbes.bascule);
              const trainee = interpolate(frame, [debut, debut + DUREE_SAUT, debut + DUREE_SAUT + 40], [0, 1, 0.35], bloque);
              const eclair = interpolate(frame, [debut + DUREE_SAUT, debut + DUREE_SAUT + 4, debut + DUREE_SAUT + 30], [0, 1, 0], bloque);
              if (t <= 0) return null;
              return (
                <g key={`${s.de}-${s.vers}`} opacity={s.intensite}>
                  <line
                    x1={depart.x}
                    y1={depart.y}
                    x2={depart.x + (arrivee.x - depart.x) * t}
                    y2={depart.y + (arrivee.y - depart.y) * t}
                    stroke={couleurs.attention}
                    strokeWidth={4}
                    strokeLinecap="round"
                    opacity={trainee}
                    filter="url(#onde-stress-lueur)"
                  />
                  {t < 1 ? <circle cx={depart.x + (arrivee.x - depart.x) * t} cy={depart.y + (arrivee.y - depart.y) * t} r={8} fill={couleurs.blanc} filter="url(#onde-stress-lueur)" /> : null}
                  {eclair > 0 ? <circle cx={b.x} cy={b.y} r={RAYON + 6 + (1 - eclair) * 24} fill="none" stroke={couleurs.attention} strokeWidth={2} opacity={eclair} /> : null}
                </g>
              );
            })}
            <line
              x1={cible.x + RAYON + 8}
              y1={cible.y}
              x2={cible.x + RAYON + 8 + (X_FICHE - GRAPHE.x - cible.x - RAYON - 8) * pLiaison}
              y2={cible.y}
              stroke={alpha(couleurs.attention, 0.6)}
              strokeWidth={1.5}
              strokeDasharray="4 6"
            />
          </svg>
        </div>
        <div style={{ position: "absolute", left: X_FICHE, top: GRAPHE.y + cible.y - 150 }}>
          <FicheIdentite
            surtitre="Contagion du stress"
            nom={valeurs.equipierTouche}
            role={valeurs.posteTouche}
            statut={`STRESS PROJETÉ ${nombreFr(valeurs.stressProjete)} · MESURÉ ${nombreFr(valeurs.stressMesure)}`}
            etat="attention"
            debut={FICHE}
            duree={40}
            largeur={712}
          />
        </div>
      </Derive>
      <Sfx nom="pulsation" a={CRAQUE} volume={0.36} />
      {ONDE.map((s, i) => (
        <Sfx key={s.vers} nom="tic-point" a={DEBUT_ONDE + i * (DUREE_SAUT + 6) + DUREE_SAUT} volume={0.34 * s.intensite} />
      ))}
      <Sfx nom="whoosh" a={DEBUT_ONDE} volume={0.12} />
      <Sfx nom="telemetrie-bip" a={FICHE + 20} volume={0.28} />
    </FondScene>
  );
};
