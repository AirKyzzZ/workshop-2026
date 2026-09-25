import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, progression } from "./commun";

export type Controle = { libelle: string; detail?: string; ok: boolean };

export type ListeControlesProps = {
  controles: Controle[];
  libelleNonEvalue: string;
  titre?: string;
  verdicts?: { refuse: string; valide: string };
  debut?: number;
  intervalle?: number;
  dureeAnalyse?: number;
  largeur?: number;
};

const CASE = 60;
const HAUTEUR_RANGEE = 104;

const Coche: React.FC<{ ok: boolean; p: number; couleur: string }> = ({ ok, p, couleur }) => (
  <svg width={CASE} height={CASE} style={{ position: "absolute", inset: 0 }}>
    {ok ? (
      <path d="M 17 31 L 26 40 L 44 21" fill="none" stroke={couleur} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    ) : (
      <>
        <path d="M 20 20 L 40 40" fill="none" stroke={couleur} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, p * 2)} />
        <path d="M 40 20 L 20 40" fill="none" stroke={couleur} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, p * 2 - 1)} />
      </>
    )}
  </svg>
);

export const ListeControles: React.FC<ListeControlesProps> = ({
  controles,
  libelleNonEvalue,
  titre,
  verdicts,
  debut = 0,
  intervalle = 24,
  dureeAnalyse = 14,
  largeur = 1100,
}) => {
  const frame = useCurrentFrame();
  const echec = controles.findIndex((c) => !c.ok);
  const derniere = echec === -1 ? controles.length - 1 : echec;
  const debutControle = (i: number) => debut + 12 + i * intervalle;
  const finControle = (i: number) => debutControle(i) + dureeAnalyse;
  const pListe = progression(frame, debut, 16);
  const pVerdict = verdicts ? progression(frame, finControle(derniere) + 10, 18) : 0;
  return (
    <div style={{ width: largeur }}>
      {titre ? (
        <div
          style={{
            paddingBottom: 18,
            marginBottom: 12,
            borderBottom: `1px solid ${couleurs.trait}`,
            fontFamily: polices.donnees,
            fontSize: 24,
            letterSpacing: "0.06em",
            color: couleurs.texteDoux,
            opacity: pListe,
          }}
        >
          {titre}
        </div>
      ) : null}

      <div style={{ position: "relative" }}>
        {controles.slice(0, -1).map((c, i) => {
          const franchi = c.ok && i < derniere;
          return (
            <div
              key={`rail-${c.libelle}`}
              style={{
                position: "absolute",
                left: CASE / 2 - 1,
                top: i * HAUTEUR_RANGEE + (HAUTEUR_RANGEE + CASE) / 2 + 6,
                width: 2,
                height: HAUTEUR_RANGEE - CASE - 12,
                backgroundColor: couleurs.trait,
                opacity: pListe,
              }}
            >
              <div
                style={{
                  width: 2,
                  height: "100%",
                  backgroundColor: couleurs.nominal,
                  scale: `1 ${franchi ? progression(frame, finControle(i) + 4, debutControle(i + 1) - finControle(i) - 4) : 0}`,
                  transformOrigin: "top",
                }}
              />
            </div>
          );
        })}

        {controles.map((c, i) => {
          const pEntree = progression(frame, debut + i * 4, 14);
          const evalue = i <= derniere;
          const enCours = evalue && frame >= debutControle(i) && frame < finControle(i);
          const pResultat = evalue ? progression(frame, finControle(i), 12) : 0;
          const pNonEvalue = !evalue ? progression(frame, finControle(derniere) + 6, 14) : 0;
          const couleurResultat = c.ok ? couleurs.nominal : couleurs.critique;
          const couleurCase = interpolateColors(pResultat, [0, 1], [enCours ? couleurs.texte : couleurs.traitClair, couleurResultat]);
          const actif = evalue && frame >= debutControle(i);
          const rotation = interpolate(frame, [debutControle(i), finControle(i)], [0, 540], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={c.libelle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 36,
                height: HAUTEUR_RANGEE,
                opacity: pEntree * (actif ? 1 : 0.5),
                translate: `${interpolate(pEntree, [0, 1], [-14, 0])}px 0px`,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: CASE,
                  height: CASE,
                  flexShrink: 0,
                  border: `2px solid ${couleurCase}`,
                  backgroundColor: pResultat > 0 ? alpha(couleurResultat, 0.14 * pResultat) : couleurs.fond,
                }}
              >
                {enCours ? (
                  <svg width={CASE} height={CASE} style={{ position: "absolute", inset: -2, rotate: `${rotation}deg` }}>
                    <circle cx={CASE / 2} cy={CASE / 2} r={15} fill="none" stroke={couleurs.texte} strokeWidth={3} strokeDasharray="34 60" strokeLinecap="round" />
                  </svg>
                ) : null}
                {pResultat > 0 ? <Coche ok={c.ok} p={pResultat} couleur={couleurResultat} /> : null}
              </div>
              <div
                style={{
                  flex: 1,
                  fontFamily: polices.display,
                  fontWeight: 500,
                  fontSize: 60,
                  lineHeight: 1,
                  paddingTop: 8,
                  letterSpacing: "0.02em",
                  color: pResultat > 0 && !c.ok ? couleurs.critique : couleurs.texte,
                }}
              >
                {c.libelle}
              </div>
              <div
                style={{
                  fontFamily: polices.donnees,
                  fontSize: 30,
                  color: evalue ? couleurResultat : couleurs.texteDoux,
                  opacity: evalue ? pResultat : pNonEvalue,
                  translate: `${interpolate(evalue ? pResultat : pNonEvalue, [0, 1], [12, 0])}px 0px`,
                }}
              >
                {evalue ? c.detail : libelleNonEvalue}
              </div>
            </div>
          );
        })}
      </div>

      {verdicts ? (
        <div
          style={{
            marginTop: 28,
            paddingTop: 24,
            borderTop: `2px solid ${echec === -1 ? couleurs.nominal : couleurs.critique}`,
            fontFamily: polices.display,
            fontWeight: 600,
            fontSize: 96,
            lineHeight: 1,
            color: echec === -1 ? couleurs.nominal : couleurs.critique,
            textShadow: `0 0 28px ${alpha(echec === -1 ? couleurs.nominal : couleurs.critique, 0.4)}`,
            opacity: pVerdict,
            translate: `0px ${interpolate(pVerdict, [0, 1], [16, 0])}px`,
          }}
        >
          {echec === -1 ? verdicts.valide : verdicts.refuse}
        </div>
      ) : null}
    </div>
  );
};
