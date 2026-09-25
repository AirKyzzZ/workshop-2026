import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { CaptureReelle } from "../../composants/charte/capture-reelle";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { nombreFr } from "../../composants/metier/commun";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement, COMMANDE } from "../acte-1/ordre";

const TITRE = 4;
const MOTIF = 34;
const PAR_CARACTERE = 1.3;
const REMPLACANT = 122;
const CAPTURE = 56;

const TEXTE_MOTIF = `CONDUITE ${nombreFr(valeurs.conduiteApres)} < SEUIL ${nombreFr(valeurs.seuilConduite)}`;

const Libelle: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <div
    style={{
      fontFamily: polices.donnees,
      fontSize: tailles.etiquette,
      letterSpacing: "0.14em",
      color: couleurs.texteDoux,
      opacity: p,
      marginBottom: 12,
    }}
  >
    {children}
  </div>
);

export const Refus: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("4.2");
  const titre = avance(frame, TITRE, 16, courbes.entree);
  const barre = avance(frame, TITRE + 4, 14, courbes.bascule);
  const tapes = Math.max(0, Math.min(TEXTE_MOTIF.length, Math.floor((frame - MOTIF) / PAR_CARACTERE)));
  const remplacant = avance(frame, REMPLACANT, 18);

  return (
    <FondScene lueur="#221311">
      <AbsoluteFill style={{ backgroundColor: couleurs.critique, opacity: interpolate(frame, [TITRE, TITRE + 2, TITRE + 14], [0, 0.14, 0], bloque) }} />
      <BarreCommandement p={1} />
      <Derive duree={duree} amplitude={0.015}>
        <div style={{ position: "absolute", left: 110, top: 196, width: 860 }}>
          <div style={{ position: "relative", display: "inline-block", fontFamily: polices.donnees, fontSize: 30, color: couleurs.texteDoux, whiteSpace: "pre" }}>
            {COMMANDE}
            <div style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 3, backgroundColor: couleurs.critique, scale: `${barre} 1`, transformOrigin: "left" }} />
          </div>
          <div style={{ overflow: "hidden", marginTop: 16 }}>
            <div
              style={{
                fontFamily: polices.display,
                fontWeight: 600,
                fontSize: 144,
                lineHeight: 0.95,
                paddingTop: 14,
                whiteSpace: "nowrap",
                color: couleurs.critique,
                textShadow: `0 0 50px ${alpha(couleurs.critique, 0.35)}`,
                translate: `0 ${(1 - titre) * 100}%`,
              }}
            >
              ORDRE REFUSÉ
            </div>
          </div>
          <div style={{ marginTop: 34 }}>
            <Libelle p={avance(frame, MOTIF - 8, 10)}>MOTIF</Libelle>
            <div style={{ fontFamily: polices.donnees, fontSize: 38, color: couleurs.texte, whiteSpace: "pre", minHeight: 48 }}>
              {TEXTE_MOTIF.slice(0, tapes)}
              <span style={{ display: "inline-block", width: 18, height: 38, marginLeft: 4, verticalAlign: "-6px", backgroundColor: couleurs.texte, opacity: frame >= MOTIF && tapes < TEXTE_MOTIF.length ? 0.85 : 0 }} />
            </div>
          </div>
          <div
            style={{
              marginTop: 44,
              paddingTop: 26,
              borderTop: `1px solid ${alpha(couleurs.nominal, 0.4 * remplacant)}`,
              opacity: remplacant,
              translate: `0 ${(1 - remplacant) * 20}px`,
            }}
          >
            <Libelle p={1}>REMPLAÇANT PROPOSÉ</Libelle>
            <div style={{ display: "flex", alignItems: "baseline", gap: 30 }}>
              <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 104, lineHeight: 1, color: couleurs.nominal }}>{valeurs.remplacant}</div>
              <div style={{ fontFamily: polices.donnees, fontSize: 34, color: couleurs.nominal }}>{`CAPACITÉ ${nombreFr(valeurs.capaciteRemplacant)}`}</div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 1060, top: 206 }}>
          <CaptureReelle
            capture="bord"
            libelle="CAPTURE RÉELLE · BORD"
            largeur={760}
            cible={{ x: 0.47, y: 0.97 }}
            zoom={[1.05, 2.8]}
            debut={CAPTURE}
            duree={duree - CAPTURE}
            surbrillance={{ x: 0.35, y: 0.885, largeur: 0.3, hauteur: 0.06, debut: CAPTURE + 90 }}
          />
        </div>
      </Derive>
      <Sfx nom="buzzer-refus" a={TITRE} volume={0.5} />
      {Array.from({ length: Math.ceil(TEXTE_MOTIF.length / 3) }, (_, i) => (
        <Sfx key={i} nom="tic-point" a={MOTIF + i * 3 * PAR_CARACTERE} volume={0.12} />
      ))}
      <Sfx nom="whoosh" a={CAPTURE - 4} volume={0.2} />
      <Sfx nom="verrouillage" a={REMPLACANT + 4} volume={0.3} />
    </FondScene>
  );
};
