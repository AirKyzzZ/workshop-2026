import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, brouiller, courbes } from "../../composants/charte/commun";
import { Curseur, positionCurseur } from "../../composants/charte/curseur";
import { FondScene } from "../../composants/charte/plateau";
import { COQUE } from "../../composants/metier/plan-vaisseau";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";

const X_PANNEAU = 310;
const LARGEUR_PANNEAU = 1300;
const DEBUT_BADGE = 14;
const DEBUT_FRAPPE = 54;
const PAR_CARACTERE = 2.2;
const APPUI = 146;

export const COMMANDE = `AFFECTER ${valeurs.auteur.toLowerCase()} → ${valeurs.posteVital}`;
const FIN_FRAPPE = DEBUT_FRAPPE + COMMANDE.length * PAR_CARACTERE;

const DECALAGE_Y = 64;
const BOUTON = { x: X_PANNEAU + LARGEUR_PANNEAU - 220, y: 640 + DECALAGE_Y, largeur: 220, hauteur: 70 };

const CLES_CURSEUR = [
  { frame: 104, x: 1500, y: 930 },
  { frame: 138, x: BOUTON.x + 120, y: BOUTON.y + 40 },
];

const IconeBadge: React.FC<{ p: number; frame: number }> = ({ p, frame }) => (
  <svg width={56} height={56} viewBox="0 0 56 56">
    <rect x={6} y={14} width={30} height={30} rx={4} fill="none" stroke={couleurs.texte} strokeWidth={2} />
    {[0, 1, 2].map((k) => (
      <path
        key={k}
        d={`M ${40 + k * 5} ${18 - k * 3} Q ${48 + k * 6} 29 ${40 + k * 5} ${40 + k * 3}`}
        fill="none"
        stroke={couleurs.nominal}
        strokeWidth={2}
        opacity={p * (0.4 + 0.6 * Math.max(0, Math.sin(frame / 3 - k)))}
      />
    ))}
  </svg>
);

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
  const barre = avance(frame, 0, 20);
  const panneau = avance(frame, 6, 24);
  const badge = avance(frame, DEBUT_BADGE, 18);
  const badgeLu = avance(frame, DEBUT_BADGE + 14, 20);
  const coche = avance(frame, DEBUT_BADGE + 34, 10);
  const tapes = Math.max(0, Math.min(COMMANDE.length, Math.floor((frame - DEBUT_FRAPPE) / PAR_CARACTERE)));
  const curseur = positionCurseur(CLES_CURSEUR, frame, courbes.bascule);
  const appui = interpolate(frame, [APPUI, APPUI + 10], [0, 1], bloque);
  const envoye = frame >= APPUI + 3;
  const attente = avance(frame, APPUI + 6, 12);
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
          top: 236 + DECALAGE_Y,
          width: LARGEUR_PANNEAU,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "18px 28px",
          boxSizing: "border-box",
          border: `1px solid ${alpha(couleurs.texte, 0.1)}`,
          backgroundColor: alpha(couleurs.panneau, 0.9),
          opacity: badge,
          translate: `0 ${(1 - badge) * 18}px`,
        }}
      >
        <IconeBadge p={badgeLu} frame={frame} />
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

      <Curseur x={curseur.x} y={curseur.y} appui={appui} opacite={interpolate(frame, [CLES_CURSEUR[0].frame, CLES_CURSEUR[0].frame + 8], [0, 1], bloque)} />
    </FondScene>
  );
};

export const Ordre: React.FC = () => (
  <AbsoluteFill>
    <OrdreCommandant />
    <Sfx nom="telemetrie-bip" a={DEBUT_BADGE + 14} volume={0.35} />
    <Sfx nom="verrouillage" a={DEBUT_BADGE + 34} volume={0.25} />
    {Array.from({ length: Math.ceil(COMMANDE.length / 2) }, (_, i) => (
      <Sfx key={i} nom="tic-point" a={DEBUT_FRAPPE + i * 2 * PAR_CARACTERE} volume={0.14} />
    ))}
    <Sfx nom="clic-validation" a={APPUI} volume={0.55} />
  </AbsoluteFill>
);
