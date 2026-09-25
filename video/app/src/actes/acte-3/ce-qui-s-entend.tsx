import type React from "react";
import { useCurrentFrame } from "remotion";
import { avance } from "../../composants/charte/commun";
import { BarresClasses } from "../../composants/metier/barres-classes";
import { nombreFr } from "../../composants/metier/commun";
import { OndeSonore } from "../../composants/metier/onde-sonore";
import { Transcription } from "../../composants/metier/transcription";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { VueAtria } from "./vue-atria";

const DUREE = framesDe("3.4");
const DEBUT_ONDE = 0;
const CRI = 56;
const DEBUT_CLASSES = 28;
const DEBUT_MOTS = Math.round(DUREE * 0.34);
const PAS_MOTS = 5;
const LEGENDE = Math.round(DUREE * 0.66);

const MOTS = valeurs.transcription.split(" ");
const MASQUE = DEBUT_MOTS + MOTS.length * PAS_MOTS + 4;

export const CeQuiSEntend: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <VueAtria id="3.4" couche={3} voile={0.55} serre={{ vitesse: 0.45 }}>
      <div style={{ position: "absolute", left: 110, top: 178, opacity: avance(frame, DEBUT_ONDE, 8) }}>
        <OndeSonore
          largeur={1020}
          hauteur={110}
          graine="serre-embrouille"
          debut={DEBUT_ONDE}
          evenements={[
            { frame: 8, duree: 24, niveau: 0.42 },
            { frame: 36, duree: 14, niveau: 0.5 },
            { frame: CRI, duree: 24, niveau: 0.95, ton: "attention", libelle: `CRI · ${nombreFr(valeurs.scoreCri)}` },
            { frame: DEBUT_MOTS, duree: MASQUE - DEBUT_MOTS - 8, niveau: 0.55 },
            { frame: MASQUE - 6, duree: 12, niveau: 0.85, ton: "critique" },
            { frame: MASQUE + 14, duree: 26, niveau: 0.4 },
          ]}
        />
      </div>
      <div style={{ position: "absolute", left: 1230, top: 200, opacity: avance(frame, DEBUT_CLASSES - 4, 8) }}>
        <BarresClasses
          titre={`YAMNET · ${valeurs.classesYamnet} CLASSES`}
          largeur={580}
          debut={DEBUT_CLASSES}
          classes={[
            { libelle: "Parole", score: valeurs.scoreParole },
            { libelle: "Cri", score: valeurs.scoreCri, niveau: "attention" },
          ]}
        />
      </div>
      <div style={{ position: "absolute", left: 110, top: 428, opacity: avance(frame, DEBUT_MOTS - 12, 8) }}>
        <Transcription
          entete="TRANSCRIPTION · VOSK FR · SUR LA CARTE"
          largeur={1700}
          hauteurMin={60}
          mots={[
            ...MOTS.map((texte, i) => ({ texte, frame: DEBUT_MOTS + i * PAS_MOTS })),
            { texte: valeurs.motMasque, frame: MASQUE, masque: { type: "insulte", gravite: valeurs.graviteInsulte } },
          ]}
          legende={{
            frame: LEGENDE,
            niveaux: [
              { libelle: "juron", gravite: valeurs.graviteJuron },
              { libelle: "insulte", gravite: valeurs.graviteInsulte },
              { libelle: "menace", gravite: valeurs.graviteMenace },
            ],
          }}
        />
      </div>
      <Sfx nom="pulsation" a={CRI} volume={0.25} />
      <Sfx nom="telemetrie-bip" a={DEBUT_CLASSES + 8} volume={0.25} />
      <Sfx nom="buzzer-refus" a={MASQUE + 2} volume={0.18} duree={24} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} nom="tic-point" a={LEGENDE + i * 5} volume={0.25} />
      ))}
    </VueAtria>
  );
};
