import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { couleurs } from "../charte";
import { Balayage } from "../composants/charte/balayage";
import { CadreHud } from "../composants/charte/cadre-hud";
import { bloque } from "../composants/charte/commun";
import { FicheIdentite } from "../composants/charte/fiche-identite";
import { Jauge } from "../composants/charte/jauge";
import { Lecture } from "../composants/charte/lecture";
import { MarqueAtria } from "../composants/charte/marque-atria";
import { OuvertureObjectif } from "../composants/charte/ouverture-objectif";
import { PlanFactice } from "../composants/charte/plan-factice";
import { Rembobinage } from "../composants/charte/rembobinage";
import { SousTitres } from "../composants/charte/sous-titres";
import { TypoCinetique } from "../composants/charte/typo-cinetique";

export type Demo = { id: string; composant: React.FC; dureeS: number };

const Fond: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>{children}</AbsoluteFill>
);

const DemoCadreHud: React.FC = () => (
  <Fond>
    <CadreHud
      etiquette="SERRE · COMP. 4"
      date="AN 2080"
      horodatage="18:41:55"
      lectures={[
        { label: "Analyse", valeur: "2 Hz" },
        { label: "Occupants", valeur: "2" },
        { label: "Son", valeur: "61 dB", etat: "attention" },
      ]}
      debut={6}
    >
      <PlanFactice desature />
    </CadreHud>
  </Fond>
);

const DemoLecture: React.FC = () => (
  <Fond>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 120 }}>
        <Lecture label="Température" valeur={24.4} decimales={1} unite="°C" debut={6} />
        <Lecture label="Humidité" valeur={56} unite="%" debut={10} />
        <Lecture label="Bruit" valeur={61} unite="dB" etat="attention" debut={14} />
        <Lecture label="Fumée" valeur={0} etat="nominal" debut={18} />
        <Lecture label="Compartiment" valeur="SERRE 4" debut={22} />
      </div>
    </AbsoluteFill>
  </Fond>
);

const DemoJauge: React.FC = () => (
  <Fond>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 140 }}>
        <Jauge
          label="Conduite · Melih"
          depuis={1}
          vers={0.55}
          seuil={0.6}
          note="conduite = 1 − Σ gravité × décroissance"
          debut={6}
          debutVariation={40}
          duree={54}
          largeur={1000}
        />
        <Jauge
          forme="arc"
          label="Risque de rupture"
          depuis={0.18}
          vers={0.71}
          seuil={0.6}
          alerte="dessus"
          debut={14}
          debutVariation={50}
          duree={60}
          largeur={460}
        />
      </div>
    </AbsoluteFill>
  </Fond>
);

const DemoTypoCinetique: React.FC = () => (
  <Fond>
    <TypoCinetique
      surtitre="SI LOIN DE LA TERRE"
      lignes={["4,2 années-lumière", "0 relève", { texte: "0 psychiatre", etat: "critique" }]}
      debut={6}
      sortie={124}
    />
  </Fond>
);

const DemoFicheIdentite: React.FC = () => (
  <Fond>
    <PlanFactice desature />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingRight: 96, gap: 24 }}>
      <FicheIdentite
        surtitre="Équipier"
        matricule="EQ-017"
        nom="Melih"
        role="Montage et exploitation"
        statut="VISAGE RECONNU · 0,81"
        debut={6}
      />
      <FicheIdentite
        surtitre="Équipier"
        matricule="EQ-022"
        nom="Alexandre"
        role="Montage et acquisition"
        statut="VISAGE ≠ BADGE · ACCÈS REFUSÉ"
        etat="critique"
        debut={16}
      />
      <FicheIdentite
        surtitre="Commandement"
        matricule="CDT-01"
        nom="Maxime"
        role="Commandant"
        statut="VISAGE RECONNU · 0,86"
        debut={26}
      />
    </AbsoluteFill>
  </Fond>
);

const DemoSousTitres: React.FC = () => (
  <Fond>
    <PlanFactice />
    <SousTitres
      texte="Un incendie ? Tant qu’il reste quelqu’un, ATRIA ne scelle pas : elle fait évacuer. Au dernier sorti, la cloison se ferme."
      debut={8}
      duree={130}
      tenue={20}
    />
  </Fond>
);

const DemoRembobinage: React.FC = () => (
  <Fond>
    <Rembobinage heureDepart="18:42:19" recul={12} debut={6} duree={104}>
      <PlanFactice />
    </Rembobinage>
  </Fond>
);

const DemoBalayage: React.FC = () => (
  <Fond>
    <PlanFactice />
    <Balayage libelle="ANALYSE" debut={8} duree={40}>
      <CadreHud etiquette="SERRE · COMP. 4" horodatage="18:41:55" lectures={[{ label: "Analyse", valeur: "2 Hz" }]} debut={22}>
        <PlanFactice desature />
      </CadreHud>
    </Balayage>
  </Fond>
);

const DemoOuvertureObjectif: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Fond>
      <OuvertureObjectif debut={40} duree={42}>
        <CadreHud
          etiquette="SERRE · COMP. 4"
          horodatage="18:41:55"
          lectures={[{ label: "Analyse", valeur: "2 Hz" }]}
          debut={70}
        >
          <PlanFactice desature />
        </CadreHud>
      </OuvertureObjectif>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: interpolate(frame, [40, 52], [1, 0], bloque),
          scale: `${interpolate(frame, [36, 60], [1, 1.5], bloque)}`,
        }}
      >
        <MarqueAtria nom={false} taille={240} duree={34} debut={2} />
      </AbsoluteFill>
    </Fond>
  );
};

const DemoMarqueAtria: React.FC = () => (
  <Fond>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <MarqueAtria baseline="AMONGU(RS)S · EPSI 2026 · G2" debut={6} />
    </AbsoluteFill>
  </Fond>
);

export const demosCharte: Demo[] = [
  { id: "Vitrine-CadreHud", composant: DemoCadreHud, dureeS: 5 },
  { id: "Vitrine-Lecture", composant: DemoLecture, dureeS: 4 },
  { id: "Vitrine-Jauge", composant: DemoJauge, dureeS: 6 },
  { id: "Vitrine-TypoCinetique", composant: DemoTypoCinetique, dureeS: 5 },
  { id: "Vitrine-FicheIdentite", composant: DemoFicheIdentite, dureeS: 5 },
  { id: "Vitrine-SousTitres", composant: DemoSousTitres, dureeS: 6 },
  { id: "Vitrine-Rembobinage", composant: DemoRembobinage, dureeS: 4 },
  { id: "Vitrine-Balayage", composant: DemoBalayage, dureeS: 3 },
  { id: "Vitrine-OuvertureObjectif", composant: DemoOuvertureObjectif, dureeS: 4 },
  { id: "Vitrine-MarqueAtria", composant: DemoMarqueAtria, dureeS: 4 },
];
