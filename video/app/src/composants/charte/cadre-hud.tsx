import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, couleurEtat, ecrireTimecode, versSecondes, type Etat } from "./commun";

export type LectureHud = { label: string; valeur: string; etat?: Etat };

export type CadreHudProps = {
  etiquette: string;
  horodatage?: string;
  date?: string;
  horlogeActive?: boolean;
  lectures?: LectureHud[];
  etat?: Etat;
  debut?: number;
  duree?: number;
  retrait?: number;
  longueurCoin?: number;
  voile?: boolean;
  children?: React.ReactNode;
};

const COINS = [
  { haut: true, gauche: true },
  { haut: true, gauche: false },
  { haut: false, gauche: false },
  { haut: false, gauche: true },
] as const;

const EPAISSEUR = 2;

export const CadreHud: React.FC<CadreHudProps> = ({
  etiquette,
  horodatage,
  date,
  horlogeActive = true,
  lectures = [],
  etat = "nominal",
  debut = 0,
  duree = 30,
  retrait = 56,
  longueurCoin = 64,
  voile = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ecart = retrait + 30;
  const trait = alpha(couleurs.texte, 0.92);
  const pointille = avance(frame, debut + duree * 0.45, duree * 0.8);
  const texteHaut = avance(frame, debut + duree * 0.35, duree * 0.7);
  const temps = horodatage
    ? ecrireTimecode(versSecondes(horodatage) * fps + (horlogeActive ? Math.max(0, frame - debut) : 0), fps)
    : null;

  return (
    <AbsoluteFill>
      {children ? <AbsoluteFill>{children}</AbsoluteFill> : null}
      {voile ? (
        <AbsoluteFill
          style={{
            opacity: avance(frame, debut, duree),
            background: `linear-gradient(to bottom, ${alpha(couleurs.fond, 0.62)} 0px, transparent 260px, transparent calc(100% - 260px), ${alpha(couleurs.fond, 0.62)} 100%)`,
          }}
        />
      ) : null}
      {COINS.map((coin, i) => {
        const p = avance(frame, debut + i * 3, duree * 0.7);
        const sensX = coin.gauche ? 1 : -1;
        const sensY = coin.haut ? 1 : -1;
        return (
          <div
            key={`${coin.haut}-${coin.gauche}`}
            style={{
              position: "absolute",
              top: coin.haut ? retrait : undefined,
              bottom: coin.haut ? undefined : retrait,
              left: coin.gauche ? retrait : undefined,
              right: coin.gauche ? undefined : retrait,
              width: longueurCoin,
              height: longueurCoin,
              opacity: interpolate(p, [0, 0.15], [0, 1], bloque),
              translate: `${sensX * 36 * (1 - p)}px ${sensY * 36 * (1 - p)}px`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: coin.haut ? 0 : undefined,
                bottom: coin.haut ? undefined : 0,
                left: coin.gauche ? 0 : undefined,
                right: coin.gauche ? undefined : 0,
                width: "100%",
                height: EPAISSEUR,
                backgroundColor: trait,
                scale: `${p} 1`,
                transformOrigin: coin.gauche ? "left" : "right",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: coin.haut ? 0 : undefined,
                bottom: coin.haut ? undefined : 0,
                left: coin.gauche ? 0 : undefined,
                right: coin.gauche ? undefined : 0,
                width: EPAISSEUR,
                height: "100%",
                backgroundColor: trait,
                scale: `1 ${p}`,
                transformOrigin: coin.haut ? "top" : "bottom",
              }}
            />
          </div>
        );
      })}
      {(["haut", "bas"] as const).map((bord) => (
        <div
          key={bord}
          style={{
            position: "absolute",
            left: retrait + longueurCoin + 16,
            right: retrait + longueurCoin + 16,
            top: bord === "haut" ? retrait : undefined,
            bottom: bord === "bas" ? retrait : undefined,
            height: 1,
            backgroundColor: alpha(couleurs.texte, 0.16),
            scale: `${pointille} 1`,
          }}
        />
      ))}
      {(["gauche", "droite"] as const).map((bord) => (
        <div
          key={bord}
          style={{
            position: "absolute",
            top: retrait + longueurCoin + 16,
            bottom: retrait + longueurCoin + 16,
            left: bord === "gauche" ? retrait : undefined,
            right: bord === "droite" ? retrait : undefined,
            width: 1,
            backgroundColor: alpha(couleurs.texte, 0.16),
            scale: `1 ${pointille}`,
          }}
        />
      ))}
      {(["haut", "bas", "gauche", "droite"] as const).map((bord) => {
        const horizontal = bord === "haut" || bord === "bas";
        return (
          <div
            key={`repere-${bord}`}
            style={{
              position: "absolute",
              top: bord === "haut" ? retrait : horizontal ? undefined : "50%",
              bottom: bord === "bas" ? retrait : undefined,
              left: bord === "gauche" ? retrait : horizontal ? "50%" : undefined,
              right: bord === "droite" ? retrait : undefined,
              width: horizontal ? EPAISSEUR : 18,
              height: horizontal ? 18 : EPAISSEUR,
              translate: horizontal ? "-50% 0" : "0 -50%",
              backgroundColor: trait,
              opacity: pointille,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          top: ecart,
          left: ecart,
          display: "flex",
          alignItems: "center",
          gap: 16,
          clipPath: `inset(-8px ${(1 - texteHaut) * 100}% -8px -8px)`,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            backgroundColor: couleurEtat(etat),
            boxShadow: `0 0 16px ${alpha(couleurEtat(etat), 0.6)}`,
            opacity: 0.7 + 0.3 * Math.cos(((frame - debut) / fps) * Math.PI),
          }}
        />
        <div
          style={{
            fontFamily: polices.donnees,
            fontWeight: 600,
            fontSize: tailles.etiquette,
            letterSpacing: "0.1em",
            color: couleurs.texte,
            lineHeight: 1,
          }}
        >
          {etiquette}
        </div>
      </div>
      {temps ? (
        <div
          style={{
            position: "absolute",
            top: ecart,
            right: ecart,
            display: "flex",
            alignItems: "baseline",
            gap: 20,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            lineHeight: 1,
            letterSpacing: "0.04em",
            clipPath: `inset(-8px -8px -8px ${(1 - texteHaut) * 100}%)`,
          }}
        >
          {date ? <span style={{ color: couleurs.texteDoux }}>{date}</span> : null}
          <span style={{ color: couleurs.texte }}>
            {temps.heure}
            <span style={{ color: couleurs.texteDoux }}>:{temps.images}</span>
          </span>
        </div>
      ) : null}
      {lectures.length > 0 ? (
        <div
          style={{
            position: "absolute",
            bottom: ecart,
            left: ecart,
            display: "flex",
            alignItems: "baseline",
            gap: 48,
          }}
        >
          {lectures.map((lecture, i) => {
            const p = avance(frame, debut + duree * 0.5 + i * 4, duree * 0.6);
            return (
              <div
                key={lecture.label}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  opacity: p,
                  translate: `0 ${(1 - p) * 14}px`,
                }}
              >
                <span
                  style={{
                    fontFamily: polices.interface,
                    fontWeight: 600,
                    fontSize: tailles.etiquette,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: couleurs.texteDoux,
                  }}
                >
                  {lecture.label}
                </span>
                <span
                  style={{
                    fontFamily: polices.donnees,
                    fontSize: tailles.etiquette,
                    color: lecture.etat ? couleurEtat(lecture.etat) : couleurs.texte,
                  }}
                >
                  {lecture.valeur}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
