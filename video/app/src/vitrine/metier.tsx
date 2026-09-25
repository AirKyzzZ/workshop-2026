import { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import mainsJson from "../../data/mains.json";
import { couleurs } from "../charte";
import { MainSquelette, type ImageMain } from "../composants/metier/main-squelette";
import { valeurs } from "../donnees";
import { policesChargees } from "../polices";
import type { Demo } from "./charte";

const mains = mainsJson as ImageMain[];

const Plateau: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attente] = useState(() => delayRender("polices de la charte"));
  useEffect(() => {
    policesChargees.then(() => continueRender(attente), cancelRender);
  }, [attente]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: couleurs.fond,
        backgroundImage: `radial-gradient(ellipse at 50% 45%, ${couleurs.panneau} 0%, ${couleurs.fond} 70%)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const DemoMainSquelette: React.FC = () => (
  <Plateau>
    <MainSquelette
      images={mains}
      mesures={[
        { doigt: "majeur", libelle: "MAJEUR", ratio: valeurs.ratioMajeur },
        { doigt: "index", libelle: "INDEX", ratio: valeurs.ratioIndex },
        { doigt: "annulaire", libelle: "ANNULAIRE", ratio: valeurs.ratioAnnulaire },
        { doigt: "auriculaire", libelle: "AURICULAIRE", ratio: valeurs.ratioAuriculaire },
      ]}
      seuils={{ doigt: valeurs.seuilDoigt, pouce: 1.35 }}
      libelles={{
        titre: "EXTENSION · BASE → BOUT",
        points: "POINTS",
        seuil: "SEUIL",
        tendu: "TENDU",
        replie: "REPLIÉ",
      }}
      verdict={{ titre: "GESTE RECONNU", libelle: "DOIGT D'HONNEUR", score: 1 }}
      debut={6}
      intervallePoint={3}
      intervalleDoigt={26}
    />
  </Plateau>
);

export const demosMetier: Demo[] = [{ id: "Vitrine-MainSquelette", composant: DemoMainSquelette, dureeS: 8 }];
