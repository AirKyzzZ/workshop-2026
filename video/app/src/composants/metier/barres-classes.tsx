import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, couleurNiveau, nombreFr, progression, type Niveau } from "./commun";

export type ClasseSon = { libelle: string; score: number; niveau?: Niveau };

export type BarresClassesProps = {
  classes: ClasseSon[];
  titre: string;
  debut?: number;
  intervalle?: number;
  largeur?: number;
};

const GRADUATIONS = [0, 0.25, 0.5, 0.75, 1];
const COLONNE_LIBELLE = 250;
const COLONNE_SCORE = 130;
const HAUTEUR_RANGEE = 64;

export const BarresClasses: React.FC<BarresClassesProps> = ({ classes, titre, debut = 0, intervalle = 5, largeur = 900 }) => {
  const frame = useCurrentFrame();
  const largeurPiste = largeur - COLONNE_LIBELLE - COLONNE_SCORE;
  const pCadre = progression(frame, debut, 16);

  return (
    <div style={{ width: largeur, position: "relative" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 16,
          borderBottom: `1px solid ${couleurs.trait}`,
          opacity: pCadre,
          fontFamily: polices.donnees,
          fontSize: 24,
          letterSpacing: "0.06em",
          color: couleurs.texteDoux,
        }}
      >
        <span>{titre}</span>
      </div>

      <div style={{ position: "relative", paddingTop: 20 }}>
        {GRADUATIONS.map((g) => (
          <div
            key={g}
            style={{
              position: "absolute",
              top: 20,
              bottom: 0,
              left: COLONNE_LIBELLE + g * largeurPiste,
              width: 1,
              backgroundColor: alpha(couleurs.texte, g === 0 ? 0.2 : 0.07),
              scale: `1 ${pCadre}`,
              transformOrigin: "top",
            }}
          />
        ))}

        {classes.map((c, i) => {
          const t0 = debut + 8 + i * intervalle;
          const pEntree = progression(frame, t0, 14);
          const pBarre = progression(frame, t0 + 2, 26);
          const couleur = c.niveau ? couleurNiveau(c.niveau) : couleurs.texte;
          return (
            <div
              key={c.libelle}
              style={{
                display: "flex",
                alignItems: "center",
                height: HAUTEUR_RANGEE,
                opacity: pEntree,
                translate: `${interpolate(pEntree, [0, 1], [-16, 0])}px 0px`,
              }}
            >
              <div
                style={{
                  width: COLONNE_LIBELLE,
                  paddingRight: 24,
                  fontFamily: polices.interface,
                  fontSize: 30,
                  color: c.niveau ? couleur : couleurs.texte,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.libelle}
              </div>
              <div style={{ width: largeurPiste, height: 10, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: largeurPiste * Math.min(1, Math.max(0, c.score)),
                    backgroundColor: couleur,
                    boxShadow: c.niveau ? `0 0 18px ${alpha(couleur, 0.45)}` : undefined,
                    scale: `${pBarre} 1`,
                    transformOrigin: "left",
                  }}
                />
              </div>
              <div
                style={{
                  width: COLONNE_SCORE,
                  textAlign: "right",
                  fontFamily: polices.donnees,
                  fontSize: 30,
                  color: c.niveau ? couleur : couleurs.texte,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {nombreFr(c.score * pBarre)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", height: 40, marginTop: 8, opacity: pCadre }}>
        {[0, 0.5, 1].map((g) => (
          <span
            key={g}
            style={{
              position: "absolute",
              left: COLONNE_LIBELLE + g * largeurPiste,
              top: 6,
              translate: g === 0 ? "0px 0px" : g === 1 ? "-100% 0px" : "-50% 0px",
              fontFamily: polices.donnees,
              fontSize: 24,
              color: couleurs.texteFaible,
            }}
          >
            {nombreFr(g, g === 0.5 ? 1 : 0)}
          </span>
        ))}
      </div>
    </div>
  );
};
