import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { bloque, courbes } from "../../composants/charte/commun";
import { CaptureReelle } from "../../composants/charte/capture-reelle";
import { FondScene } from "../../composants/charte/plateau";
import { nombreFr } from "../../composants/metier/commun";
import { Journal } from "../../composants/metier/journal";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";

const AUTEUR = valeurs.auteur.toLowerCase();
const POSTE = valeurs.posteVital.toLowerCase();
const CAPTURE = 150;
const RECUL = 270;

const LIGNES = [
  { frame: 12, heure: valeurs.heureIncident, type: "incident", sujet: AUTEUR, texte: `doigt d'honneur · ${nombreFr(valeurs.graviteGeste)}`, niveau: "attention" as const },
  { frame: 40, heure: valeurs.heureIncident, type: "conduite", sujet: AUTEUR, texte: `${nombreFr(valeurs.conduiteAvant)} → ${nombreFr(valeurs.conduiteApres)}` },
  { frame: 68, heure: valeurs.heureOrdre, type: "ordre", sujet: valeurs.commandant.toLowerCase(), texte: `${AUTEUR} → ${POSTE}` },
  { frame: 98, heure: valeurs.heureOrdre, type: "refus", sujet: AUTEUR, texte: `conduite ${nombreFr(valeurs.conduiteApres)}`, niveau: "critique" as const },
  { frame: 132, heure: valeurs.heureAffectation, type: "affectation", sujet: valeurs.remplacant.toLowerCase(), texte: `→ ${POSTE}`, niveau: "nominal" as const },
];

export const JournalDecisions: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("4.4");
  const recul = interpolate(frame, [RECUL, duree], [1, 0.94], { ...bloque, easing: courbes.bascule });

  return (
    <FondScene>
      <BarreCommandement p={1} />
      <AbsoluteFill style={{ scale: `${recul}`, opacity: interpolate(frame, [duree - 30, duree], [1, 0.6], bloque) }}>
        <div style={{ position: "absolute", left: 110, top: 230 }}>
          <Journal titre="JOURNAL DES DÉCISIONS" mention="TRAÇABILITÉ COMPLÈTE" largeur={1010} lignes={LIGNES} />
        </div>
        <div style={{ position: "absolute", left: 1186, top: 254 }}>
          <CaptureReelle
            capture="journal"
            libelle="CAPTURE RÉELLE · JOURNAL"
            largeur={640}
            cible={{ x: 0.42, y: 0.25 }}
            zoom={[1.5, 2.3]}
            debut={CAPTURE}
            duree={duree - CAPTURE}
            surbrillance={{ x: 0.19, y: 0.308, largeur: 0.62, hauteur: 0.04, debut: CAPTURE + 60 }}
          />
        </div>
      </AbsoluteFill>
      {LIGNES.map((l) => (
        <Sfx key={l.frame} nom="tic-point" a={l.frame} volume={l.niveau === "critique" ? 0.4 : 0.25} />
      ))}
      <Sfx nom="whoosh" a={CAPTURE - 4} volume={0.2} />
      <Sfx nom="whoosh" a={RECUL} volume={0.15} />
    </FondScene>
  );
};
