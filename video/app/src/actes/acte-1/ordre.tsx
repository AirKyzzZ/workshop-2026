import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { couleurs, marge, polices, tailles } from "../../charte";
import { alpha, avance, bloque, brouiller, courbes } from "../../composants/charte/commun";
import { Curseur, positionCurseur } from "../../composants/charte/curseur";
import { FondScene } from "../../composants/charte/plateau";
import { Rush } from "../../composants/charte/rush";
import { COQUE } from "../../composants/metier/plan-vaisseau";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";

const X_PANNEAU = 310;
const LARGEUR_PANNEAU = 1300;
const DEBUT_CARTE = 10;
const LECTURE = 30;
const REPLI = 34;
const DUREE_REPLI = 16;
const DEBUT_FRAPPE = 52;
const PAR_CARACTERE = 1.1;
const APPUI = 100;

export const COMMANDE = `AFFECTER ${valeurs.auteur.toLowerCase()} → ${valeurs.posteVital}`;
const FIN_FRAPPE = DEBUT_FRAPPE + COMMANDE.length * PAR_CARACTERE;

const DECALAGE_Y = 64;
const RANGEE_BADGE = { y: 236 + DECALAGE_Y, hauteur: 108 };
const VIGNETTE = { x: X_PANNEAU + 18, y: RANGEE_BADGE.y + 18, largeur: 128, hauteur: 72 };
const BOUTON = { x: X_PANNEAU + LARGEUR_PANNEAU - 220, y: 640 + DECALAGE_Y, largeur: 220, hauteur: 70 };

const CLES_CURSEUR = [
  { frame: 74, x: 1500, y: 930 },
  { frame: 96, x: BOUTON.x + 120, y: BOUTON.y + 40 },
];

const PlanCarte: React.FC<{ frame: number }> = ({ frame }) => {
  const repli = avance(frame, REPLI, DUREE_REPLI, courbes.bascule);
  const lu = avance(frame, LECTURE, 8);
  const hud = 1 - avance(frame, REPLI, 8);
  const eclair = interpolate(frame, [LECTURE, LECTURE + 2, LECTURE + 10], [0, 0.18, 0], bloque);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: interpolate(repli, [0, 1], [0, VIGNETTE.x]),
          top: interpolate(repli, [0, 1], [0, VIGNETTE.y]),
          width: interpolate(repli, [0, 1], [1920, VIGNETTE.largeur]),
          height: interpolate(repli, [0, 1], [1080, VIGNETTE.hauteur]),
          overflow: "hidden",
          borderRadius: 4 * repli,
          outline: `1px solid ${alpha(couleurs.texte, 0.3 * repli)}`,
          boxShadow: `0 20px 60px ${alpha("#000000", 0.5 * repli)}`,
        }}
      >
        <Rush nom="carte-nfc-captaine" debut={DEBUT_CARTE} etalonnage="saturate(0.7) contrast(1.1) brightness(0.62)" vignette={0.5 * (1 - repli)} />
        <AbsoluteFill style={{ backgroundColor: couleurs.blanc, opacity: eclair }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: marge,
          left: marge,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: hud * avance(frame, 0, 8),
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.12em",
          color: couleurs.texte,
          textShadow: `0 2px 14px ${couleurs.fond}`,
        }}
      >
        <div style={{ width: 12, height: 12, backgroundColor: lu > 0 ? couleurs.nominal : couleurs.attention, boxShadow: `0 0 14px ${alpha(lu > 0 ? couleurs.nominal : couleurs.attention, 0.7)}` }} />
        RC522 · CARTE DU COMMANDANT
      </div>
      <div
        style={{
          position: "absolute",
          left: marge,
          bottom: marge + 150,
          display: "flex",
          alignItems: "baseline",
          gap: 20,
          opacity: hud * lu,
          translate: `0 ${(1 - lu) * 12}px`,
          textShadow: `0 2px 18px ${couleurs.fond}`,
        }}
      >
        <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.12em", color: couleurs.nominal }}>CARTE LUE</span>
        <span style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 88, lineHeight: 1, color: couleurs.blanc }}>{valeurs.commandant}</span>
      </div>
    </>
  );
};

export const BarreCommandement: React.FC<{ p: number }> = ({ p }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 104,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 86px",
      borderBottom: `1px solid ${couleurs.trait}`,
      opacity: p,
      translate: `0 ${(1 - p) * -16}px`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <Img src={staticFile("brand/atria-mark-small.svg")} style={{ width: 44, height: 44, filter: "invert(1)" }} />
      <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 48, lineHeight: 1, paddingTop: 6, letterSpacing: "0.04em", color: couleurs.texte }}>
        ATRIA
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ fontFamily: polices.donnees, fontWeight: 600, fontSize: 26, letterSpacing: "0.06em", color: couleurs.attention }}>{valeurs.commandant}</div>
      <div style={{ fontFamily: polices.donnees, fontSize: 24, letterSpacing: "0.08em", color: couleurs.texteFaible }}>COMMANDEMENT</div>
    </div>
  </div>
);

export const OrdreCommandant: React.FC = () => {
  const frame = useCurrentFrame();
  const barre = avance(frame, LECTURE, 12);
  const panneau = avance(frame, REPLI + 2, 14);
  const badge = avance(frame, REPLI - 2, 12);
  const badgeLu = avance(frame, REPLI + 4, 12);
  const coche = avance(frame, REPLI + DUREE_REPLI, 8);
  const tapes = Math.max(0, Math.min(COMMANDE.length, Math.floor((frame - DEBUT_FRAPPE) / PAR_CARACTERE)));
  const curseur = positionCurseur(CLES_CURSEUR, frame, courbes.bascule);
  const appui = interpolate(frame, [APPUI, APPUI + 8], [0, 1], bloque);
  const envoye = frame >= APPUI + 2;
  const attente = avance(frame, APPUI + 4, 10);
  const clignote = frame < FIN_FRAPPE || Math.floor(frame / 8) % 2 === 0;

  return (
    <FondScene>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d={COQUE} fill="none" stroke={alpha(couleurs.texte, 0.07)} strokeWidth={1.5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - panneau} />
      </svg>

      <BarreCommandement p={barre} />

      <div
        style={{
          position: "absolute",
          left: X_PANNEAU,
          top: RANGEE_BADGE.y,
          width: LARGEUR_PANNEAU,
          height: RANGEE_BADGE.hauteur,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: `0 28px 0 ${VIGNETTE.largeur + 44}px`,
          boxSizing: "border-box",
          border: `1px solid ${alpha(couleurs.texte, 0.1)}`,
          backgroundColor: alpha(couleurs.panneau, 0.9),
          opacity: badge,
          translate: `0 ${(1 - badge) * 18}px`,
        }}
      >
        <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.12em", color: couleurs.texteDoux }}>BADGE</div>
        <div style={{ flex: 1, fontFamily: polices.donnees, fontWeight: 600, fontSize: 30, letterSpacing: "0.06em", color: couleurs.texte }}>
          {brouiller(`${valeurs.commandant} · ${valeurs.roleCommandant}`, badgeLu, frame, "badge-commandant")}
        </div>
        <svg width={44} height={44} viewBox="0 0 44 44">
          <circle cx={22} cy={22} r={19} fill="none" stroke={couleurs.nominal} strokeWidth={2} opacity={coche} />
          <path d="M 13 23 L 19 29 L 31 16" fill="none" stroke={couleurs.nominal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - coche} />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: X_PANNEAU,
          top: 380 + DECALAGE_Y,
          width: LARGEUR_PANNEAU,
          opacity: panneau,
          translate: `0 ${(1 - panneau) * 24}px`,
        }}
      >
        <div
          style={{
            paddingBottom: 16,
            borderBottom: `1px solid ${couleurs.trait}`,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.12em",
            color: couleurs.texteDoux,
          }}
        >
          AFFECTER UN POSTE
        </div>
        <div
          style={{
            marginTop: 34,
            height: 132,
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "0 36px",
            border: `1px solid ${frame >= DEBUT_FRAPPE - 8 && !envoye ? alpha(couleurs.texte, 0.5) : couleurs.traitClair}`,
            backgroundColor: alpha(couleurs.fond, 0.7),
            fontFamily: polices.donnees,
            fontSize: 56,
            lineHeight: 1,
            color: couleurs.texte,
            whiteSpace: "pre",
          }}
        >
          <span style={{ color: couleurs.attention }}>›</span>
          <span>
            {COMMANDE.slice(0, tapes)}
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 56,
                marginLeft: 6,
                verticalAlign: "-8px",
                backgroundColor: couleurs.texte,
                opacity: clignote && frame >= DEBUT_FRAPPE - 8 && !envoye ? 0.85 : 0,
              }}
            />
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: X_PANNEAU,
          top: BOUTON.y + 22,
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: attente,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
        }}
      >
        <svg width={28} height={28} viewBox="0 0 28 28" style={{ rotate: `${frame * 12}deg` }}>
          <circle cx={14} cy={14} r={11} fill="none" stroke={couleurs.attention} strokeWidth={3} strokeDasharray="20 60" strokeLinecap="round" />
        </svg>
        {valeurs.heureOrdre}
      </div>

      <div
        style={{
          position: "absolute",
          left: BOUTON.x,
          top: BOUTON.y,
          width: BOUTON.largeur,
          height: BOUTON.hauteur,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${envoye ? couleurs.texte : couleurs.traitClair}`,
          backgroundColor: envoye ? couleurs.texte : "transparent",
          color: envoye ? couleurs.fond : couleurs.texte,
          fontFamily: polices.donnees,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "0.14em",
          opacity: panneau,
          scale: `${1 - Math.sin(appui * Math.PI) * 0.05}`,
        }}
      >
        VALIDER
      </div>

      <Curseur x={curseur.x} y={curseur.y} appui={appui} opacite={interpolate(frame, [CLES_CURSEUR[0].frame, CLES_CURSEUR[0].frame + 6], [0, 1], bloque)} />
      <PlanCarte frame={frame} />
    </FondScene>
  );
};

export const Ordre: React.FC = () => (
  <AbsoluteFill>
    <OrdreCommandant />
    <Sfx nom="telemetrie-bip" a={LECTURE} volume={0.35} />
    <Sfx nom="whoosh" a={REPLI - 2} volume={0.16} />
    <Sfx nom="verrouillage" a={REPLI + DUREE_REPLI} volume={0.25} />
    {Array.from({ length: Math.ceil(COMMANDE.length / 2) }, (_, i) => (
      <Sfx key={i} nom="tic-point" a={DEBUT_FRAPPE + i * 2 * PAR_CARACTERE} volume={0.14} />
    ))}
    <Sfx nom="clic-validation" a={APPUI} volume={0.55} />
  </AbsoluteFill>
);
