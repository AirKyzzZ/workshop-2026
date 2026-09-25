import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { couleurs, marge, polices, tailles } from "../../charte";
import { avance, couleurEtat, courbes, type Etat } from "./commun";

export type LigneCinetique = string | { texte: string; etat?: Etat; doux?: boolean };

export type TypoCinetiqueProps = {
  lignes: LigneCinetique[];
  surtitre?: string;
  debut?: number;
  decalage?: number;
  duree?: number;
  sortie?: number;
  taille?: number;
  alignement?: "gauche" | "centre";
};

export const TypoCinetique: React.FC<TypoCinetiqueProps> = ({
  lignes,
  surtitre,
  debut = 0,
  decalage = 6,
  duree = 26,
  sortie,
  taille = tailles.titreGeant,
  alignement = "gauche",
}) => {
  const frame = useCurrentFrame();
  const centre = alignement === "centre";
  const departLignes = surtitre ? debut + 8 : debut;
  const surtitreEntre = avance(frame, debut, duree);
  const surtitreSort = sortie === undefined ? 0 : avance(frame, sortie, duree * 0.7, courbes.bascule);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: centre ? "center" : "flex-start",
        paddingLeft: marge * 1.5,
        paddingRight: marge * 1.5,
      }}
    >
      {surtitre ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: Math.round(taille * 0.16),
            opacity: 1 - surtitreSort,
          }}
        >
          <div style={{ width: 56, height: 2, backgroundColor: couleurs.texte, scale: `${surtitreEntre} 1`, transformOrigin: "left" }} />
          <div
            style={{
              fontFamily: polices.donnees,
              fontSize: tailles.etiquette,
              letterSpacing: "0.24em",
              color: couleurs.texteDoux,
              clipPath: `inset(-6px ${(1 - surtitreEntre) * 100}% -6px -6px)`,
            }}
          >
            {surtitre}
          </div>
        </div>
      ) : null}
      {lignes.map((ligne, i) => {
        const { texte, etat, doux } = typeof ligne === "string" ? { texte: ligne, etat: undefined, doux: false } : ligne;
        const entre = avance(frame, departLignes + i * decalage, duree);
        const sort = sortie === undefined ? 0 : avance(frame, sortie + i * Math.round(decalage / 2), duree * 0.7, courbes.bascule);
        return (
          <div
            key={`${i}-${texte}`}
            style={{
              overflow: "hidden",
              paddingTop: Math.round(taille * 0.12),
              marginTop: i === 0 ? 0 : -Math.round(taille * 0.2),
            }}
          >
            <div
              style={{
                fontFamily: polices.display,
                fontWeight: 600,
                fontSize: taille,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: "0.005em",
                whiteSpace: "nowrap",
                textAlign: centre ? "center" : "left",
                color: etat ? couleurEtat(etat) : doux ? couleurs.texteFaible : couleurs.texte,
                translate: `0 ${(1 - entre) * 108 - sort * 108}%`,
              }}
            >
              {texte}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
