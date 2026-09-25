import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../../charte";
import { alpha, avance, bloque } from "../../composants/charte/commun";
import { EtiquetteTournage } from "../../composants/charte/plan-factice";
import { Grain, Vignette } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { Visee } from "../acte-3/visee";

type Boite = { x: number; y: number; largeur: number; hauteur: number };

const ORIGINE = { x: 960, y: 470 };
const POUSSEE = 0.09;
const PI = { x: 900, y: 440, largeur: 440, hauteur: 290 };
const ARDUINOS = [
  { x: 1470, y: 346, rotation: 7 },
  { x: 1500, y: 606, rotation: -5 },
];
const CAMERA = { x: 400, y: 300 };
const MICRO = { x: 400, y: 560 };

const CIBLES: { boite: Boite; libelle: string; debut: number; principal?: boolean }[] = [
  { boite: { x: 900, y: 446, largeur: 540, hauteur: 370 }, libelle: `${valeurs.carte} · ${valeurs.memoireGo} GO`, debut: 22, principal: true },
  { boite: { x: 1486, y: 474, largeur: 380, hauteur: 510 }, libelle: `${valeurs.arduinos} ARDUINO`, debut: 52 },
  { boite: { x: 400, y: 440, largeur: 320, hauteur: 440 }, libelle: "CAMÉRA · MICRO", debut: 80 },
];

const Arduino: React.FC<{ x: number; y: number; rotation: number }> = ({ x, y, rotation }) => (
  <div style={{ position: "absolute", left: x - 140, top: y - 105, width: 280, height: 210, rotate: `${rotation}deg` }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "linear-gradient(135deg, #16808C 0%, #0B5E69 100%)", boxShadow: "0 18px 30px rgba(0,0,0,0.55)" }} />
    <div style={{ position: "absolute", left: -18, top: 26, width: 64, height: 52, borderRadius: 3, background: "linear-gradient(180deg, #C9CDD1, #7D8388)" }} />
    <div style={{ position: "absolute", left: -8, top: 140, width: 50, height: 42, borderRadius: 4, backgroundColor: "#111" }} />
    <div style={{ position: "absolute", left: 90, top: 10, width: 170, height: 16, backgroundColor: "#141414" }} />
    <div style={{ position: "absolute", left: 120, top: 184, width: 140, height: 16, backgroundColor: "#141414" }} />
    <div style={{ position: "absolute", left: 100, top: 120, width: 150, height: 36, borderRadius: 2, backgroundColor: "#1A1A1A" }} />
    <div style={{ position: "absolute", left: 70, top: 56, width: 34, height: 34, backgroundColor: "#222", rotate: "45deg" }} />
  </div>
);

const Cable: React.FC<{ d: string }> = ({ d }) => (
  <>
    <path d={d} fill="none" stroke="#070707" strokeWidth={12} strokeLinecap="round" />
    <path d={d} fill="none" stroke="#2A2A2A" strokeWidth={8} strokeLinecap="round" />
    <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2} strokeLinecap="round" transform="translate(-2 -2)" />
  </>
);

const Table: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ backgroundColor: "#0B0A09" }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 42% 30%, #2B2723 0%, #161412 55%, #0A0908 100%)" }} />
    <div
      style={{
        position: "absolute",
        left: 170,
        top: 90,
        width: 1600,
        height: 920,
        rotate: "-1.5deg",
        borderRadius: 6,
        backgroundColor: "#18251E",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 40px)",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
      }}
    />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 55% at 45% 35%, rgba(255, 236, 205, 0.1) 0%, transparent 70%)" }} />
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <Cable d={`M ${PI.x + 220} ${PI.y - 60} C 1240 360, 1270 300, ${ARDUINOS[0].x - 150} ${ARDUINOS[0].y - 60}`} />
      <Cable d={`M ${PI.x + 220} ${PI.y + 10} C 1260 520, 1300 600, ${ARDUINOS[1].x - 150} ${ARDUINOS[1].y - 60}`} />
      <Cable d={`M ${PI.x - 220} ${PI.y - 40} C 700 330, 620 250, ${CAMERA.x + 130} ${CAMERA.y}`} />
      <Cable d={`M ${PI.x - 220} ${PI.y + 60} C 700 560, 600 600, ${MICRO.x + 80} ${MICRO.y}`} />
      <Cable d={`M ${PI.x - 80} ${PI.y + 150} C 820 800, 760 900, 700 1100`} />
    </svg>
    <div style={{ position: "absolute", left: PI.x - PI.largeur / 2, top: PI.y - PI.hauteur / 2, width: PI.largeur, height: PI.hauteur, rotate: "-4deg" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "linear-gradient(135deg, #1F7A4A 0%, #135E37 100%)", boxShadow: "0 22px 40px rgba(0,0,0,0.6)" }} />
      {[
        [16, 16],
        [PI.largeur - 34, 16],
        [16, PI.hauteur - 34],
        [PI.largeur - 34, PI.hauteur - 34],
      ].map(([l, t]) => (
        <div key={`${l}-${t}`} style={{ position: "absolute", left: l, top: t, width: 18, height: 18, borderRadius: 9, backgroundColor: "#0B0A09", boxShadow: "0 0 0 4px #C8B26A" }} />
      ))}
      <div style={{ position: "absolute", left: 50, top: 14, width: 300, height: 30, backgroundColor: "#121212", backgroundImage: "radial-gradient(circle, #C9A94E 3px, transparent 3.5px)", backgroundSize: "15px 15px" }} />
      <div style={{ position: "absolute", left: 110, top: 104, width: 86, height: 86, borderRadius: 4, background: "linear-gradient(135deg, #D4D8DC, #8C9297)" }} />
      <div style={{ position: "absolute", left: 214, top: 110, width: 64, height: 74, borderRadius: 3, backgroundColor: "#1B1B1B" }} />
      <div style={{ position: "absolute", left: 298, top: 196, width: 44, height: 44, borderRadius: 3, backgroundColor: "#202020" }} />
      <div style={{ position: "absolute", left: PI.largeur - 60, top: 30, width: 96, height: 70, borderRadius: 4, background: "linear-gradient(180deg, #D0D4D8, #858B90)" }} />
      <div style={{ position: "absolute", left: PI.largeur - 60, top: 112, width: 96, height: 62, borderRadius: 4, background: "linear-gradient(180deg, #2E5BD0, #1A3A91)" }} />
      <div style={{ position: "absolute", left: PI.largeur - 60, top: 186, width: 96, height: 62, borderRadius: 4, background: "linear-gradient(180deg, #2E5BD0, #1A3A91)" }} />
      {[70, 150, 230].map((l) => (
        <div key={l} style={{ position: "absolute", left: l, top: PI.hauteur - 18, width: 42, height: 26, borderRadius: 3, background: "linear-gradient(180deg, #C9CDD1, #7D8388)" }} />
      ))}
      <div style={{ position: "absolute", left: 360, top: 70, width: 8, height: 8, borderRadius: 4, backgroundColor: "#6CFF9B", boxShadow: "0 0 12px #6CFF9B", opacity: 0.6 + 0.4 * Math.cos(frame / 6) }} />
    </div>
    {ARDUINOS.map((a) => (
      <Arduino key={a.y} {...a} />
    ))}
    <div style={{ position: "absolute", left: CAMERA.x - 125, top: CAMERA.y - 45, width: 250, height: 90, rotate: "6deg" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 45, background: "linear-gradient(180deg, #2A2A2A, #0F0F0F)", boxShadow: "0 16px 30px rgba(0,0,0,0.6)" }} />
      <div style={{ position: "absolute", left: 125 - 34, top: 45 - 34, width: 68, height: 68, borderRadius: 34, background: "radial-gradient(circle at 38% 35%, #5A6B7C 0%, #0B0F14 55%, #000 100%)", boxShadow: "0 0 0 5px #3A3A3A" }} />
      <div style={{ position: "absolute", left: 200, top: 38, width: 10, height: 10, borderRadius: 5, backgroundColor: "#7CFF6B", boxShadow: "0 0 10px #7CFF6B" }} />
    </div>
    <div style={{ position: "absolute", left: MICRO.x - 95, top: MICRO.y - 95, width: 190, height: 190 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 95, backgroundColor: "#111", boxShadow: "0 18px 34px rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "absolute",
          inset: 22,
          borderRadius: 80,
          backgroundColor: "#1C1212",
          backgroundImage: "radial-gradient(circle, rgba(255,90,70,0.55) 1.6px, transparent 2px)",
          backgroundSize: "9px 9px",
          boxShadow: "0 0 40px rgba(255, 70, 50, 0.35)",
        }}
      />
    </div>
  </AbsoluteFill>
);

export const Installation: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("7.1");
  const echelle = interpolate(frame, [0, duree], [1, 1 + POUSSEE], bloque);
  const derive = { x: interpolate(frame, [0, duree], [0, -18], bloque), y: interpolate(frame, [0, duree], [0, -8], bloque) };
  const versEcran = (x: number, y: number) => ({ x: ORIGINE.x + (x - ORIGINE.x) * echelle + derive.x, y: ORIGINE.y + (y - ORIGINE.y) * echelle + derive.y });

  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.fond, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale: `${echelle}`,
          translate: `${derive.x}px ${derive.y}px`,
          transformOrigin: `${ORIGINE.x}px ${ORIGINE.y}px`,
          filter: "blur(1.1px) saturate(0.85) contrast(1.05)",
        }}
      >
        <Table frame={frame} />
      </AbsoluteFill>
      <Vignette force={0.7} />
      <AbsoluteFill style={{ backgroundColor: alpha(couleurs.fond, 0.18) }} />
      {CIBLES.map((c) => {
        const centre = versEcran(c.boite.x, c.boite.y);
        return (
          <Visee
            key={c.libelle}
            x={centre.x}
            y={centre.y}
            largeur={c.boite.largeur * echelle}
            hauteur={c.boite.hauteur * echelle}
            p={avance(frame, c.debut, 18)}
            couleur={c.principal ? couleurs.blanc : alpha(couleurs.texte, 0.75)}
            coin={c.principal ? 34 : 26}
            libelle={<span style={{ color: c.principal ? couleurs.blanc : couleurs.texte }}>{c.libelle}</span>}
          />
        );
      })}
      <EtiquetteTournage texte="L'INSTALLATION SUR LA TABLE" />
      <Grain opacite={0.08} />
      {CIBLES.map((c) => (
        <Sfx key={c.libelle} nom="tic-point" a={c.debut + 4} volume={c.principal ? 0.34 : 0.24} />
      ))}
      <Sfx nom="verrouillage" a={CIBLES[0].debut + 8} volume={0.2} />
    </AbsoluteFill>
  );
};
