import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { Chiffres } from "./chiffres";
import { alpha, avance, bloque, couleurEtat, courbes, formaterNombre, type Etat } from "./commun";

export type JaugeProps = {
  label: string;
  depuis: number;
  vers: number;
  min?: number;
  max?: number;
  seuil?: number;
  libelleSeuil?: string;
  alerte?: "sous" | "dessus";
  forme?: "barre" | "arc";
  etat?: Etat;
  decimales?: number;
  unite?: string;
  graduations?: number;
  note?: string;
  debut?: number;
  debutVariation?: number;
  duree?: number;
  largeur?: number;
};

const ENTREE = 20;
const BASCULE = 8;

const ARC_DEPART = 150;
const ARC_ETENDUE = 240;

const pointArc = (cx: number, cy: number, r: number, ratio: number) => {
  const angle = ((ARC_DEPART + ratio * ARC_ETENDUE) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
};

const cheminArc = (cx: number, cy: number, r: number) => {
  const a = pointArc(cx, cy, r, 0);
  const b = pointArc(cx, cy, r, 1);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`;
};

export const Jauge: React.FC<JaugeProps> = ({
  label,
  depuis,
  vers,
  min = 0,
  max = 1,
  seuil,
  libelleSeuil = "SEUIL",
  alerte = "sous",
  forme = "barre",
  etat = "nominal",
  decimales = 2,
  unite,
  graduations = 4,
  note,
  debut = 0,
  debutVariation,
  duree = 45,
  largeur,
}) => {
  const frame = useCurrentFrame();
  const variation = debutVariation ?? debut + ENTREE + 12;

  const valeurA = (f: number) => {
    const intro = avance(f, debut, ENTREE, courbes.entree);
    const glisse = avance(f, variation, duree, courbes.bascule);
    return glisse > 0 ? interpolate(glisse, [0, 1], [depuis, vers]) : interpolate(intro, [0, 1], [min, depuis]);
  };
  const critiqueA = (v: number) => seuil !== undefined && (alerte === "sous" ? v < seuil : v > seuil);

  let franchissement: number | null = null;
  for (let f = Math.floor(debut + ENTREE); f <= Math.ceil(variation + duree); f++) {
    if (critiqueA(valeurA(f))) {
      franchissement = f;
      break;
    }
  }

  const valeur = valeurA(frame);
  const ratio = interpolate(valeur, [min, max], [0, 1], bloque);
  const ratioDepuis = interpolate(depuis, [min, max], [0, 1], bloque);
  const ratioSeuil = seuil === undefined ? null : interpolate(seuil, [min, max], [0, 1], bloque);
  const couleurBase = couleurEtat(etat);
  const couleur =
    franchissement === null
      ? couleurBase
      : interpolateColors(frame, [franchissement, franchissement + BASCULE], [couleurBase, couleurs.critique]);
  const impulsion =
    franchissement === null
      ? 0
      : interpolate(frame, [franchissement, franchissement + 3, franchissement + 24], [0, 1, 0], bloque);
  const apparition = avance(frame, debut, ENTREE);
  const trainee = interpolate(frame, [variation + duree, variation + duree + 20], [0.32, 0], bloque);
  const texteValeur = formaterNombre(valeur, decimales);
  const texteSeuil = seuil === undefined ? "" : `${libelleSeuil} ${formaterNombre(seuil, decimales)}`;

  if (forme === "arc") {
    const cote = largeur ?? 460;
    const c = cote / 2;
    const r = c - 44;
    const arc = cheminArc(c, c, r);
    const repereSeuil = ratioSeuil === null ? null : [pointArc(c, c, r - 22, ratioSeuil), pointArc(c, c, r + 22, ratioSeuil)];
    return (
      <div
        style={{
          position: "relative",
          width: cote,
          height: cote,
          opacity: interpolate(apparition, [0, 0.3], [0, 1], bloque),
        }}
      >
        <svg width={cote} height={cote} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {Array.from({ length: 41 }, (_, i) => {
            const majeur = i % 10 === 0;
            const a = pointArc(c, c, r + 30, i / 40);
            const b = pointArc(c, c, r + (majeur ? 44 : 38), i / 40);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={majeur ? couleurs.texteDoux : couleurs.traitClair}
                strokeWidth={majeur ? 2 : 1.5}
                opacity={interpolate(apparition, [i / 60, i / 60 + 0.3], [0, 1], bloque)}
              />
            );
          })}
          <path d={arc} fill="none" stroke={couleurs.panneauClair} strokeWidth={14} pathLength={1} strokeDasharray={`${apparition} 1`} />
          <path
            d={arc}
            fill="none"
            stroke={couleur}
            strokeWidth={4}
            opacity={trainee}
            pathLength={1}
            strokeDasharray={`0 ${Math.min(ratio, ratioDepuis)} ${Math.abs(ratioDepuis - ratio)} 1`}
          />
          <path
            d={arc}
            fill="none"
            stroke={couleur}
            strokeWidth={14}
            pathLength={1}
            strokeDasharray={`${ratio} 1`}
            style={{ filter: `drop-shadow(0 0 ${10 + impulsion * 18}px ${alpha(couleur, 0.45)})` }}
          />
          {repereSeuil ? (
            <line
              x1={repereSeuil[0].x}
              y1={repereSeuil[0].y}
              x2={repereSeuil[1].x}
              y2={repereSeuil[1].y}
              stroke={couleurs.critique}
              strokeWidth={3 + impulsion * 3}
              opacity={apparition}
            />
          ) : null}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div style={{ fontFamily: polices.donnees, fontSize: Math.round(cote * 0.2), lineHeight: 1, color: couleur }}>
            <Chiffres texte={texteValeur} />
            {unite ? <span style={{ fontSize: tailles.lecture, color: couleurs.texteDoux, marginLeft: 8 }}>{unite}</span> : null}
          </div>
          <div
            style={{
              fontFamily: polices.interface,
              fontWeight: 600,
              fontSize: tailles.etiquette,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: couleurs.texteDoux,
            }}
          >
            {label}
          </div>
          {seuil !== undefined ? (
            <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.critique, opacity: 0.9 }}>
              <Chiffres texte={texteSeuil} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const longueur = largeur ?? 1200;
  return (
    <div style={{ width: longueur, display: "flex", flexDirection: "column", gap: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          opacity: apparition,
          translate: `0 ${(1 - apparition) * 12}px`,
        }}
      >
        <div
          style={{
            fontFamily: polices.interface,
            fontWeight: 600,
            fontSize: tailles.etiquette,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: couleurs.texteDoux,
            paddingBottom: 8,
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: polices.donnees, fontSize: 72, lineHeight: 1, color: couleur, letterSpacing: "-0.02em" }}>
          <Chiffres texte={texteValeur} />
          {unite ? <span style={{ fontSize: tailles.lecture, color: couleurs.texteDoux, marginLeft: 10 }}>{unite}</span> : null}
        </div>
      </div>
      <div style={{ position: "relative", height: 16, marginTop: 64, backgroundColor: couleurs.panneauClair, scale: `${apparition} 1`, transformOrigin: "left" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${Math.min(ratio, ratioDepuis) * 100}%`,
            width: `${Math.abs(ratioDepuis - ratio) * 100}%`,
            backgroundColor: couleur,
            opacity: trainee,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${ratio * 100}%`,
            backgroundColor: couleur,
            boxShadow: `0 0 ${14 + impulsion * 22}px ${alpha(couleur, 0.35 + impulsion * 0.3)}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: `${ratio * 100}%`,
            width: 3,
            translate: "-50% 0",
            backgroundColor: couleurs.blanc,
            opacity: interpolate(ratio, [0, 0.01], [0, 1], bloque),
          }}
        />
        {ratioSeuil !== null ? (
          <div style={{ position: "absolute", top: -34, bottom: -22, left: `${ratioSeuil * 100}%`, opacity: apparition }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 2 + impulsion * 2,
                translate: "-50% 0",
                backgroundColor: couleurs.critique,
                boxShadow: `0 0 ${impulsion * 24}px ${alpha(couleurs.critique, 0.9)}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                paddingBottom: 10,
                translate: "-50% 0",
                whiteSpace: "nowrap",
                fontFamily: polices.donnees,
                fontSize: tailles.etiquette,
                lineHeight: 1,
                color: couleurs.critique,
              }}
            >
              <Chiffres texte={texteSeuil} />
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ position: "relative", height: 64, marginTop: 20 }}>
        {Array.from({ length: graduations + 1 }, (_, i) => {
          const r = i / graduations;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: `${r * 100}%`,
                translate: i === 0 ? "0 0" : i === graduations ? "-100% 0" : "-50% 0",
                display: "flex",
                flexDirection: "column",
                alignItems: i === 0 ? "flex-start" : i === graduations ? "flex-end" : "center",
                gap: 10,
                opacity: interpolate(apparition, [r * 0.5, r * 0.5 + 0.5], [0, 1], bloque),
              }}
            >
              <div style={{ width: 2, height: 10, backgroundColor: couleurs.traitClair }} />
              <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, lineHeight: 1, color: couleurs.texteFaible }}>
                <Chiffres texte={formaterNombre(interpolate(r, [0, 1], [min, max]), decimales)} />
              </div>
            </div>
          );
        })}
      </div>
      {note ? (
        <div
          style={{
            marginTop: 20,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            color: couleurs.texteFaible,
            opacity: avance(frame, debut + ENTREE, ENTREE),
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
};
