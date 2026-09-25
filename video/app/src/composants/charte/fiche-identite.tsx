import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, brouiller, couleurEtat, type Etat } from "./commun";

export type FicheIdentiteProps = {
  nom: string;
  role: string;
  statut: string;
  etat?: Etat;
  surtitre?: string;
  matricule?: string;
  cote?: "gauche" | "droite";
  debut?: number;
  duree?: number;
  largeur?: number;
  children?: React.ReactNode;
};

export const FicheIdentite: React.FC<FicheIdentiteProps> = ({
  nom,
  role,
  statut,
  etat = "nominal",
  surtitre,
  matricule,
  cote = "droite",
  debut = 0,
  duree = 40,
  largeur = 640,
  children,
}) => {
  const frame = useCurrentFrame();
  const couleur = couleurEtat(etat);
  const sens = cote === "droite" ? 1 : -1;
  const carte = avance(frame, debut, duree * 0.55);
  const nomEntre = avance(frame, debut + duree * 0.18, duree * 0.5);
  const roleEntre = avance(frame, debut + duree * 0.3, duree * 0.5);
  const filet = avance(frame, debut + duree * 0.38, duree * 0.5);
  const statutEntre = avance(frame, debut + duree * 0.5, duree * 0.6);
  const pulsation = 0.55 + 0.45 * Math.cos(((frame - debut) / 30) * Math.PI);
  const decoupe = (1 - carte) * 100;

  return (
    <div
      style={{
        position: "relative",
        width: largeur,
        boxSizing: "border-box",
        padding: "24px 34px 28px 42px",
        backgroundColor: alpha(couleurs.panneau, 0.94),
        border: `1px solid ${alpha(couleurs.texte, 0.09)}`,
        translate: `${sens * (1 - carte) * 56}px 0`,
        opacity: interpolate(carte, [0, 0.25], [0, 1], bloque),
        clipPath: cote === "droite" ? `inset(-1px -1px -1px ${decoupe}%)` : `inset(-1px ${decoupe}% -1px -1px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: couleur,
          boxShadow: `0 0 18px ${alpha(couleur, 0.5)}`,
          scale: `1 ${carte}`,
          transformOrigin: "top",
        }}
      />
      {([true, false] as const).map((haut) => (
        <div
          key={String(haut)}
          style={{
            position: "absolute",
            top: haut ? 10 : undefined,
            bottom: haut ? undefined : 10,
            right: 10,
            width: 14,
            height: 14,
            borderRight: `2px solid ${couleurs.traitClair}`,
            borderTop: haut ? `2px solid ${couleurs.traitClair}` : undefined,
            borderBottom: haut ? undefined : `2px solid ${couleurs.traitClair}`,
            opacity: filet,
          }}
        />
      ))}
      {surtitre || matricule ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 0,
            opacity: carte,
          }}
        >
          <span
            style={{
              fontFamily: polices.interface,
              fontWeight: 600,
              fontSize: tailles.etiquette,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: couleurs.texteDoux,
            }}
          >
            {surtitre}
          </span>
          <span style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.texteFaible, marginRight: 16 }}>
            {matricule}
          </span>
        </div>
      ) : null}
      <div style={{ overflow: "hidden", paddingTop: 10 }}>
        <div
          style={{
            fontFamily: polices.display,
            fontWeight: 600,
            fontSize: 92,
            lineHeight: 0.92,
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            color: couleurs.texte,
            translate: `0 ${(1 - nomEntre) * 105}%`,
          }}
        >
          {nom}
        </div>
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: polices.interface,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: couleurs.texteDoux,
          opacity: roleEntre,
          translate: `${sens * (1 - roleEntre) * 16}px 0`,
        }}
      >
        {role}
      </div>
      <div
        style={{
          height: 1,
          marginTop: 22,
          marginBottom: 20,
          backgroundColor: couleurs.traitClair,
          scale: `${filet} 1`,
          transformOrigin: "left",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            flexShrink: 0,
            backgroundColor: couleur,
            boxShadow: `0 0 ${10 + pulsation * 10}px ${alpha(couleur, 0.7)}`,
            opacity: statutEntre * (0.6 + 0.4 * pulsation),
            scale: `${statutEntre}`,
          }}
        />
        <div
          style={{
            fontFamily: polices.donnees,
            fontWeight: 600,
            fontSize: tailles.etiquette,
            lineHeight: 1.25,
            letterSpacing: "0.04em",
            color: couleur,
            whiteSpace: "pre-wrap",
          }}
        >
          {brouiller(statut, statutEntre, frame, nom)}
        </div>
      </div>
      {children ? <div style={{ marginTop: 24, opacity: statutEntre }}>{children}</div> : null}
    </div>
  );
};
