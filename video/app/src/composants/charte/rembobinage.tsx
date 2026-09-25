import type React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs, marge, polices, tailles } from "../../charte";
import { Chiffres } from "./chiffres";
import { alpha, avance, bloque, courbes, ecrireTimecode, versSecondes } from "./commun";

export type RembobinageProps = {
  heureDepart: string;
  recul: number;
  duree: number;
  debut?: number;
  fondu?: number;
  libelle?: string;
  children?: React.ReactNode;
};

const BANDES = [
  { graine: "a", hauteur: 56, phase: 0.1 },
  { graine: "b", hauteur: 36, phase: 0.55 },
  { graine: "c", hauteur: 14, phase: 0.8 },
];

export const Rembobinage: React.FC<RembobinageProps> = ({
  heureDepart,
  recul,
  duree,
  debut = 0,
  fondu = 8,
  libelle = "REMBOBINAGE",
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const progres = (f: number) => avance(f, debut, duree, courbes.bascule);
  const p = progres(frame);
  const vitesse = ((progres(frame + 1) - progres(frame - 1)) / 2) * duree;
  const enveloppe = interpolate(frame, [debut, debut + fondu, debut + duree - fondu, debut + duree], [0, 1, 1, 0], bloque);
  const agitation = Math.min(1.6, vitesse) * enveloppe;
  const depart = versSecondes(heureDepart) * fps;
  const temps = ecrireTimecode(depart - p * recul * fps, fps);
  const ecoule = ecrireTimecode(p * recul * fps, fps);
  const multiplicateur = Math.max(1, Math.round((vitesse * recul * fps) / duree));
  const decalage = (random(`rembobinage-${frame}`) - 0.5) * 10 * agitation;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: couleurs.fond }}>
      <AbsoluteFill
        style={{
          filter: `saturate(${1 - 0.9 * enveloppe}) contrast(${1 + 0.18 * enveloppe}) brightness(${1 - 0.14 * enveloppe})`,
          translate: `${decalage}px 0`,
          scale: `${1 + 0.02 * enveloppe}`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: enveloppe,
          backgroundImage: `repeating-linear-gradient(to bottom, ${alpha(couleurs.fond, 0.42)} 0px, ${alpha(couleurs.fond, 0.42)} 2px, transparent 2px, transparent 5px)`,
          backgroundPosition: `0 ${-p * recul * 40}px`,
        }}
      />
      {BANDES.map((bande) => {
        const y = ((bande.phase - p * 2.4) % 1.2 + 1.2) % 1.2 - 0.1;
        return (
          <div
            key={bande.graine}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: y * height,
              height: bande.hauteur,
              opacity: agitation * 0.4,
              translate: `${(random(`bande-${bande.graine}-${frame}`) - 0.5) * 24}px 0`,
              background: `linear-gradient(to bottom, transparent, ${alpha(couleurs.blanc, 0.1)} 70%, ${alpha(couleurs.blanc, 0.35)} 96%, transparent)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          opacity: enveloppe,
          background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, ${alpha(couleurs.fond, 0.7)} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: marge,
          left: marge,
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: enveloppe,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.2em",
          lineHeight: 1,
        }}
      >
        <svg width={40} height={24} viewBox="0 0 40 24">
          <path d="M20 0 L0 12 L20 24 Z M40 0 L20 12 L40 24 Z" fill={couleurs.texte} />
        </svg>
        <span style={{ color: couleurs.texte, fontWeight: 600 }}>{libelle}</span>
        <span style={{ color: couleurs.texteDoux, letterSpacing: "0.06em" }}>×{multiplicateur}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: marge,
          right: marge,
          bottom: marge,
          opacity: enveloppe,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontFamily: polices.donnees, fontSize: 76, lineHeight: 1, letterSpacing: "-0.01em", color: couleurs.texte }}>
            <Chiffres texte={temps.heure} />
            <span style={{ color: couleurs.texteDoux }}>
              <Chiffres texte={`:${temps.images}`} />
            </span>
          </div>
          <div style={{ fontFamily: polices.donnees, fontSize: tailles.lecture, color: couleurs.texteDoux }}>
            <Chiffres texte={`−${ecoule.heure}:${ecoule.images}`} />
          </div>
        </div>
        <div style={{ position: "relative", height: 18 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 8, height: 2, backgroundColor: alpha(couleurs.texte, 0.2) }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 8,
              height: 2,
              width: `${p * 100}%`,
              backgroundColor: couleurs.texte,
            }}
          />
          {Array.from({ length: Math.floor(recul) + 1 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 2,
                right: `${(i / recul) * 100}%`,
                width: 1,
                height: 14,
                backgroundColor: alpha(couleurs.texte, 0.35),
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              top: -6,
              right: `${p * 100}%`,
              width: 3,
              height: 30,
              translate: "50% 0",
              backgroundColor: couleurs.blanc,
              boxShadow: `0 0 14px ${alpha(couleurs.blanc, 0.6)}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
