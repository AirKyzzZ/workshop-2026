import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { couleurs, polices, tailles } from "../../charte";
import { alpha, avance, bloque, courbes } from "../../composants/charte/commun";
import { EtiquetteTournage } from "../../composants/charte/plan-factice";
import { FondScene, Grain } from "../../composants/charte/plateau";
import { DISPOSITION, HAUTEUR_COMP, LARGEUR_COMP, type IdCompartiment } from "../../composants/metier/plan-vaisseau";
import { Sfx } from "../../composants/son";
import { framesDe, valeurs } from "../../donnees";
import { BarreCommandement } from "../acte-1/ordre";
import {
  CachePlan,
  centreDe,
  CompartimentBord,
  CoqueBord,
  DefsBord,
  emplacement,
  equipageDe,
  EquipierBord,
  IDS,
  porte,
  surPolyligne,
  trajetEntre,
  VAISSEAU,
  vueA,
} from "./plan-bord";

const FEU = 10;
const POUSSEE = 22;
const LCD = 60;
const PANNEAU = { x: 1214, y: 170, largeur: 620, hauteur: 318 };
const REACTEUR: IdCompartiment = "reacteur";
const OCCUPANTS = equipageDe(REACTEUR);
const SORTIES = [
  { debut: 100, duree: 64 },
  { debut: 136, duree: 92 },
];

if (OCCUPANTS.length !== valeurs.occupantsFeu) {
  throw new Error(`le réacteur compte ${OCCUPANTS.length} occupants dans equipageBord pour ${valeurs.occupantsFeu} attendus`);
}

const refugeDe = (nom: string): IdCompartiment => {
  const refuge = (valeurs.refugesEvacuation as Record<string, string>)[nom.toUpperCase()];
  const id = IDS.find((c) => c === refuge);
  if (!id) throw new Error(`refuge d'évacuation manquant pour ${nom}`);
  return id;
};

const TRAJETS = OCCUPANTS.map((nom, i) => {
  const refuge = refugeDe(nom);
  const points = trajetEntre(REACTEUR, i, refuge, equipageDe(refuge).length);
  const longueurs = points.slice(1).map((p, k) => Math.hypot(p.x - points[k].x, p.y - points[k].y));
  const seuilPorte = longueurs[0] / longueurs.reduce((s, l) => s + l, 0);
  const { debut, duree } = SORTIES[i];
  let sortie = debut + duree;
  for (let f = debut; f <= debut + duree; f++) {
    if (courbes.bascule((f - debut) / duree) >= seuilPorte) {
      sortie = f;
      break;
    }
  }
  return { nom, points, debut, duree, sortie };
});

const DERNIER_SORTI = Math.max(...TRAJETS.map((t) => t.sortie));
const FERMETURE = DERNIER_SORTI + 6;
const SCELLE = FERMETURE + 18;

const Cellules: React.FC<{ texte: string; visible: boolean }> = ({ texte, visible }) => (
  <div style={{ display: "flex", gap: 3 }}>
    {Array.from({ length: 16 }, (_, i) => {
      const c = texte[i] ?? " ";
      return (
        <div
          key={i}
          style={{
            width: 25,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: alpha(couleurs.blanc, 0.07),
            fontFamily: polices.donnees,
            fontWeight: 600,
            fontSize: 30,
            lineHeight: 1,
            color: "#EAF1FF",
            textShadow: "0 0 8px rgba(200, 220, 255, 0.8)",
            opacity: visible ? 1 : 0,
          }}
        >
          {c === " " ? "\u00a0" : c}
        </div>
      );
    })}
  </div>
);

const EcranLcd: React.FC<{ frame: number; scelle: boolean }> = ({ frame, scelle }) => {
  const clignote = Math.floor((frame - LCD) / 12) % 2 === 0;
  const [haut, bas] = scelle ? valeurs.lcdScelle : valeurs.lcdEvacuation;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#07090A" }}>
      <AbsoluteFill
        style={{
          scale: `${interpolate(frame, [LCD, LCD + 240], [1.04, 1.1], bloque)}`,
          translate: `${Math.sin(frame / 17) * 2}px ${Math.sin(frame / 13 + 1) * 1.5}px`,
          filter: "blur(0.7px)",
        }}
      >
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 60% 55% at 50% 60%, #12301F 0%, transparent 70%), linear-gradient(180deg, #0C1410 0%, #050706 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 30, right: 30, bottom: -40, height: 120, borderRadius: 8, backgroundColor: "#0E4A2C", opacity: 0.7, filter: "blur(4px)" }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
            rotate: "-2.5deg",
            padding: "26px 30px",
            borderRadius: 10,
            backgroundColor: "#0F1215",
            boxShadow: "0 30px 60px rgba(0,0,0,0.7), inset 0 0 0 2px #1C2126",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "14px 16px",
              borderRadius: 4,
              background: "linear-gradient(180deg, #2F5BFF 0%, #1D3FD6 100%)",
              boxShadow: "0 0 40px rgba(60, 100, 255, 0.45), inset 0 0 30px rgba(0, 0, 40, 0.5)",
            }}
          >
            <Cellules texte={haut} visible={scelle || clignote} />
            <Cellules texte={bas} visible />
          </div>
        </div>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,0.7) 100%)" }} />
      </AbsoluteFill>
      <Grain opacite={0.1} />
    </AbsoluteFill>
  );
};

export const Incendie: React.FC = () => {
  const frame = useCurrentFrame();
  const duree = framesDe("5.3");
  const vue = vueA(
    [
      { frame: POUSSEE, cible: VAISSEAU, zoom: 1 },
      { frame: POUSSEE + 40, cible: centreDe(REACTEUR), zoom: 1.5, ecran: { x: 690, y: 470 } },
      { frame: duree, cible: centreDe(REACTEUR), zoom: 1.56, ecran: { x: 690, y: 470 } },
    ],
    frame,
  );
  const pFeu = avance(frame, FEU, 12);
  const scelle = frame >= SCELLE;
  const pScelle = avance(frame, SCELLE, 20);
  const fermeture = avance(frame, FERMETURE, 16, courbes.bascule);
  const lcd = avance(frame, LCD, 20);
  const restants = TRAJETS.filter((t) => frame < t.sortie).length;
  const couleurRestants = restants > 0 ? couleurs.critique : couleurs.nominal;
  const r = DISPOSITION[REACTEUR];
  const o = vue.versEcran({ x: r.x, y: r.y });

  return (
    <FondScene lueur={interpolateColors(pFeu * (1 - pScelle * 0.7), [0, 1], [couleurs.panneau, "#1E1210"])}>
      <AbsoluteFill style={{ backgroundColor: couleurs.critique, opacity: interpolate(frame, [FEU, FEU + 2, FEU + 16], [0, 0.12, 0], bloque) }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <DefsBord frame={frame} />
        <CoqueBord vue={vue} />
        {IDS.map((id) =>
          id === REACTEUR ? null : <CompartimentBord key={id} vue={vue} id={id} frame={frame} />,
        )}
        <CompartimentBord
          vue={vue}
          id={REACTEUR}
          frame={frame}
          etat={scelle ? "scelle" : "feu"}
          pEtat={scelle ? pScelle : pFeu}
          fermeture={fermeture}
          libelle={
            scelle
              ? { texte: "SCELLÉ", p: pScelle }
              : { texte: `COMBUSTION DÉTECTÉE · ${valeurs.occupantsFeu} OCCUPANTS`, p: avance(frame, FEU + 6, 12) }
          }
        />
        {scelle ? (
          <rect x={o.x} y={o.y} width={LARGEUR_COMP * vue.echelle} height={HAUTEUR_COMP * vue.echelle} fill="url(#bord-chaleur)" opacity={0.3 * pScelle} />
        ) : null}
        {IDS.flatMap((id) =>
          equipageDe(id)
            .filter((nom) => !OCCUPANTS.includes(nom))
            .map((nom, rang) => <EquipierBord key={nom} vue={vue} nom={nom} position={emplacement(id, rang)} p={avance(frame, 4 + rang * 2, 12)} />),
        )}
        {TRAJETS.map((t) => {
          const progres = avance(frame, t.debut, t.duree, courbes.bascule);
          const enRoute = progres > 0 && progres < 1;
          const alerte = frame < t.sortie;
          return (
            <EquipierBord
              key={t.nom}
              vue={vue}
              nom={t.nom}
              position={surPolyligne(t.points, progres)}
              couleur={alerte ? interpolateColors(pFeu, [0, 1], [couleurs.texte, couleurs.critique]) : couleurs.texte}
              onde={alerte ? ((frame - FEU) / 24) % 1 : 0}
              opaciteNom={enRoute ? interpolate(progres, [0, 0.06, 0.94, 1], [1, 0, 0, 1], bloque) : 1}
            />
          );
        })}
        {TRAJETS.map((t) => {
          const e = vue.versEcran(porte(REACTEUR).interieur);
          const p = interpolate(frame, [t.sortie, t.sortie + 4, t.sortie + 22], [0, 1, 0], bloque);
          return p > 0 ? <circle key={`sortie-${t.nom}`} cx={e.x} cy={e.y} r={14 + (1 - p) * 30} fill="none" stroke={couleurs.blanc} strokeWidth={2} opacity={p} /> : null;
        })}
      </svg>
      <CachePlan cotes />
      <BarreCommandement p={1} />
      <EtiquetteTournage texte="ÉCRAN LCD DU RÉACTEUR" haut={120} cote="droite" />
      <div
        style={{
          position: "absolute",
          left: PANNEAU.x,
          top: PANNEAU.y,
          width: PANNEAU.largeur,
          height: PANNEAU.hauteur,
          overflow: "hidden",
          borderRadius: 4,
          outline: `1px solid ${alpha(couleurs.texte, 0.2)}`,
          boxShadow: `0 30px 80px ${alpha("#000000", 0.6)}`,
          opacity: interpolate(lcd, [0, 0.3], [0, 1], bloque),
          translate: `0 ${(1 - lcd) * 24}px`,
          clipPath: `inset(0 0 ${(1 - lcd) * 100}% 0)`,
        }}
      >
        <EcranLcd frame={frame} scelle={scelle} />
      </div>
      <div
        style={{
          position: "absolute",
          left: PANNEAU.x,
          top: PANNEAU.y + PANNEAU.hauteur + 46,
          width: PANNEAU.largeur,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingTop: 22,
          borderTop: `1px solid ${couleurs.trait}`,
          opacity: avance(frame, LCD + 14, 16),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 14 }}>
          <div style={{ fontFamily: polices.interface, fontWeight: 600, fontSize: tailles.etiquette, letterSpacing: "0.14em", color: couleurs.texteDoux }}>
            {`${valeurs.compartiments[REACTEUR]} · OCCUPANTS`}
          </div>
          <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, letterSpacing: "0.08em", color: scelle ? couleurs.texte : couleurRestants }}>
            {scelle ? "CLOISON FERMÉE" : restants > 0 ? "ÉVACUATION EN COURS" : "COMPARTIMENT VIDE"}
          </div>
        </div>
        <div
          style={{
            fontFamily: polices.display,
            fontWeight: 600,
            fontSize: 150,
            lineHeight: 0.8,
            color: couleurRestants,
            textShadow: `0 0 40px ${alpha(couleurRestants, 0.35)}`,
          }}
        >
          {restants}
        </div>
      </div>
      <Sfx nom="alarme" a={FEU} duree={FERMETURE + 12 - FEU} volume={(f) => interpolate(f, [0, 20, FERMETURE - FEU - 10, FERMETURE + 10 - FEU], [0.26, 0.2, 0.12, 0], bloque)} />
      <Sfx nom="whoosh" a={POUSSEE} volume={0.16} />
      <Sfx nom="telemetrie-bip" a={LCD + 4} volume={0.28} />
      {TRAJETS.map((t) => (
        <Sfx key={t.nom} nom="tic-point" a={t.sortie} volume={0.4} />
      ))}
      <Sfx nom="porte-etanche" a={FERMETURE - 4} volume={0.5} />
      <Sfx nom="verrouillage" a={SCELLE} volume={0.22} />
    </FondScene>
  );
};
