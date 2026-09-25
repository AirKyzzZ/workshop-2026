import type React from "react";
import { interpolate } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, bloque } from "../../composants/charte/commun";

export type ViseeProps = {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  p: number;
  couleur?: string;
  coin?: number;
  pointille?: boolean;
  libelle?: React.ReactNode;
  detail?: React.ReactNode;
  libelleDroite?: boolean;
};

export const Visee: React.FC<ViseeProps> = ({ x, y, largeur, hauteur, p, couleur = couleurs.texte, coin = 26, pointille = false, libelle, detail, libelleDroite = false }) => {
  if (p <= 0) return null;
  const echelle = interpolate(p, [0, 1], [1.45, 1], bloque);
  const l = largeur * echelle;
  const h = hauteur * echelle;
  return (
    <div style={{ position: "absolute", left: x - l / 2, top: y - h / 2, width: l, height: h, opacity: interpolate(p, [0, 0.3], [0, 1], bloque) }}>
      {pointille ? <div style={{ position: "absolute", inset: 0, border: `1px dashed ${alpha(couleur, 0.5)}` }} /> : null}
      {[
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([cx, cy]) => (
        <div
          key={`${cx}${cy}`}
          style={{
            position: "absolute",
            left: cx ? undefined : -1,
            right: cx ? -1 : undefined,
            top: cy ? undefined : -1,
            bottom: cy ? -1 : undefined,
            width: coin,
            height: coin,
            borderLeft: cx ? undefined : `2px solid ${couleur}`,
            borderRight: cx ? `2px solid ${couleur}` : undefined,
            borderTop: cy ? undefined : `2px solid ${couleur}`,
            borderBottom: cy ? `2px solid ${couleur}` : undefined,
          }}
        />
      ))}
      {libelle ? (
        <div
          style={{
            position: "absolute",
            left: libelleDroite ? undefined : -1,
            right: libelleDroite ? -1 : undefined,
            bottom: "100%",
            marginBottom: 12,
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            whiteSpace: "nowrap",
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.08em",
            color: couleur,
            textShadow: `0 0 12px ${alpha(couleurs.fond, 0.9)}`,
          }}
        >
          {libelle}
        </div>
      ) : null}
      {detail ? (
        <div
          style={{
            position: "absolute",
            left: -1,
            top: "100%",
            marginTop: 12,
            whiteSpace: "nowrap",
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.06em",
            color: couleurs.texteDoux,
            textShadow: `0 0 12px ${alpha(couleurs.fond, 0.9)}`,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
};

export const Panneau: React.FC<{
  x: number;
  y: number;
  largeur: number;
  p: number;
  titre?: string;
  children: React.ReactNode;
  accent?: string;
}> = ({ x, y, largeur, p, titre, children, accent }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: largeur,
      boxSizing: "border-box",
      padding: "22px 28px 26px",
      backgroundColor: alpha(couleurs.fond, 0.78),
      border: `1px solid ${alpha(couleurs.texte, 0.1)}`,
      borderLeft: `3px solid ${accent ?? alpha(couleurs.texte, 0.35)}`,
      opacity: interpolate(p, [0, 0.4], [0, 1], bloque),
      translate: `${(1 - p) * -24}px 0`,
      clipPath: `inset(-2px ${(1 - p) * 100}% -2px -4px)`,
    }}
  >
    {titre ? (
      <div
        style={{
          paddingBottom: 14,
          marginBottom: 18,
          borderBottom: `1px solid ${couleurs.trait}`,
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.08em",
          color: couleurs.texteDoux,
          whiteSpace: "nowrap",
        }}
      >
        {titre}
      </div>
    ) : null}
    {children}
  </div>
);
