import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes, formaterNombre } from "../../composants/charte/commun";
import { FicheIdentite } from "../../composants/charte/fiche-identite";
import { Rush } from "../../composants/charte/rush";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { cadreVisage, DECALAGE_MAIN, HAUTEUR_SOURCE, imageMainReelle, LARGEUR_SOURCE } from "./main-reelle";
import { Visee } from "./visee";
import { VueAtria } from "./vue-atria";

const DUREE = framesDe("3.6");
const LECTURE = { debut: 40, vitesse: 1 };
const GESTE = 2;
const FLECHE = 16;
const DUREE_FLECHE = 16;
const AUTEUR = FLECHE + DUREE_FLECHE;
const FICHE = Math.round(DUREE * 0.46);
const MARGE_MAIN = 24;
const BOUT_MAJEUR = 12;

export const QuiLAFait: React.FC = () => {
  const frame = useCurrentFrame();
  const image = imageMainReelle(LECTURE.debut, LECTURE.vitesse, frame);
  const points = image.points.map((p) => ({ x: p.x * LARGEUR_SOURCE, y: p.y * HAUTEUR_SOURCE }));
  const main = {
    x0: Math.min(...points.map((p) => p.x)) - MARGE_MAIN,
    x1: Math.max(...points.map((p) => p.x)) + MARGE_MAIN,
    y0: Math.min(...points.map((p) => p.y)) - MARGE_MAIN,
    y1: Math.max(...points.map((p) => p.y)) + MARGE_MAIN,
  };
  const visage = cadreVisage(image.visage);
  const trace = avance(frame, FLECHE, DUREE_FLECHE, courbes.bascule);
  const auteur = avance(frame, AUTEUR, 10);
  const depart = { x: points[BOUT_MAJEUR].x - 6, y: points[BOUT_MAJEUR].y - 18 };
  const arrivee = { x: visage.x + visage.largeur + 12, y: visage.y + visage.hauteur * 0.5 };
  const controle = { x: (depart.x + arrivee.x) / 2 + 10, y: Math.min(depart.y, arrivee.y) - 70 };
  const chemin = `M ${depart.x} ${depart.y} Q ${controle.x} ${controle.y} ${arrivee.x} ${arrivee.y}`;
  const t = Math.max(0.001, trace);
  const pointe = {
    x: (1 - t) ** 2 * depart.x + 2 * (1 - t) * t * controle.x + t ** 2 * arrivee.x,
    y: (1 - t) ** 2 * depart.y + 2 * (1 - t) * t * controle.y + t ** 2 * arrivee.y,
  };
  const angle = Math.atan2(arrivee.y - controle.y, arrivee.x - controle.x);
  const secondes = Math.round(interpolate(auteur, [0, 1], [0, valeurs.reconnuIlYA], bloque));

  return (
    <VueAtria id="3.6" couche={5} plan={<AbsoluteFill style={{ backgroundColor: couleurs.fond }} />}>
      <AbsoluteFill style={{ translate: `${DECALAGE_MAIN}px 0` }}>
        <Rush nom="doigt-honneur" debut={LECTURE.debut} vitesse={LECTURE.vitesse} etalonnage="saturate(0.55) contrast(1.16) brightness(0.44)" vignette={0.4} />
        <div
          style={{
            position: "absolute",
            left: 1250 - DECALAGE_MAIN - 140,
            top: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(to right, ${alpha(couleurs.fond, 0)} 0px, ${alpha(couleurs.fond, 0.82)} 90px, ${couleurs.fond} 100%)`,
          }}
        />
        <Visee
          x={(main.x0 + main.x1) / 2}
          y={(main.y0 + main.y1) / 2}
          largeur={main.x1 - main.x0}
          hauteur={main.y1 - main.y0}
          p={avance(frame, GESTE, 10)}
          couleur={couleurs.critique}
          libelleDroite
          libelle={<span style={{ color: couleurs.critique }}>{"DOIGT D'HONNEUR"}</span>}
        />
        <Visee
          x={visage.x + visage.largeur / 2}
          y={visage.y + visage.hauteur / 2}
          largeur={visage.largeur}
          hauteur={visage.hauteur}
          p={avance(frame, AUTEUR - 4, 10)}
          couleur={couleurs.attention}
          pointille
        />
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={chemin} fill="none" stroke={couleurs.attention} strokeWidth={3} strokeDasharray="1 1" pathLength={1} strokeDashoffset={1 - trace} />
          {trace > 0.02 ? <circle cx={pointe.x} cy={pointe.y} r={6} fill={couleurs.blanc} opacity={1 - avance(frame, AUTEUR, 6)} /> : null}
          <path
            d={`M ${arrivee.x} ${arrivee.y} l ${-16 * Math.cos(angle - 0.45)} ${-16 * Math.sin(angle - 0.45)} M ${arrivee.x} ${arrivee.y} l ${-16 * Math.cos(angle + 0.45)} ${-16 * Math.sin(angle + 0.45)}`}
            stroke={couleurs.attention}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={avance(frame, AUTEUR - 3, 4)}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: visage.x,
            top: visage.y + visage.hauteur + 18,
            padding: "10px 18px 12px",
            backgroundColor: alpha(couleurs.fond, 0.8),
            borderLeft: `3px solid ${couleurs.attention}`,
            fontFamily: polices.donnees,
            fontSize: tailles.etiquette,
            letterSpacing: "0.06em",
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            opacity: auteur,
            translate: `0 ${(1 - auteur) * 12}px`,
          }}
        >
          <div style={{ color: couleurs.texteDoux }}>
            AUTEUR · <span style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 56, letterSpacing: "0.02em", color: couleurs.attention }}>{valeurs.auteur}</span>
          </div>
          <div style={{ color: couleurs.texte }}>{`RECONNU IL Y A ${secondes} S`}</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 1250, top: 540 }}>
        <FicheIdentite
          surtitre="JOURNAL · INCIDENT"
          nom="DOIGT D'HONNEUR"
          role={`CAMÉRA · ${valeurs.heureIncident}`}
          statut={`GRAVITÉ ${formaterNombre(valeurs.graviteGeste, 2)}`}
          etat="attention"
          cote="droite"
          debut={FICHE}
          duree={24}
          largeur={580}
        />
      </div>
      <Sfx nom="verrouillage" a={GESTE + 4} volume={0.3} />
      <Sfx nom="whoosh" a={FLECHE} volume={0.22} />
      <Sfx nom="tic-point" a={AUTEUR} volume={0.35} />
      <Sfx nom="telemetrie-bip" a={FICHE + 12} volume={0.3} />
    </VueAtria>
  );
};
