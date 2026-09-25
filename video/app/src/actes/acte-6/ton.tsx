import type React from "react";
import { interpolate, interpolateColors, random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes, formaterNombre } from "../../composants/charte/commun";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { VueAvenir } from "./vue-avenir";

const PREMIERE = 14;
const PAS = 42;
const DUREE_REPLIQUE = 26;
const BARRE = { x: 400, y: 646, largeur: 1120 };
const TON_DEPART = 0.08;
const NOEUDS = [
  { x: 250, y: 330 },
  { x: 1670, y: 330 },
];
const HAUTS = [194, 306, 418];

const DIALOGUE = valeurs.dialogue;
const INTERLOCUTEURS = [...new Set(DIALOGUE.map((r) => r.qui))];
if (INTERLOCUTEURS.length !== 2) throw new Error(`le dialogue de 6.2 attend 2 interlocuteurs, reçu ${INTERLOCUTEURS.length}`);

const debutReplique = (i: number) => PREMIERE + i * PAS;

const couleurTon = (v: number) =>
  interpolateColors(v, [-0.6, -0.3, 0, 0.4], [couleurs.critique, couleurs.attention, couleurs.texte, couleurs.nominal]);

const qualifier = (v: number) => (v < -0.15 ? "NÉGATIF" : v > 0.15 ? "POSITIF" : "NEUTRE");

const tonA = (frame: number) =>
  DIALOGUE.reduce(
    (v, r, i) => interpolate(avance(frame, debutReplique(i) + 10, 22, courbes.bascule), [0, 1], [v, r.ton], bloque),
    TON_DEPART,
  );

const Onde: React.FC<{ graine: string; couleur: string; actif: boolean; frame: number }> = ({ graine, couleur, actif, frame }) => (
  <svg width={60} height={36} style={{ flexShrink: 0 }}>
    {Array.from({ length: 10 }, (_, k) => {
      const base = 0.25 + 0.75 * random(`${graine}-${k}`);
      const h = Math.max(3, 32 * base * (actif ? 0.55 + 0.45 * Math.abs(Math.sin(frame / 3 + k)) : 0.35));
      return <rect key={k} x={k * 6} y={18 - h / 2} width={3} height={h} rx={1.5} fill={couleur} />;
    })}
  </svg>
);

export const Ton: React.FC = () => {
  const frame = useCurrentFrame();
  const ton = tonA(frame);
  const couleur = couleurTon(ton);
  const pBarre = avance(frame, 4, 20);
  const centre = BARRE.x + BARRE.largeur / 2;
  const xTon = centre + ton * (BARRE.largeur / 2);

  return (
    <VueAvenir couche={1}>
      {INTERLOCUTEURS.map((nom, i) => {
        const n = NOEUDS[i];
        const parle = DIALOGUE.some((r, k) => r.qui === nom && frame >= debutReplique(k) && frame < debutReplique(k) + DUREE_REPLIQUE);
        const p = avance(frame, i * 4, 18);
        const anneau = parle ? ((frame % 24) / 24) : 0;
        return (
          <div key={nom} style={{ position: "absolute", left: n.x - 60, top: n.y - 60, width: 120, display: "flex", flexDirection: "column", alignItems: "center", opacity: p, scale: `${0.85 + 0.15 * p}` }}>
            <div
              style={{
                position: "relative",
                width: 120,
                height: 120,
                borderRadius: 60,
                border: `2px solid ${parle ? couleurs.texte : couleurs.traitClair}`,
                backgroundColor: alpha(couleurs.panneau, 0.9),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: polices.display,
                fontWeight: 500,
                fontSize: 64,
                paddingTop: 8,
                boxSizing: "border-box",
                color: couleurs.texte,
              }}
            >
              {nom.charAt(0)}
              {anneau > 0 ? (
                <div style={{ position: "absolute", inset: -2, borderRadius: 62, border: `2px solid ${couleurs.texte}`, opacity: 1 - anneau, scale: `${1 + anneau * 0.35}` }} />
              ) : null}
            </div>
            <div style={{ marginTop: 18, fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.06em", color: couleurs.texteDoux }}>{nom.toLowerCase()}</div>
          </div>
        );
      })}

      {DIALOGUE.map((r, i) => {
        const p = avance(frame, debutReplique(i), 18);
        const gauche = r.qui === INTERLOCUTEURS[0];
        const pTon = avance(frame, debutReplique(i) + 12, 16);
        const c = couleurTon(r.ton);
        return (
          <div
            key={r.texte}
            style={{
              position: "absolute",
              top: HAUTS[i],
              left: gauche ? 400 : undefined,
              right: gauche ? undefined : 1920 - 1520,
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "20px 28px",
              backgroundColor: alpha(couleurs.panneau, 0.92),
              border: `1px solid ${alpha(couleurs.texte, 0.12)}`,
              borderLeft: gauche ? `3px solid ${interpolateColors(pTon, [0, 1], [alpha(couleurs.texte, 0.3), c])}` : undefined,
              borderRight: gauche ? undefined : `3px solid ${interpolateColors(pTon, [0, 1], [alpha(couleurs.texte, 0.3), c])}`,
              opacity: p,
              translate: `${(gauche ? -1 : 1) * (1 - p) * 30}px 0`,
              clipPath: gauche ? `inset(-2px ${(1 - p) * 100}% -2px -4px)` : `inset(-2px -4px -2px ${(1 - p) * 100}%)`,
            }}
          >
            <Onde graine={r.texte} couleur={interpolateColors(pTon, [0, 1], [couleurs.texteDoux, c])} actif={frame < debutReplique(i) + DUREE_REPLIQUE} frame={frame} />
            <div style={{ fontFamily: polices.interface, fontWeight: 600, fontSize: 36, lineHeight: 1.2, color: couleurs.texte, whiteSpace: "nowrap" }}>{r.texte}</div>
            <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: c, opacity: pTon, minWidth: 90, textAlign: "right" }}>{formaterNombre(r.ton, 2).replace("-", "−")}</div>
          </div>
        );
      })}

      <div style={{ position: "absolute", left: BARRE.x, top: BARRE.y - 84, width: BARRE.largeur, display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: pBarre }}>
        <div style={{ fontFamily: polices.interface, fontWeight: 600, fontSize: tailles.etiquette, letterSpacing: "0.14em", color: couleurs.texteDoux }}>CONVERSATION</div>
        <div style={{ fontFamily: polices.donnees, fontSize: 40, letterSpacing: "0.04em", color: couleur, whiteSpace: "pre" }}>
          {`TON · ${qualifier(ton)} · ${formaterNombre(ton, 2).replace("-", "−")}`}
        </div>
      </div>
      <svg width={BARRE.largeur + 40} height={90} style={{ position: "absolute", left: BARRE.x - 20, top: BARRE.y - 20, overflow: "visible", opacity: pBarre }}>
        <g transform="translate(20 20)">
          <rect x={0} y={0} width={BARRE.largeur} height={10} fill={couleurs.panneauClair} style={{ scale: `${pBarre} 1`, transformOrigin: `${BARRE.largeur / 2}px 0px` }} />
          <rect
            x={Math.min(xTon, centre) - BARRE.x}
            y={0}
            width={Math.abs(xTon - centre)}
            height={10}
            fill={couleur}
            style={{ filter: `drop-shadow(0 0 10px ${alpha(couleur, 0.6)})` }}
          />
          <line x1={BARRE.largeur / 2} y1={-10} x2={BARRE.largeur / 2} y2={20} stroke={couleurs.texteDoux} strokeWidth={2} />
          <rect x={xTon - BARRE.x - 2} y={-12} width={4} height={34} fill={couleurs.blanc} />
          {[
            { x: 0, texte: "NÉGATIF", ancre: "start" as const, c: couleurs.critique },
            { x: BARRE.largeur / 2, texte: "0", ancre: "middle" as const, c: couleurs.texteFaible },
            { x: BARRE.largeur, texte: "POSITIF", ancre: "end" as const, c: couleurs.nominal },
          ].map((g) => (
            <text key={g.texte} x={g.x} y={58} fill={g.c} fontFamily={polices.donnees} fontSize={tailles.etiquette} textAnchor={g.ancre} opacity={0.8}>
              {g.texte}
            </text>
          ))}
        </g>
      </svg>

      {DIALOGUE.map((r, i) => (
        <Sfx key={r.texte} nom="tic-point" a={debutReplique(i)} volume={0.22} />
      ))}
      <Sfx nom="pulsation" a={debutReplique(DIALOGUE.length - 1) + 22} volume={0.3} />
    </VueAvenir>
  );
};
