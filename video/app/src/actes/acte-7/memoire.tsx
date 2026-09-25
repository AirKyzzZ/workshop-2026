import type React from "react";
import { useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, avance } from "../../composants/charte/commun";
import { Derive, FondScene } from "../../composants/charte/plateau";
import { BarreMemoire } from "../../composants/metier/barre-memoire";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";

const DEBUT = 0;
const INTERVALLE = 9;
const MO_PAR_GO = 1024;

const MODELES = valeurs.modeles.map((m) => ({ nom: m.nom, taille: m.mo / MO_PAR_GO, libelle: m.libelle }));
const SYSTEME = valeurs.memoireGo - valeurs.memoireLibreGo - MODELES.reduce((s, m) => s + m.taille, 0);
if (SYSTEME <= 0) throw new Error(`mémoire incohérente : ${valeurs.memoireLibreGo} Go libres ne laissent rien au système`);
const SEGMENTS = [{ nom: "Système", taille: SYSTEME, libelle: `${Math.round(SYSTEME * MO_PAR_GO)} Mo` }, ...MODELES];
const FIN_REMPLISSAGE = DEBUT + 16 + SEGMENTS.length * INTERVALLE + 6;
const CONCLUSION = FIN_REMPLISSAGE + 10;

export const Memoire: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("7.2");
  const pConclusion = avance(frame, CONCLUSION, 14);

  return (
    <FondScene>
      <Derive duree={duree} amplitude={0.01}>
        <div style={{ position: "absolute", left: 160, top: 104 }}>
          <BarreMemoire
            titre={`MÉMOIRE VIVE · ${valeurs.carte} · ${valeurs.nombreModeles} MODÈLES`}
            capacite={valeurs.memoireGo}
            unite="GO"
            libelleLibre="LIBRES"
            debut={DEBUT}
            intervalle={INTERVALLE}
            largeur={1600}
            segments={SEGMENTS}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 712,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 30,
            fontFamily: polices.display,
            fontWeight: 600,
            fontSize: 64,
            lineHeight: 1,
            whiteSpace: "pre",
            opacity: pConclusion,
            translate: `0 ${(1 - pConclusion) * 18}px`,
          }}
        >
          <span style={{ color: couleurs.texte }}>{`> ${Math.floor(valeurs.memoireLibreGo)} GO LIBRES`}</span>
          <span style={{ color: couleurs.texteFaible }}>·</span>
          <span style={{ color: couleurs.nominal, textShadow: `0 0 30px ${alpha(couleurs.nominal, 0.3)}` }}>{`${valeurs.octetsVersTerre} OCTET VERS LA TERRE`}</span>
        </div>
      </Derive>
      {SEGMENTS.map((s, i) => (
        <Sfx key={s.nom} nom="tic-point" a={DEBUT + 16 + i * INTERVALLE} volume={0.2} />
      ))}
      <Sfx nom="telemetrie-bip" a={FIN_REMPLISSAGE} volume={0.28} />
      <Sfx nom="verrouillage" a={CONCLUSION} volume={0.26} />
    </FondScene>
  );
};
