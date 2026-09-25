import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, couleurNiveau, progression, type Niveau } from "./commun";

export type LigneJournal = { frame: number; heure: string; type: string; sujet?: string; texte: string; niveau?: Niveau };

export type JournalProps = {
  lignes: LigneJournal[];
  titre?: string;
  mention?: string;
  largeur?: number;
  vitesse?: number;
};

const HAUTEUR_LIGNE = 76;
const DELAI_FRAPPE = 6;

export const Journal: React.FC<JournalProps> = ({ lignes, titre, mention, largeur = 1400, vitesse = 1.6 }) => {
  const frame = useCurrentFrame();
  const premier = lignes.length > 0 ? Math.min(...lignes.map((l) => l.frame)) : 0;
  const pEntete = progression(frame, premier - 12, 14);

  return (
    <div style={{ width: largeur }}>
      {titre || mention ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingBottom: 18,
            borderBottom: `1px solid ${couleurs.trait}`,
            opacity: pEntete,
            fontFamily: polices.donnees,
            fontSize: 24,
            letterSpacing: "0.06em",
          }}
        >
          <span style={{ color: couleurs.texteDoux }}>{titre}</span>
          <span style={{ color: couleurs.texte }}>{mention}</span>
        </div>
      ) : null}

      {lignes.map((l, i) => {
        const pOuverture = progression(frame, l.frame, 12);
        if (pOuverture <= 0) return null;
        const couleur = l.niveau ? couleurNiveau(l.niveau) : couleurs.texteDoux;
        const prefixe = l.sujet ? `${l.sujet} · ` : "";
        const complet = prefixe + l.texte;
        const tapes = Math.max(0, Math.min(complet.length, Math.floor((frame - l.frame - DELAI_FRAPPE) * vitesse)));
        const enFrappe = tapes < complet.length;
        const sujetVisible = l.sujet ? l.sujet.slice(0, tapes) : "";
        const resteVisible = complet.slice(Math.min(tapes, l.sujet?.length ?? 0), tapes);
        const critique = l.niveau === "critique";
        const pSurbrillance = interpolate(frame, [l.frame, l.frame + 8, l.frame + 40], [0, 1, critique ? 0.55 : 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={`${l.frame}-${i}`}
            style={{
              height: HAUTEUR_LIGNE * pOuverture,
              overflow: "hidden",
              position: "relative",
              borderBottom: `1px solid ${couleurs.trait}`,
              backgroundColor: alpha(critique ? couleurs.critique : couleurs.texte, (critique ? 0.12 : 0.05) * pSurbrillance),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 14,
                bottom: 14,
                width: 3,
                backgroundColor: couleur,
                opacity: critique ? 1 : 0,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: HAUTEUR_LIGNE,
                paddingLeft: 24,
                opacity: pOuverture,
                translate: `0px ${interpolate(pOuverture, [0, 1], [-10, 0])}px`,
              }}
            >
              <div style={{ width: 196, fontFamily: polices.donnees, fontSize: 26, color: couleurs.texteFaible }}>{l.heure}</div>
              <div style={{ width: 260, fontFamily: polices.donnees, fontSize: 24, letterSpacing: "0.08em", color: couleur }}>
                {l.type.toUpperCase()}
              </div>
              <div style={{ flex: 1, fontFamily: polices.interface, fontSize: 32, color: couleurs.texte, whiteSpace: "nowrap" }}>
                <span style={{ fontWeight: 600, color: couleurs.blanc }}>{sujetVisible}</span>
                <span>{resteVisible}</span>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 30,
                    marginLeft: 4,
                    verticalAlign: "-4px",
                    backgroundColor: couleurs.texte,
                    opacity: enFrappe ? 0.9 : 0,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
