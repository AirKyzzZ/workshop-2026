import type React from "react";
import { interpolate, interpolateColors, random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, formaterNombre } from "../../composants/charte/commun";
import { positionTete } from "../../composants/charte/plan-factice";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { decalageActe3 } from "./commun";
import { Panneau, Visee } from "./visee";
import { VueAtria } from "./vue-atria";

const BADGE = 12;
const VISEE_1 = 26;
const VERROU_1 = 42;
const BARRES_VISAGE = 48;
const BARRES_EMPREINTE = 60;
const SIMILARITE = 92;
const FICHES_DEBUT = 106;
const VISEE_2 = 190;
const VERROU_2 = 204;
const BARRES_IMPOSTEUR = 206;
const SIMILARITE_2 = 224;
const REFUS = 234;

const LARGEUR_BARRES = 540;
const HAUTEUR_BARRES = 48;

const vecteur = (graine: string, bruit: number) =>
  Array.from({ length: valeurs.dimensionsEmpreinte }, (_, i) =>
    Math.max(-1, Math.min(1, random(`${graine}-${i}`) * 2 - 1 + (random(`${graine}-bruit-${i}`) * 2 - 1) * bruit)),
  );

const EMPREINTE = vecteur("sface-melih", 0);
const VISAGE = EMPREINTE.map((v, i) => Math.max(-1, Math.min(1, v + (random(`sface-direct-${i}`) * 2 - 1) * 0.35)));
const IMPOSTEUR = vecteur("sface-alexandre", 0.1);

const FICHES = [
  { nom: valeurs.auteur, role: valeurs.roleAuteur },
  { nom: valeurs.temoin, role: valeurs.roleTemoin },
  { nom: valeurs.commandant, role: valeurs.roleCommandant },
];

const Barres: React.FC<{ vecteurs: number[]; p: number; couleur: string }> = ({ vecteurs, p, couleur }) => {
  const pas = LARGEUR_BARRES / vecteurs.length;
  return (
    <svg width={LARGEUR_BARRES} height={HAUTEUR_BARRES} style={{ display: "block" }}>
      <line x1={0} y1={HAUTEUR_BARRES / 2} x2={LARGEUR_BARRES} y2={HAUTEUR_BARRES / 2} stroke={alpha(couleurs.texte, 0.14)} strokeWidth={1} />
      {vecteurs.map((v, i) => {
        const visible = Math.max(0, Math.min(1, p * vecteurs.length * 1.2 - i));
        if (visible <= 0) return null;
        const h = Math.max(2, Math.abs(v) * (HAUTEUR_BARRES / 2 - 2) * visible);
        return <rect key={i} x={i * pas} y={v >= 0 ? HAUTEUR_BARRES / 2 - h : HAUTEUR_BARRES / 2} width={pas * 0.55} height={h} fill={couleur} opacity={0.35 + 0.65 * Math.abs(v)} />;
      })}
    </svg>
  );
};

const Etiquette: React.FC<{ children: React.ReactNode; couleur?: string }> = ({ children, couleur = couleurs.texteDoux }) => (
  <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.06em", color: couleur, marginBottom: 8 }}>{children}</div>
);

const Coche: React.FC<{ ok: boolean; p: number }> = ({ ok, p }) => (
  <svg width={34} height={34} viewBox="0 0 34 34">
    {ok ? (
      <path d="M 7 18 L 14 25 L 27 10" fill="none" stroke={couleurs.nominal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    ) : (
      <path d="M 9 9 L 25 25 M 25 9 L 9 25" fill="none" stroke={couleurs.critique} strokeWidth={3} strokeLinecap="round" opacity={p} />
    )}
  </svg>
);

const Reperes: React.FC<{ x: number; y: number; p: number; couleur: string }> = ({ x, y, p, couleur }) => (
  <>
    {[
      [-0.22, -0.1],
      [0.22, -0.1],
      [0, 0.1],
      [-0.16, 0.28],
      [0.16, 0.28],
    ].map(([dx, dy], i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x + dx * 150 - 4,
          top: y + dy * 170 - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: couleur,
          opacity: avance(p * 20, i * 2, 6),
        }}
      />
    ))}
  </>
);

export const Qui: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame + decalageActe3("3.2");
  const tete1 = positionTete(0, f);
  const tete2 = positionTete(1, f);
  const refus = avance(frame, REFUS, 12);
  const imposteur = frame >= BARRES_IMPOSTEUR;
  const pVisage = imposteur ? avance(frame, BARRES_IMPOSTEUR, 22) : avance(frame, BARRES_VISAGE, 26);
  const pSimilarite = imposteur ? avance(frame, SIMILARITE_2, 16) : avance(frame, SIMILARITE, 20);
  const similarite = imposteur
    ? interpolate(pSimilarite, [0, 1], [valeurs.similariteVisage, valeurs.similariteImposteur])
    : valeurs.similariteVisage * pSimilarite;
  const couleurSimilarite = imposteur && pSimilarite > 0.5 ? couleurs.critique : couleurs.nominal;
  const reconnu1 = avance(frame, SIMILARITE + 16, 12);
  const attenuation1 = 1 - 0.6 * avance(frame, VISEE_2 - 6, 14);
  const couleur2 = interpolateColors(refus, [0, 1], [couleurs.texte, couleurs.critique]);

  return (
    <VueAtria id="3.2" couche={1} tournage="BADGE ET VISAGES DEVANT LA C270">
      <div style={{ position: "absolute", inset: 0, opacity: attenuation1 }}>
        <Visee
          x={tete1.x}
          y={tete1.y}
          largeur={170}
          hauteur={200}
          p={avance(frame, VISEE_1, 16)}
          couleur={interpolateColors(reconnu1, [0, 1], [couleurs.texte, couleurs.nominal])}
          libelle={
            <>
              <span style={{ color: couleurs.texteDoux }}>YUNET</span>
              <span style={{ color: couleurs.nominal, opacity: reconnu1 }}>{valeurs.auteur}</span>
            </>
          }
        />
        <Reperes x={tete1.x} y={tete1.y} p={avance(frame, VERROU_1, 20)} couleur={couleurs.texte} />
      </div>
      <Visee
        x={tete2.x}
        y={tete2.y}
        largeur={170}
        hauteur={200}
        p={avance(frame, VISEE_2, 16)}
        couleur={couleur2}
        libelleDroite
        libelle={
          <>
            <span style={{ color: couleurs.texteDoux }}>YUNET</span>
            <span style={{ color: couleurs.critique, opacity: refus }}>{valeurs.temoin}</span>
          </>
        }
      />
      <Reperes x={tete2.x} y={tete2.y} p={avance(frame, VERROU_2, 20)} couleur={couleurs.texte} />

      <Panneau x={110} y={184} largeur={600} p={avance(frame, BADGE - 6, 18)} titre="RC522 · BADGE" accent={refus > 0.5 ? couleurs.critique : couleurs.nominal}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width={52} height={40} viewBox="0 0 52 40">
            <rect x={1} y={1} width={50} height={38} rx={5} fill="none" stroke={couleurs.texte} strokeWidth={2} />
            <rect x={8} y={9} width={12} height={10} rx={2} fill={couleurs.attention} opacity={0.8} />
            <line x1={8} y1={28} x2={40} y2={28} stroke={couleurs.texteDoux} strokeWidth={2} />
          </svg>
          <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 64, lineHeight: 1, paddingTop: 6, color: couleurs.texte }}>{valeurs.auteur}</div>
        </div>
      </Panneau>

      <Panneau x={110} y={362} largeur={600} p={avance(frame, BARRES_VISAGE - 8, 18)} titre={`SFACE · ${valeurs.dimensionsEmpreinte} DIMENSIONS`}>
        <Etiquette>VISAGE</Etiquette>
        <Barres vecteurs={imposteur ? IMPOSTEUR : VISAGE} p={pVisage} couleur={imposteur ? couleurs.critique : couleurs.texte} />
        <div style={{ height: 12 }} />
        <Etiquette>{`EMPREINTE · ${valeurs.auteur}`}</Etiquette>
        <Barres vecteurs={EMPREINTE} p={avance(frame, BARRES_EMPREINTE, 26)} couleur={couleurs.nominal} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 18, whiteSpace: "nowrap", opacity: avance(frame, SIMILARITE - 4, 10) }}>
          <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texteDoux, letterSpacing: "0.06em" }}>SIMILARITÉ</span>
          <span style={{ fontFamily: polices.donnees, fontSize: 40, color: couleurSimilarite }}>{formaterNombre(similarite, 2)}</span>
          <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texteFaible }}>{`SEUIL ${formaterNombre(valeurs.seuilSimilarite, 3)}`}</span>
        </div>
      </Panneau>

      <div style={{ position: "absolute", left: 1370, top: 184, width: 460, display: "flex", flexDirection: "column", gap: 12 }}>
        {FICHES.map((fiche, i) => {
          const p = avance(frame, FICHES_DEBUT + i * 12, 18);
          const refuse = i === 1 && refus > 0;
          const couleur = refuse ? couleurs.critique : couleurs.nominal;
          return (
            <div
              key={fiche.nom}
              style={{
                position: "relative",
                padding: "14px 20px 14px 22px",
                backgroundColor: refuse ? alpha(couleurs.critique, 0.12 * refus) : alpha(couleurs.fond, 0.78),
                border: `1px solid ${alpha(refuse ? couleurs.critique : couleurs.texte, refuse ? 0.6 : 0.1)}`,
                borderLeft: `3px solid ${couleur}`,
                opacity: interpolate(p, [0, 0.4], [0, 1], bloque),
                translate: `${(1 - p) * 30}px 0`,
                clipPath: `inset(-2px -2px -2px ${(1 - p) * 100}%)`,
              }}
            >
              <div>
                <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 56, lineHeight: 1, paddingTop: 4, color: refuse ? couleurs.critique : couleurs.texte }}>{fiche.nom}</div>
                <div style={{ marginTop: 4, fontFamily: polices.interface, fontWeight: 600, fontSize: 24, letterSpacing: "0.03em", color: couleurs.texteDoux, whiteSpace: "nowrap" }}>{fiche.role}</div>
              </div>
              <div style={{ position: "absolute", top: 14, right: 16 }}>
                <Coche ok={!refuse} p={refuse ? refus : avance(frame, FICHES_DEBUT + i * 12 + 12, 12)} />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: Math.min(tete2.x, 1150) - 220,
          top: 556,
          width: 440,
          boxSizing: "border-box",
          padding: "16px 24px 20px",
          textAlign: "center",
          border: `2px solid ${couleurs.critique}`,
          backgroundColor: alpha(couleurs.fond, 0.82),
          boxShadow: `0 0 ${40 * refus}px ${alpha(couleurs.critique, 0.35)}`,
          opacity: refus,
          scale: `${interpolate(refus, [0, 1], [1.08, 1])}`,
        }}
      >
        <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 60, lineHeight: 1, paddingTop: 6, whiteSpace: "nowrap", color: couleurs.critique }}>VISAGE ≠ BADGE</div>
        <div style={{ marginTop: 10, fontFamily: polices.donnees, fontWeight: 600, fontSize: 28, letterSpacing: "0.2em", color: couleurs.critique }}>ACCÈS REFUSÉ</div>
      </div>

      <Sfx nom="telemetrie-bip" a={BADGE} volume={0.35} />
      <Sfx nom="verrouillage" a={VERROU_1} volume={0.35} />
      <Sfx nom="tic-point" a={SIMILARITE + 16} volume={0.3} />
      {FICHES.map((fiche, i) => (
        <Sfx key={fiche.nom} nom="tic-point" a={FICHES_DEBUT + i * 12 + 12} volume={0.22} />
      ))}
      <Sfx nom="verrouillage" a={VERROU_2} volume={0.35} />
      <Sfx nom="buzzer-refus" a={REFUS} volume={0.45} />
    </VueAtria>
  );
};
