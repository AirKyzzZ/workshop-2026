import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { Chiffres, PONCTUATION_RESSERREE } from "./chiffres";
import { avance, bloque, brouiller, couleurEtat, courbes, formaterNombre, type Etat } from "./commun";

export type LectureProps = {
  label: string;
  valeur: number | string;
  unite?: string;
  decimales?: number;
  depuis?: number;
  etat?: Etat;
  debut?: number;
  duree?: number;
  taille?: number;
  alignement?: "gauche" | "droite";
};

export const Lecture: React.FC<LectureProps> = ({
  label,
  valeur,
  unite,
  decimales = 0,
  depuis = 0,
  etat,
  debut = 0,
  duree = 36,
  taille = 64,
  alignement = "gauche",
}) => {
  const frame = useCurrentFrame();
  const apparition = avance(frame, debut, 14);
  const decompte = avance(frame, debut + 4, duree, courbes.entree);
  const final = typeof valeur === "number" ? formaterNombre(valeur, decimales) : valeur;
  const affiche =
    typeof valeur === "number"
      ? formaterNombre(interpolate(decompte, [0, 1], [depuis, valeur], bloque), decimales)
      : brouiller(valeur, decompte, frame, label);
  const couleurValeur = etat ? couleurEtat(etat) : couleurs.texte;
  const droite = alignement === "droite";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: droite ? "flex-end" : "flex-start",
        gap: 12,
        paddingLeft: droite ? 0 : 24,
        paddingRight: droite ? 24 : 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          left: droite ? undefined : 0,
          right: droite ? 0 : undefined,
          width: 2,
          backgroundColor: etat ? couleurEtat(etat) : couleurs.traitClair,
          scale: `1 ${apparition}`,
          transformOrigin: "top",
        }}
      />
      <div
        style={{
          fontFamily: polices.interface,
          fontWeight: 600,
          fontSize: tailles.etiquette,
          lineHeight: 1,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: couleurs.texteDoux,
          opacity: apparition,
          translate: `${(droite ? 1 : -1) * (1 - apparition) * 12}px 0`,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: Math.round(taille * 0.2),
          fontFamily: polices.donnees,
          lineHeight: 1,
          opacity: interpolate(apparition, [0, 0.4], [0, 1], bloque),
        }}
      >
        <span
          style={{
            display: "inline-block",
            minWidth: `calc(${[...final].length}ch - ${(final.match(/[,:]/g) ?? []).length * PONCTUATION_RESSERREE}em)`,
            textAlign: "right",
            fontSize: taille,
            color: couleurValeur,
            whiteSpace: "pre",
          }}
        >
          <Chiffres texte={affiche} />
        </span>
        {unite ? (
          <span style={{ fontSize: Math.max(tailles.etiquette, Math.round(taille * 0.42)), color: couleurs.texteDoux }}>
            {unite}
          </span>
        ) : null}
      </div>
    </div>
  );
};
