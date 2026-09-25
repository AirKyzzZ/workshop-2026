import type React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, brouiller, courbes, formaterNombre } from "../../composants/charte/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { VueAvenir } from "./vue-avenir";

const PISTES = { x: 150, largeur: 1020 };
const LIGNES = [322, 462, 602];
const LIBELLES = ["GESTE", "MOT", "VISAGE"];
const X_INSTANTS = [330, 720];
const ECART_PUCE = 40;
const LARGEUR_PUCE = 420;
const VERDICT = { x: 1270, y: 360, largeur: 530 };
const Y_VERDICT = VERDICT.y + 96;

const PHASES = [
  { playhead: 6, puces: 10, liens: 20, verdict: 28, sortie: 58 },
  { playhead: 60, puces: 76, liens: 86, verdict: 94, sortie: 10000 },
];
const DUREE_DEPLACEMENT = 16;

const INSTANTS = valeurs.instants;
if (INSTANTS.length !== 2) throw new Error(`6.3 attend 2 instants, reçu ${INSTANTS.length}`);

const couleurInstant = (i: number) => (i === 0 ? couleurs.nominal : couleurs.critique);

const BLOCS_GESTE = Array.from({ length: 11 }, (_, k) => ({ x: 40 + k * 92 + random(`geste-${k}`) * 40, l: 18 + random(`geste-l-${k}`) * 44 }));
const MOTS = Array.from({ length: 34 }, (_, k) => ({ x: 20 + k * 30 + (Math.floor(k / 5) % 2) * 8, l: 12 + random(`mot-${k}`) * 16 }));
const bosse = (x: number, centre: number, hauteur: number) => hauteur * Math.exp(-((x - centre) ** 2) / (2 * 55 ** 2));
const valenceA = (x: number) => 0.12 * Math.sin((x - PISTES.x) / 48 + 1) + bosse(x, X_INSTANTS[0], 0.8) + bosse(x, X_INSTANTS[1], -0.9);
const VALENCE = Array.from({ length: 103 }, (_, k) => ({ x: k * 10, y: -valenceA(PISTES.x + k * 10) * 42 }));

const Puce: React.FC<{ y: number; x: number; p: number; couleur: string; children: React.ReactNode }> = ({ y, x, p, couleur, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y - 30,
      width: LARGEUR_PUCE,
      height: 60,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      backgroundColor: alpha(couleurs.fond, 0.9),
      border: `1px solid ${alpha(couleur, 0.7)}`,
      borderLeft: `3px solid ${couleur}`,
      opacity: interpolate(p, [0, 0.4], [0, 1], bloque),
      translate: `${(1 - p) * -18}px 0`,
      clipPath: `inset(-2px ${(1 - p) * 100}% -2px -4px)`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

export const PlaisanterieOuMenace: React.FC = () => {
  const frame = useCurrentFrame();
  const pPistes = avance(frame, 0, 16, courbes.bascule);
  const xPlayhead = interpolate(frame, [PHASES[1].playhead, PHASES[1].playhead + DUREE_DEPLACEMENT], X_INSTANTS, { ...bloque, easing: courbes.bascule });
  const phase = frame >= PHASES[1].playhead ? 1 : 0;
  const pPlayhead = avance(frame, PHASES[0].playhead, 12);

  return (
    <VueAvenir couche={2}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="pistes-revele">
            <rect x={PISTES.x - 10} y={0} width={(PISTES.largeur + 20) * pPistes} height={1080} />
          </clipPath>
        </defs>
        <g clipPath="url(#pistes-revele)">
          {LIGNES.map((y) => (
            <line key={y} x1={PISTES.x} y1={y} x2={PISTES.x + PISTES.largeur} y2={y} stroke={alpha(couleurs.texte, 0.14)} strokeWidth={1} />
          ))}
          {BLOCS_GESTE.map((b, k) => (
            <rect key={k} x={PISTES.x + b.x} y={LIGNES[0] - 9} width={b.l} height={18} rx={3} fill={alpha(couleurs.texte, 0.22)} />
          ))}
          {MOTS.map((m, k) => (
            <rect key={k} x={PISTES.x + m.x} y={LIGNES[1] - 7} width={m.l} height={14} rx={2} fill={alpha(couleurs.texte, 0.2)} />
          ))}
          <polyline points={VALENCE.map((p) => `${PISTES.x + p.x},${LIGNES[2] + p.y}`).join(" ")} fill="none" stroke={alpha(couleurs.texte, 0.45)} strokeWidth={2} />
        </g>
        {X_INSTANTS.map((x, i) => {
          const actif = phase === i ? avance(frame, PHASES[i].puces - 6, 12) * (1 - avance(frame, PHASES[i].sortie, 10)) : 0;
          return (
            <g key={x} opacity={actif}>
              <circle cx={x} cy={LIGNES[2] - valenceA(x) * 42} r={7} fill={couleurInstant(i)} />
              <rect x={x - 22} y={LIGNES[0] - 12} width={44} height={24} fill="none" stroke={couleurInstant(i)} strokeWidth={2} />
              <rect x={x - 28} y={LIGNES[1] - 11} width={56} height={22} fill="none" stroke={couleurInstant(i)} strokeWidth={2} />
            </g>
          );
        })}
        <g opacity={pPlayhead}>
          <line x1={xPlayhead} y1={LIGNES[0] - 76} x2={xPlayhead} y2={LIGNES[2] + 64} stroke={couleurs.blanc} strokeWidth={2} />
          <path d={`M ${xPlayhead - 8} ${LIGNES[0] - 84} L ${xPlayhead + 8} ${LIGNES[0] - 84} L ${xPlayhead} ${LIGNES[0] - 74} Z`} fill={couleurs.blanc} />
        </g>
        {PHASES.map((ph, i) => {
          const sortie = avance(frame, ph.sortie, 10);
          return LIGNES.map((y, k) => {
            const p = avance(frame, ph.liens + k * 3, 16, courbes.bascule) * (1 - sortie);
            if (p <= 0) return null;
            const x0 = X_INSTANTS[i] + ECART_PUCE + LARGEUR_PUCE;
            const milieu = (x0 + VERDICT.x) / 2;
            return (
              <path
                key={`${i}-${y}`}
                d={`M ${x0} ${y} C ${milieu} ${y}, ${milieu} ${Y_VERDICT}, ${VERDICT.x} ${Y_VERDICT}`}
                fill="none"
                stroke={couleurInstant(i)}
                strokeWidth={2}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - p}
                opacity={0.8}
              />
            );
          });
        })}
      </svg>

      {LIBELLES.map((l, k) => (
        <div
          key={l}
          style={{
            position: "absolute",
            left: PISTES.x,
            top: LIGNES[k] - 62,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.12em",
            color: couleurs.texteDoux,
            opacity: avance(frame, 4 + k * 4, 14),
          }}
        >
          {l}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: xPlayhead + 18,
          top: LIGNES[0] - 104,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          color: couleurs.texte,
          opacity: pPlayhead,
          whiteSpace: "nowrap",
        }}
      >
        {INSTANTS[phase].heure}
      </div>

      {INSTANTS.map((inst, i) => {
        const ph = PHASES[i];
        const sortie = 1 - avance(frame, ph.sortie, 10);
        const x = X_INSTANTS[i] + ECART_PUCE;
        const c = couleurInstant(i);
        return (
          <div key={inst.heure} style={{ opacity: sortie }}>
            <Puce y={LIGNES[0]} x={x} p={avance(frame, ph.puces, 16)} couleur={c}>
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texte }}>{inst.geste}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: c }}>{formaterNombre(inst.scoreGeste, 2)}</span>
            </Puce>
            <Puce y={LIGNES[1]} x={x} p={avance(frame, ph.puces + 6, 16)} couleur={c}>
              <span style={{ fontFamily: polices.interface, fontWeight: 600, fontSize: 30, color: couleurs.blanc }}>{`« ${valeurs.motAmbigu} »`}</span>
            </Puce>
            <Puce y={LIGNES[2]} x={x} p={avance(frame, ph.puces + 12, 16)} couleur={c}>
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texte }}>{inst.visage}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: c }}>{formaterNombre(inst.scoreVisage, 2)}</span>
            </Puce>
          </div>
        );
      })}

      {INSTANTS.map((inst, i) => {
        const ph = PHASES[i];
        const p = avance(frame, ph.verdict, 18) * (1 - avance(frame, ph.sortie, 10));
        if (p <= 0) return null;
        const c = couleurInstant(i);
        return (
          <div
            key={inst.verdict}
            style={{
              position: "absolute",
              left: VERDICT.x,
              top: VERDICT.y,
              width: VERDICT.largeur,
              boxSizing: "border-box",
              padding: "22px 30px 26px",
              backgroundColor: alpha(couleurs.fond, 0.88),
              border: `2px solid ${c}`,
              boxShadow: `0 0 ${40 * p}px ${alpha(c, 0.25)}`,
              opacity: p,
              scale: `${interpolate(p, [0, 1], [1.05, 1])}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.1em", color: couleurs.texteDoux }}>
              <span>VERDICT</span>
              <span>{inst.heure}</span>
            </div>
            <div style={{ marginTop: 10, fontFamily: polices.display, fontWeight: 600, fontSize: 92, lineHeight: 1, paddingTop: 10, color: c, whiteSpace: "nowrap", textShadow: `0 0 30px ${alpha(c, 0.35)}` }}>
              {brouiller(inst.verdict, p, frame, inst.verdict)}
            </div>
            <div style={{ marginTop: 8, fontFamily: polices.donnees, fontSize: 26, letterSpacing: "0.06em", color: c }}>{inst.detail}</div>
          </div>
        );
      })}

      <Sfx nom="balayage-scan" a={PHASES[0].playhead - 4} volume={(f) => interpolate(f, [0, 20, 50], [0.14, 0.1, 0], bloque)} duree={52} />
      {PHASES.map((ph, i) => (
        <Sfx key={i} nom="tic-point" a={ph.puces} volume={0.24} />
      ))}
      <Sfx nom="verrouillage" a={PHASES[0].verdict} volume={0.26} />
      <Sfx nom="whoosh" a={PHASES[1].playhead} volume={0.14} />
      <Sfx nom="buzzer-refus" a={PHASES[1].verdict} volume={0.22} duree={30} />
    </VueAvenir>
  );
};
