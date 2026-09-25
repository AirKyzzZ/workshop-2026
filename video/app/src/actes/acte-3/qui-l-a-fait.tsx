import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes, formaterNombre } from "../../composants/charte/commun";
import { FicheIdentite } from "../../composants/charte/fiche-identite";
import { positionMain, positionTete } from "../../composants/charte/plan-factice";
import { Sfx } from "../../composants/son";
import { valeurs } from "../../donnees";
import { decalageActe3 } from "./commun";
import { Visee } from "./visee";
import { VueAtria } from "./vue-atria";

const GESTE = 10;
const FLECHE = 34;
const DUREE_FLECHE = 26;
const AUTEUR = FLECHE + DUREE_FLECHE;
const FICHE = 96;

export const QuiLAFait: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame + decalageActe3("3.6");
  const main = positionMain(f, 1);
  const tete = positionTete(0, f);
  const trace = avance(frame, FLECHE, DUREE_FLECHE, courbes.bascule);
  const auteur = avance(frame, AUTEUR, 16);
  const depart = { x: main.x - 40, y: main.y - 70 };
  const arrivee = { x: tete.x + 60, y: tete.y - 104 };
  const controle = { x: (depart.x + arrivee.x) / 2, y: Math.min(depart.y, arrivee.y) - 110 };
  const chemin = `M ${depart.x} ${depart.y} Q ${controle.x} ${controle.y} ${arrivee.x} ${arrivee.y}`;
  const t = Math.max(0.001, trace);
  const pointe = {
    x: (1 - t) ** 2 * depart.x + 2 * (1 - t) * t * controle.x + t ** 2 * arrivee.x,
    y: (1 - t) ** 2 * depart.y + 2 * (1 - t) * t * controle.y + t ** 2 * arrivee.y,
  };
  const angle = Math.atan2(arrivee.y - controle.y, arrivee.x - controle.x);
  const secondes = Math.round(interpolate(auteur, [0, 1], [0, valeurs.reconnuIlYA], bloque));

  return (
    <VueAtria id="3.6" couche={5} planProps={{ geste: 1 }}>
      <Visee
        x={main.x}
        y={main.y}
        largeur={210}
        hauteur={210}
        p={avance(frame, GESTE, 16)}
        couleur={couleurs.critique}
        detail={<span style={{ color: couleurs.critique }}>{"DOIGT D'HONNEUR"}</span>}
      />
      <Visee x={tete.x} y={tete.y} largeur={170} hauteur={200} p={avance(frame, AUTEUR - 6, 16)} couleur={couleurs.attention} pointille />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={chemin} fill="none" stroke={couleurs.attention} strokeWidth={2.5} strokeDasharray="1 1" pathLength={1} strokeDashoffset={1 - trace} />
        {trace > 0.02 ? (
          <circle cx={pointe.x} cy={pointe.y} r={6} fill={couleurs.blanc} opacity={1 - avance(frame, AUTEUR, 8)} />
        ) : null}
        <path
          d={`M ${arrivee.x} ${arrivee.y} l ${-16 * Math.cos(angle - 0.45)} ${-16 * Math.sin(angle - 0.45)} M ${arrivee.x} ${arrivee.y} l ${-16 * Math.cos(angle + 0.45)} ${-16 * Math.sin(angle + 0.45)}`}
          stroke={couleurs.attention}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={avance(frame, AUTEUR - 4, 6)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          right: 1920 - (tete.x - 110),
          top: tete.y - 40,
          textAlign: "right",
          fontFamily: polices.donnees,
          fontSize: tailles.etiquette,
          letterSpacing: "0.06em",
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          opacity: auteur,
          translate: `${(1 - auteur) * -14}px 0`,
          textShadow: `0 0 14px ${alpha(couleurs.fond, 0.9)}`,
        }}
      >
        <div style={{ color: couleurs.texteDoux }}>
          AUTEUR · <span style={{ fontFamily: polices.display, fontWeight: 600, fontSize: 56, letterSpacing: "0.02em", color: couleurs.attention }}>{valeurs.auteur}</span>
        </div>
        <div style={{ color: couleurs.texte }}>{`RECONNU IL Y A ${secondes} S`}</div>
      </div>
      <div style={{ position: "absolute", left: 110, top: 500 }}>
        <FicheIdentite
          surtitre="JOURNAL · INCIDENT"
          nom="DOIGT D'HONNEUR"
          role={`CAMÉRA · ${valeurs.heureIncident}`}
          statut={`GRAVITÉ ${formaterNombre(valeurs.graviteGeste, 2)}`}
          etat="attention"
          cote="gauche"
          debut={FICHE}
          largeur={780}
        />
      </div>
      <Sfx nom="verrouillage" a={GESTE + 4} volume={0.3} />
      <Sfx nom="whoosh" a={FLECHE} volume={0.22} />
      <Sfx nom="tic-point" a={AUTEUR} volume={0.35} />
      <Sfx nom="telemetrie-bip" a={FICHE + 20} volume={0.3} />
    </VueAtria>
  );
};
