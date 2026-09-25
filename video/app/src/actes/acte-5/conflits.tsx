import type React from "react";
import { useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, brouiller, formaterNombre } from "../../composants/charte/commun";
import { CaptureReelle } from "../../composants/charte/capture-reelle";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";

const ENTETE = 8;
const RANGEES = 20;
const PAS = 14;
const LIEUX = 96;
const PAS_LIEUX = 8;
const CAPTURE = 40;
const MISE_EN_AVANT = 112;
const SEPARER = 160;
const LARGEUR_LISTE = 940;
const LARGEUR_JAUGE = 220;

const PAIRES = [
  { paire: valeurs.pairesHostile, lieu: valeurs.lieuHostile, risque: valeurs.risqueHostile },
  ...valeurs.autresPairesHostiles,
].sort((a, b) => b.risque - a.risque);

const couleurRisque = (r: number) => (r >= 0.75 ? couleurs.critique : r >= 0.5 ? couleurs.attention : couleurs.texteDoux);

const Repere: React.FC<{ couleur: string }> = ({ couleur }) => (
  <svg width={18} height={24} viewBox="0 0 18 24" style={{ flexShrink: 0 }}>
    <path d="M9 23 C9 23 1 13.5 1 8.5 A8 8 0 0 1 17 8.5 C17 13.5 9 23 9 23 Z" fill="none" stroke={couleur} strokeWidth={2} />
    <circle cx={9} cy={8.5} r={3} fill={couleur} />
  </svg>
);

export const Conflits: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.5");
  const pEntete = avance(frame, ENTETE, 14);
  const pSeparer = avance(frame, SEPARER, 14);

  return (
    <FondScene>
      <BarreCommandement p={1} />
      <Derive duree={duree} amplitude={0.012}>
        <div style={{ position: "absolute", left: 110, top: 206, width: LARGEUR_LISTE }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingBottom: 18,
              borderBottom: `1px solid ${couleurs.trait}`,
              fontFamily: polices.donnees,
              fontSize: tailles.etiquette,
              letterSpacing: "0.06em",
              opacity: pEntete,
            }}
          >
            <span style={{ color: couleurs.texteDoux }}>PAIRES HOSTILES</span>
            <span style={{ color: couleurs.texte }}>CLASSÉES PAR RISQUE</span>
          </div>
          {PAIRES.map((p, i) => {
            const entree = avance(frame, RANGEES + i * PAS, 16);
            const jauge = avance(frame, RANGEES + i * PAS + 6, 26);
            const lieu = avance(frame, LIEUX + i * PAS_LIEUX, 18);
            const premier = i === 0;
            const avant = premier ? avance(frame, MISE_EN_AVANT, 14) : 0;
            const couleur = couleurRisque(p.risque);
            return (
              <div
                key={p.paire}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  height: 136,
                  paddingLeft: 26,
                  borderBottom: `1px solid ${couleurs.trait}`,
                  backgroundColor: alpha(couleurs.critique, 0.1 * avant),
                  opacity: entree * (premier ? 1 : 1 - 0.35 * avance(frame, MISE_EN_AVANT, 14)),
                  translate: `${(1 - entree) * -16}px 0`,
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 18, bottom: 18, width: 3, backgroundColor: couleurs.critique, scale: `1 ${avant}`, transformOrigin: "top" }} />
                <div style={{ width: 44, fontFamily: polices.donnees, fontSize: 26, color: couleurs.texteFaible }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 70, lineHeight: 0.9, paddingTop: 8, color: premier ? couleurs.critique : couleurs.texte, whiteSpace: "nowrap" }}>
                    {p.paire}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 34, opacity: lieu, whiteSpace: "pre" }}>
                    <Repere couleur={premier ? couleurs.critique : couleurs.texteDoux} />
                    <span style={{ fontFamily: polices.donnees, fontSize: 26, letterSpacing: "0.08em", color: premier ? couleurs.texte : couleurs.texteDoux }}>
                      {brouiller(p.lieu, lieu, frame, p.lieu)}
                    </span>
                    {premier ? (
                      <span
                        style={{
                          marginLeft: 14,
                          padding: "3px 12px",
                          border: `1px solid ${couleurs.attention}`,
                          backgroundColor: alpha(couleurs.attention, 0.12),
                          fontFamily: polices.donnees,
                          fontSize: tailles.etiquette,
                          letterSpacing: "0.08em",
                          color: couleurs.attention,
                          opacity: pSeparer,
                          translate: `${(1 - pSeparer) * 12}px 0`,
                        }}
                      >
                        À SÉPARER
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ width: LARGEUR_JAUGE, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, paddingRight: 20 }}>
                  <div style={{ fontFamily: polices.donnees, fontSize: 44, lineHeight: 1, color: couleur }}>{formaterNombre(p.risque * jauge, 2)}</div>
                  <div style={{ width: LARGEUR_JAUGE - 20, height: 6, backgroundColor: couleurs.panneauClair }}>
                    <div style={{ width: `${p.risque * 100}%`, height: "100%", backgroundColor: couleur, scale: `${jauge} 1`, transformOrigin: "left", boxShadow: premier ? `0 0 14px ${alpha(couleur, 0.5)}` : undefined }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 1130, top: 214 }}>
          <CaptureReelle
            capture="social"
            libelle="CAPTURE RÉELLE · SOCIAL"
            largeur={690}
            cible={{ x: 0.59, y: 0.39 }}
            zoom={[1.05, 2.1]}
            debut={CAPTURE}
            duree={duree - CAPTURE}
            surbrillance={{ x: 0.512, y: 0.345, largeur: 0.152, hauteur: 0.085, debut: MISE_EN_AVANT - 2 }}
          />
        </div>
      </Derive>
      {PAIRES.map((p, i) => (
        <Sfx key={p.paire} nom="tic-point" a={RANGEES + i * PAS} volume={0.24} />
      ))}
      <Sfx nom="whoosh" a={CAPTURE - 4} volume={0.18} />
      <Sfx nom="verrouillage" a={MISE_EN_AVANT} volume={0.3} />
      <Sfx nom="telemetrie-bip" a={SEPARER} volume={0.26} />
    </FondScene>
  );
};
