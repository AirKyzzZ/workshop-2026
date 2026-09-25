import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, nombreFr, progression } from "./commun";

export type MotTranscrit = { texte: string; frame: number; masque?: { type: string; gravite: number } };
export type GraviteLegende = { libelle: string; gravite: number };

export type TranscriptionProps = {
  mots: MotTranscrit[];
  entete: string;
  legende?: { frame: number; niveaux: GraviteLegende[] };
  largeur?: number;
};

export const Transcription: React.FC<TranscriptionProps> = ({ mots, entete, legende, largeur = 1100 }) => {
  const frame = useCurrentFrame();
  const premier = mots.length > 0 ? mots[0].frame : 0;
  const pEntete = progression(frame, premier - 14, 14);
  const dernierVisible = mots.reduce((d, m, i) => (frame >= m.frame ? i : d), -1);
  const typesMasques = new Set(mots.filter((m) => m.masque && frame >= m.frame).map((m) => m.masque?.type.toLowerCase()));

  return (
    <div style={{ width: largeur }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 16,
          borderBottom: `1px solid ${couleurs.trait}`,
          opacity: pEntete,
          fontFamily: polices.donnees,
          fontSize: 24,
          letterSpacing: "0.06em",
          color: couleurs.texteDoux,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: couleurs.nominal,
            opacity: 0.55 + 0.45 * Math.cos(frame / 6),
          }}
        />
        {entete}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: 16,
          rowGap: 28,
          paddingTop: 76,
          minHeight: 200,
          fontFamily: polices.interface,
          fontSize: 48,
          lineHeight: 1.25,
          color: couleurs.texte,
        }}
      >
        {mots.map((m, i) => {
          const p = progression(frame, m.frame, 10);
          if (frame < m.frame) return null;
          const style: React.CSSProperties = {
            position: "relative",
            display: "inline-block",
            opacity: p,
            translate: `0px ${interpolate(p, [0, 1], [14, 0])}px`,
          };
          if (!m.masque) {
            return (
              <span key={i} style={{ ...style, color: i === dernierVisible ? couleurs.blanc : couleurs.texte }}>
                {m.texte}
              </span>
            );
          }
          const pMasque = progression(frame, m.frame, 8);
          const pEtiquette = progression(frame, m.frame + 8, 12);
          return (
            <span key={i} style={style}>
              <span style={{ color: "transparent" }}>{m.texte}</span>
              <span
                style={{
                  position: "absolute",
                  left: -4,
                  right: -4,
                  top: "14%",
                  bottom: "6%",
                  borderRadius: 3,
                  backgroundImage: `repeating-linear-gradient(135deg, ${couleurs.critique} 0 7px, ${alpha(couleurs.critique, 0.72)} 7px 14px)`,
                  boxShadow: `0 0 24px ${alpha(couleurs.critique, 0.35)}`,
                  scale: `${pMasque} 1`,
                  transformOrigin: "left",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: -4,
                  bottom: "100%",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "2px 12px",
                  whiteSpace: "nowrap",
                  border: `1px solid ${couleurs.critique}`,
                  backgroundColor: alpha(couleurs.critique, 0.12),
                  fontFamily: polices.donnees,
                  fontSize: 24,
                  lineHeight: 1.4,
                  letterSpacing: "0.06em",
                  color: couleurs.critique,
                  opacity: pEtiquette,
                  translate: `0px ${interpolate(pEtiquette, [0, 1], [8, 0])}px`,
                }}
              >
                {m.masque.type.toUpperCase()} · {nombreFr(m.masque.gravite * pEtiquette)}
              </span>
            </span>
          );
        })}
        <span
          style={{
            display: "inline-block",
            width: 3,
            height: 46,
            alignSelf: "center",
            backgroundColor: couleurs.texte,
            opacity: dernierVisible >= 0 && Math.floor(frame / 15) % 2 === 0 ? 0.8 : 0,
          }}
        />
      </div>

      {legende ? (
        <div style={{ display: "flex", gap: 20, marginTop: 56 }}>
          {legende.niveaux.map((n, i) => {
            const p = progression(frame, legende.frame + i * 5, 14);
            const actif = typesMasques.has(n.libelle.toLowerCase());
            const couleur = actif ? couleurs.critique : couleurs.texteDoux;
            return (
              <div
                key={n.libelle}
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  border: `1px solid ${actif ? couleurs.critique : couleurs.trait}`,
                  backgroundColor: actif ? alpha(couleurs.critique, 0.08) : alpha(couleurs.panneau, 0.6),
                  opacity: p,
                  translate: `0px ${interpolate(p, [0, 1], [12, 0])}px`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: polices.donnees,
                    fontSize: 24,
                    letterSpacing: "0.06em",
                    color: couleur,
                  }}
                >
                  <span>{n.libelle.toUpperCase()}</span>
                  <span>{nombreFr(n.gravite)}</span>
                </div>
                <div style={{ height: 4, marginTop: 14, backgroundColor: couleurs.trait }}>
                  <div
                    style={{
                      height: 4,
                      width: `${Math.min(1, n.gravite) * 100}%`,
                      backgroundColor: couleur,
                      scale: `${progression(frame, legende.frame + i * 5 + 4, 20)} 1`,
                      transformOrigin: "left",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
