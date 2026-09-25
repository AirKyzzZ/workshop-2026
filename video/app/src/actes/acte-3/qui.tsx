import type React from "react";
import { interpolate, interpolateColors, random, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, brouiller, formaterNombre } from "../../composants/charte/commun";
import { Rush } from "../../composants/charte/rush";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { Panneau } from "./visee";
import { VueAtria } from "./vue-atria";

const DUREE = framesDe("3.2");
const LECTURE = 42;
const SFACE = Math.round(DUREE * 0.29);
const VERROU = SFACE + 6;
const BARRES_VISAGE = SFACE + 10;
const BARRES_EMPREINTE = SFACE + 16;
const SIMILARITE = SFACE + 30;
const FICHES = SIMILARITE + 12;
const IMPOSTEUR = Math.round(DUREE * 0.66);
const SIMILARITE_2 = IMPOSTEUR + 12;
const REFUS = Math.round(DUREE * 0.8);

const FLUX = { x: 110, y: 180, largeur: 880, hauteur: 495 };
const COLONNE = { x: 1030, largeur: 780 };
const LARGEUR_BARRES = 420;
const HAUTEUR_BARRES = 44;
const VISAGE_TAILLE = { largeur: 150, hauteur: 176 };

const vecteur = (graine: string, bruit: number) =>
  Array.from({ length: valeurs.dimensionsEmpreinte }, (_, i) =>
    Math.max(-1, Math.min(1, random(`${graine}-${i}`) * 2 - 1 + (random(`${graine}-bruit-${i}`) * 2 - 1) * bruit)),
  );

const EMPREINTE = vecteur("sface-melih", 0);
const VISAGE = EMPREINTE.map((v, i) => Math.max(-1, Math.min(1, v + (random(`sface-direct-${i}`) * 2 - 1) * 0.35)));
const IMPOSTEUR_VECTEUR = vecteur("sface-alexandre", 0.1);

const FICHES_EQUIPAGE = [
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
  <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.06em", color: couleur, marginBottom: 6, whiteSpace: "nowrap" }}>{children}</div>
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

const REPERES = [
  [-0.2, -0.12],
  [0.2, -0.12],
  [0, 0.06],
  [-0.14, 0.24],
  [0.14, 0.24],
] as const;

const VisageVectoriel: React.FC<{ verrou: number; couleur: string; nom: string; pNom: number; frame: number }> = ({ verrou, couleur, nom, pNom, frame }) => {
  const { largeur, hauteur } = VISAGE_TAILLE;
  const cx = largeur / 2;
  const cy = hauteur * 0.42;
  const echelle = interpolate(verrou, [0, 1], [1.3, 1], bloque);
  const coin = 18;
  const bx = largeur * 0.12;
  const by = hauteur * 0.06;
  const bl = largeur * 0.76;
  const bh = hauteur * 0.7;
  return (
    <div style={{ width: largeur, flexShrink: 0 }}>
      <svg width={largeur} height={hauteur} style={{ display: "block", overflow: "visible" }}>
        <rect x={0} y={0} width={largeur} height={hauteur} fill={alpha(couleurs.fond, 0.6)} stroke={couleurs.trait} strokeWidth={1} />
        <ellipse cx={cx} cy={cy} rx={largeur * 0.26} ry={hauteur * 0.26} fill={couleurs.panneauClair} />
        <path d={`M ${largeur * 0.12} ${hauteur} C ${largeur * 0.16} ${hauteur * 0.74}, ${largeur * 0.84} ${hauteur * 0.74}, ${largeur * 0.88} ${hauteur}`} fill={couleurs.panneauClair} />
        <g opacity={interpolate(verrou, [0, 0.3], [0, 1], bloque)} style={{ scale: `${echelle}`, transformOrigin: `${cx}px ${cy}px` }}>
          {[
            [bx, by, 1, 1],
            [bx + bl, by, -1, 1],
            [bx, by + bh, 1, -1],
            [bx + bl, by + bh, -1, -1],
          ].map(([x, y, sx, sy]) => (
            <path key={`${sx}${sy}`} d={`M ${x} ${y + sy * coin} L ${x} ${y} L ${x + sx * coin} ${y}`} fill="none" stroke={couleur} strokeWidth={2} />
          ))}
        </g>
        {REPERES.map(([dx, dy], i) => (
          <circle key={i} cx={cx + dx * largeur} cy={cy + dy * hauteur} r={3.5} fill={couleur} opacity={interpolate(verrou, [0.3 + i * 0.12, 0.5 + i * 0.12], [0, 1], bloque)} />
        ))}
      </svg>
      <div style={{ marginTop: 10, fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.06em", color: couleur, whiteSpace: "nowrap", opacity: pNom }}>
        {brouiller(nom, pNom, frame, nom)}
      </div>
    </div>
  );
};

export const Qui: React.FC = () => {
  const frame = useCurrentFrame();
  const flux = avance(frame, 0, 10);
  const lu = avance(frame, LECTURE, 10);
  const refus = avance(frame, REFUS, 8);
  const imposteur = frame >= IMPOSTEUR;
  const pVisage = imposteur ? avance(frame, IMPOSTEUR, 14) : avance(frame, BARRES_VISAGE, 16);
  const pSimilarite = imposteur ? avance(frame, SIMILARITE_2, 10) : avance(frame, SIMILARITE, 12);
  const similarite = imposteur
    ? interpolate(pSimilarite, [0, 1], [valeurs.similariteVisage, valeurs.similariteImposteur])
    : valeurs.similariteVisage * pSimilarite;
  const couleurSimilarite = imposteur && pSimilarite > 0.5 ? couleurs.critique : couleurs.nominal;
  const reconnu = avance(frame, SIMILARITE + 8, 8);
  const verrou = imposteur ? avance(frame, IMPOSTEUR - 4, 10) : avance(frame, VERROU, 12);
  const couleurVisage = imposteur
    ? interpolateColors(refus, [0, 1], [couleurs.texte, couleurs.critique])
    : interpolateColors(reconnu, [0, 1], [couleurs.texte, couleurs.nominal]);
  const nomVisage = imposteur ? valeurs.temoin : valeurs.auteur;
  const pNomVisage = imposteur ? avance(frame, IMPOSTEUR + 2, 10) : reconnu;
  const voileFlux = avance(frame, IMPOSTEUR, 10) * 0.45;

  return (
    <VueAtria id="3.2" couche={1} plan={<div style={{ position: "absolute", inset: 0, backgroundColor: couleurs.fond }} />}>
      <div
        style={{
          position: "absolute",
          left: FLUX.x,
          top: FLUX.y,
          width: FLUX.largeur,
          height: FLUX.hauteur,
          overflow: "hidden",
          borderRadius: 4,
          outline: `1px solid ${alpha(refus > 0.5 ? couleurs.critique : couleurs.texte, 0.25 + 0.5 * refus)}`,
          boxShadow: `0 30px 80px ${alpha("#000000", 0.6)}`,
          opacity: interpolate(flux, [0, 0.3], [0, 1], bloque),
          clipPath: `inset(0 ${(1 - flux) * 100}% 0 0)`,
        }}
      >
        <Rush nom="badge-equipier" vitesse={0.8} etalonnage="saturate(0.7) contrast(1.1) brightness(0.62)" vignette={0.45} />
        <div style={{ position: "absolute", inset: 0, backgroundColor: couleurs.fond, opacity: voileFlux }} />
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.08em",
            color: couleurs.texte,
            textShadow: `0 2px 12px ${couleurs.fond}`,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurs.critique, opacity: 0.6 + 0.4 * Math.cos(frame / 6) }} />
          RC522 · LECTEUR
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 520,
            boxSizing: "border-box",
            padding: "18px 24px 22px",
            textAlign: "center",
            border: `2px solid ${couleurs.critique}`,
            backgroundColor: alpha(couleurs.fond, 0.84),
            boxShadow: `0 0 ${40 * refus}px ${alpha(couleurs.critique, 0.35)}`,
            opacity: refus,
            translate: "-50% -50%",
            scale: `${interpolate(refus, [0, 1], [1.08, 1])}`,
          }}
        >
          <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 72, lineHeight: 1, paddingTop: 6, whiteSpace: "nowrap", color: couleurs.critique }}>VISAGE ≠ BADGE</div>
          <div style={{ marginTop: 10, fontFamily: polices.donnees, fontWeight: 600, fontSize: 30, letterSpacing: "0.2em", color: couleurs.critique }}>ACCÈS REFUSÉ</div>
        </div>
      </div>

      <Panneau x={COLONNE.x} y={FLUX.y} largeur={COLONNE.largeur} p={avance(frame, 4, 12)} titre="RC522 · BADGE" accent={refus > 0.5 ? couleurs.critique : lu > 0 ? couleurs.nominal : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, height: 64 }}>
          <svg width={52} height={40} viewBox="0 0 52 40">
            <rect x={1} y={1} width={50} height={38} rx={5} fill="none" stroke={couleurs.texte} strokeWidth={2} />
            <rect x={8} y={9} width={12} height={10} rx={2} fill={couleurs.attention} opacity={0.8} />
            <line x1={8} y1={28} x2={40} y2={28} stroke={couleurs.texteDoux} strokeWidth={2} />
          </svg>
          <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 64, lineHeight: 1, paddingTop: 6, color: couleurs.texte, whiteSpace: "pre" }}>
            {lu > 0 ? brouiller(valeurs.auteur, lu, frame, "badge-melih") : "—"}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.08em", color: refus > 0.5 ? couleurs.critique : couleurs.texteDoux, opacity: imposteur ? avance(frame, IMPOSTEUR, 10) : 0 }}>
            {`PORTÉ PAR ${valeurs.temoin}`}
          </div>
        </div>
      </Panneau>

      <Panneau x={COLONNE.x} y={FLUX.y + 186} largeur={COLONNE.largeur} p={avance(frame, SFACE, 12)} titre={`YUNET + SFACE · ${valeurs.dimensionsEmpreinte} DIMENSIONS`}>
        <div style={{ display: "flex", gap: 30 }}>
          <VisageVectoriel verrou={verrou} couleur={couleurVisage} nom={nomVisage} pNom={pNomVisage} frame={frame} />
          <div>
            <Etiquette>VISAGE</Etiquette>
            <Barres vecteurs={imposteur ? IMPOSTEUR_VECTEUR : VISAGE} p={pVisage} couleur={imposteur ? couleurs.critique : couleurs.texte} />
            <div style={{ height: 14 }} />
            <Etiquette>{`EMPREINTE · ${valeurs.auteur}`}</Etiquette>
            <Barres vecteurs={EMPREINTE} p={avance(frame, BARRES_EMPREINTE, 16)} couleur={couleurs.nominal} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 16, whiteSpace: "nowrap", opacity: avance(frame, SIMILARITE - 4, 8) }}>
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texteDoux, letterSpacing: "0.06em" }}>SIMILARITÉ</span>
              <span style={{ fontFamily: polices.donnees, fontSize: 44, color: couleurSimilarite }}>{formaterNombre(similarite, 2)}</span>
              <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texteFaible }}>{`SEUIL ${formaterNombre(valeurs.seuilSimilarite, 3)}`}</span>
            </div>
          </div>
        </div>
      </Panneau>

      <div style={{ position: "absolute", left: FLUX.x, top: FLUX.y + FLUX.hauteur + 24, width: FLUX.largeur, display: "flex", gap: 12 }}>
        {FICHES_EQUIPAGE.map((fiche, i) => {
          const p = avance(frame, FICHES + i * 3, 10);
          const refuse = i === 1 && refus > 0;
          const ok = i !== 1;
          const couleur = refuse ? couleurs.critique : ok ? couleurs.nominal : couleurs.traitClair;
          return (
            <div
              key={fiche.nom}
              style={{
                position: "relative",
                flex: 1,
                padding: "12px 18px 12px 20px",
                backgroundColor: refuse ? alpha(couleurs.critique, 0.12 * refus) : alpha(couleurs.panneau, 0.9),
                border: `1px solid ${alpha(refuse ? couleurs.critique : couleurs.texte, refuse ? 0.6 : 0.1)}`,
                borderLeft: `3px solid ${couleur}`,
                opacity: interpolate(p, [0, 0.4], [0, 1], bloque),
                translate: `0 ${(1 - p) * 16}px`,
              }}
            >
              <div style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 48, lineHeight: 1, paddingTop: 4, color: refuse ? couleurs.critique : couleurs.texte }}>{fiche.nom}</div>
              <div style={{ marginTop: 2, fontFamily: polices.interface, fontWeight: 600, fontSize: 24, lineHeight: 1.2, color: couleurs.texteDoux }}>{fiche.role}</div>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                {ok || refuse ? <Coche ok={!refuse} p={refuse ? refus : avance(frame, FICHES + i * 3 + 6, 8)} /> : null}
              </div>
            </div>
          );
        })}
      </div>

      <Sfx nom="telemetrie-bip" a={LECTURE} volume={0.35} />
      <Sfx nom="verrouillage" a={VERROU} volume={0.35} />
      <Sfx nom="tic-point" a={SIMILARITE + 8} volume={0.3} />
      {FICHES_EQUIPAGE.map((fiche, i) => (
        <Sfx key={fiche.nom} nom="tic-point" a={FICHES + i * 3 + 6} volume={0.18} />
      ))}
      <Sfx nom="verrouillage" a={IMPOSTEUR} volume={0.3} />
      <Sfx nom="buzzer-refus" a={REFUS} volume={0.45} />
    </VueAtria>
  );
};
