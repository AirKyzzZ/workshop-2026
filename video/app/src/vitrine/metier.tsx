import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
} from "remotion";
import mainsJson from "../../data/mains.json";
import { couleurs } from "../charte";
import { BarreMemoire } from "../composants/metier/barre-memoire";
import { BarresClasses } from "../composants/metier/barres-classes";
import { nombreFr } from "../composants/metier/commun";
import { GrapheSocial } from "../composants/metier/graphe-social";
import { Journal } from "../composants/metier/journal";
import { ListeControles } from "../composants/metier/liste-controles";
import {
  MainSquelette,
  type ImageMain,
} from "../composants/metier/main-squelette";
import { OndeSonore } from "../composants/metier/onde-sonore";
import { PlanVaisseau } from "../composants/metier/plan-vaisseau";
import { Transcription } from "../composants/metier/transcription";
import { valeurs } from "../donnees";
import { policesChargees } from "../polices";
import type { Demo } from "./charte";

const mains = mainsJson as ImageMain[];

const Plateau: React.FC<{ children: React.ReactNode; centre?: boolean }> = ({
  children,
  centre = false,
}) => {
  const [attente] = useState(() => delayRender("polices de la charte"));
  useEffect(() => {
    policesChargees.then(() => continueRender(attente), cancelRender);
  }, [attente]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: couleurs.fond,
        backgroundImage: `radial-gradient(ellipse at 50% 45%, ${couleurs.panneau} 0%, ${couleurs.fond} 70%)`,
        justifyContent: centre ? "center" : undefined,
        alignItems: centre ? "center" : undefined,
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
        {
          doigt: "annulaire",
          libelle: "ANNULAIRE",
          ratio: valeurs.ratioAnnulaire,
        },
        {
          doigt: "auriculaire",
          libelle: "AURICULAIRE",
          ratio: valeurs.ratioAuriculaire,
        },
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

const DemoBarresClasses: React.FC = () => (
  <Plateau centre>
    <BarresClasses
      titre="YAMNET · 521 CLASSES · FENÊTRE 3 S"
      largeur={1100}
      debut={6}
      classes={[
        { libelle: "Parole", score: valeurs.scoreParole },
        { libelle: "Cri", score: valeurs.scoreCri, niveau: "attention" },
        { libelle: "Conversation", score: 0.37 },
        { libelle: "Hurlement", score: 0.21 },
        { libelle: "Musique", score: 0.04 },
      ]}
    />
  </Plateau>
);

const DemoOndeSonore: React.FC = () => (
  <Plateau centre>
    <OndeSonore
      largeur={1600}
      hauteur={260}
      graine="serre-embrouille"
      debut={4}
      evenements={[
        { frame: 12, duree: 36, niveau: 0.42 },
        { frame: 58, duree: 26, niveau: 0.5 },
        {
          frame: 96,
          duree: 30,
          niveau: 0.95,
          ton: "attention",
          libelle: `CRI · ${nombreFr(valeurs.scoreCri)}`,
        },
        { frame: 138, duree: 18, niveau: 0.38 },
      ]}
    />
  </Plateau>
);

const DemoTranscription: React.FC = () => {
  const mots = [
    "Tu",
    "as",
    "encore",
    "touché",
    "à",
    "mes",
    "plants,",
    "espèce",
    "de",
  ];
  return (
    <Plateau centre>
      <Transcription
        entete="TRANSCRIPTION · VOSK FR · SUR LA CARTE"
        largeur={1440}
        mots={[
          ...mots.map((texte, i) => ({ texte, frame: 14 + i * 7 })),
          {
            texte: "connard",
            frame: 14 + mots.length * 7 + 4,
            masque: { type: "insulte", gravite: valeurs.graviteInsulte },
          },
        ]}
        legende={{
          frame: 118,
          niveaux: [
            { libelle: "juron", gravite: 0.15 },
            { libelle: "insulte", gravite: valeurs.graviteInsulte },
            { libelle: "menace", gravite: 0.9 },
          ],
        }}
      />
    </Plateau>
  );
};

const DemoPlanVaisseau: React.FC = () => (
  <Plateau>
    <PlanVaisseau
      reperes={{ poupe: "POUPE", proue: "PROUE" }}
      compartiments={[
        { id: "laboratoire", nom: "LABORATOIRE", detail: "analyses · martin" },
        { id: "infirmerie", nom: "INFIRMERIE", detail: "chirurgie · bernard" },
        { id: "pont", nom: "PONT", detail: "navigation · novak" },
        { id: "atelier", nom: "ATELIER", detail: "maintenance · moreau" },
        {
          id: "serre",
          nom: "SERRE",
          detail: `${valeurs.temperature} °C · ${valeurs.humidite} %`,
        },
        { id: "reacteur", nom: "RÉACTEUR", detail: "propulsion · andre" },
      ]}
      etats={[
        {
          compartiment: "infirmerie",
          etat: "exposition",
          frame: 56,
          libelle: `TOUX · ${nombreFr(valeurs.scoreToux)}`,
        },
        {
          compartiment: "reacteur",
          etat: "feu",
          frame: 78,
          libelle: `COMBUSTION · ${valeurs.occupantsFeu} OCCUPANTS`,
        },
        {
          compartiment: "reacteur",
          etat: "evacuation",
          frame: 100,
          libelle: "ÉVACUEZ",
        },
        {
          compartiment: "reacteur",
          etat: "scelle",
          frame: 168,
          libelle: "SCELLÉ",
        },
      ]}
      equipage={[
        { nom: "martin", trajet: [{ frame: 0, compartiment: "laboratoire" }] },
        { nom: "leroy", trajet: [{ frame: 0, compartiment: "laboratoire" }] },
        { nom: "roux", trajet: [{ frame: 0, compartiment: "laboratoire" }] },
        { nom: "bernard", trajet: [{ frame: 0, compartiment: "infirmerie" }] },
        {
          nom: "dubois",
          trajet: [{ frame: 0, compartiment: "infirmerie" }],
          alertes: [{ frame: 64, niveau: "attention" }],
        },
        {
          nom: "fournier",
          trajet: [{ frame: 0, compartiment: "infirmerie" }],
          alertes: [{ frame: 70, niveau: "attention" }],
        },
        { nom: "novak", trajet: [{ frame: 0, compartiment: "pont" }] },
        { nom: "silva", trajet: [{ frame: 0, compartiment: "pont" }] },
        { nom: "moreau", trajet: [{ frame: 0, compartiment: "atelier" }] },
        { nom: "garcia", trajet: [{ frame: 0, compartiment: "atelier" }] },
        { nom: "melih", trajet: [{ frame: 0, compartiment: "serre" }] },
        { nom: "alexandre", trajet: [{ frame: 0, compartiment: "serre" }] },
        {
          nom: "andre",
          trajet: [
            { frame: 0, compartiment: "reacteur" },
            { frame: 108, compartiment: "pont" },
          ],
        },
        {
          nom: "weber",
          trajet: [
            { frame: 0, compartiment: "reacteur" },
            { frame: 120, compartiment: "serre" },
          ],
        },
      ]}
      camera={[
        { frame: 0, cible: "vaisseau" },
        { frame: 150, cible: "vaisseau" },
        { frame: 190, cible: "reacteur", zoom: 1.7 },
      ]}
    />
  </Plateau>
);

const DemoGrapheSocial: React.FC = () => (
  <Plateau centre>
    <GrapheSocial
      largeur={1500}
      hauteur={760}
      debut={4}
      intervalle={3}
      noeuds={[
        {
          id: "melih",
          nom: "melih",
          x: 0.36,
          y: 0.46,
          allumage: { frame: 128, niveau: "critique" },
        },
        { id: "alexandre", nom: "alexandre", x: 0.6, y: 0.52 },
        { id: "bernard", nom: "bernard", x: 0.2, y: 0.18 },
        { id: "lambert", nom: "lambert", x: 0.16, y: 0.74 },
        { id: "dubois", nom: "dubois", x: 0.44, y: 0.88 },
        { id: "novak", nom: "novak", x: 0.5, y: 0.12 },
        { id: "silva", nom: "silva", x: 0.8, y: 0.2 },
        { id: "leroy", nom: "leroy", x: 0.86, y: 0.66 },
        { id: "roux", nom: "roux", x: 0.72, y: 0.9 },
        { id: "martin", nom: "martin", x: 0.02, y: 0.44 },
      ]}
      liens={[
        {
          de: "melih",
          vers: "alexandre",
          force: 0.55,
          nature: "neutre",
          bascule: { frame: 104, libelle: "HOSTILE" },
        },
        { de: "melih", vers: "bernard", force: 0.7, nature: "affinite" },
        { de: "melih", vers: "lambert", force: 0.4, nature: "affinite" },
        { de: "alexandre", vers: "silva", force: 0.6, nature: "affinite" },
        { de: "alexandre", vers: "leroy", force: 0.3, nature: "neutre" },
        { de: "bernard", vers: "novak", force: 0.5, nature: "affinite" },
        { de: "novak", vers: "silva", force: 0.8, nature: "affinite" },
        { de: "leroy", vers: "roux", force: 0.7, nature: "hostile" },
        { de: "dubois", vers: "lambert", force: 0.45, nature: "affinite" },
        { de: "dubois", vers: "roux", force: 0.3, nature: "neutre" },
        { de: "martin", vers: "lambert", force: 0.35, nature: "neutre" },
      ]}
    />
  </Plateau>
);

const DemoJournal: React.FC = () => (
  <Plateau>
    <div style={{ position: "absolute", top: 300, left: 180 }}>
      <Journal
        titre="JOURNAL DES DÉCISIONS"
        mention="TRAÇABILITÉ COMPLÈTE"
        largeur={1560}
        lignes={[
          {
            frame: 8,
            heure: valeurs.heureIncident,
            type: "incident",
            sujet: "melih",
            texte: `doigt d'honneur · gravité ${nombreFr(valeurs.graviteGeste)} · caméra`,
            niveau: "attention",
          },
          {
            frame: 36,
            heure: valeurs.heureIncident,
            type: "conduite",
            sujet: "melih",
            texte: `${nombreFr(valeurs.conduiteAvant)} → ${nombreFr(valeurs.conduiteApres)}`,
          },
          {
            frame: 58,
            heure: "18:44:31",
            type: "ordre",
            sujet: "maxime",
            texte: "affecter melih → chirurgie",
          },
          {
            frame: 82,
            heure: "18:44:31",
            type: "refus",
            sujet: "melih",
            texte: `conduite ${nombreFr(valeurs.conduiteApres)} sous le seuil ${nombreFr(valeurs.seuilConduite)}`,
            niveau: "critique",
          },
          {
            frame: 118,
            heure: "18:44:52",
            type: "affectation",
            sujet: valeurs.remplacant.toLowerCase(),
            texte: `affecté en chirurgie · capacité ${nombreFr(valeurs.capaciteRemplacant)}`,
            niveau: "nominal",
          },
        ]}
      />
    </div>
  </Plateau>
);

const DemoListeControles: React.FC = () => (
  <Plateau centre>
    <ListeControles
      titre="CONTRÔLES · MELIH → CHIRURGIE"
      libelleNonEvalue="NON ÉVALUÉ"
      verdicts={{ refuse: "ORDRE REFUSÉ", valide: "ORDRE VALIDÉ" }}
      debut={6}
      controles={[
        { libelle: "QUALIFICATION", detail: "chirurgie", ok: true },
        {
          libelle: "CONDUITE",
          detail: `${nombreFr(valeurs.conduiteApres)} < ${nombreFr(valeurs.seuilConduite)}`,
          ok: false,
        },
        { libelle: "CONFIANCE", ok: true },
        { libelle: "CAPACITÉ", ok: true },
      ]}
    />
  </Plateau>
);

const MODELES = [
  { nom: "Qwen 1,5B", taille: 1.05 },
  { nom: "Vosk", taille: 0.24 },
  { nom: "YuNet + SFace", taille: 0.05 },
  { nom: "MediaPipe", taille: 0.07 },
  { nom: "YAMNet", taille: 0.02 },
  { nom: "Rupture d'aptitude", taille: 0.01 },
];

const DemoBarreMemoire: React.FC = () => {
  const systeme =
    valeurs.memoireGo -
    valeurs.memoireLibreGo -
    MODELES.reduce((s, m) => s + m.taille, 0);
  return (
    <Plateau centre>
      <BarreMemoire
        titre="MÉMOIRE VIVE · RASPBERRY PI 5"
        capacite={valeurs.memoireGo}
        unite="GO"
        libelleLibre="LIBRES"
        debut={4}
        intervalle={16}
        segments={[{ nom: "Système", taille: systeme }, ...MODELES]}
      />
    </Plateau>
  );
};

export const demosMetier: Demo[] = [
  { id: "Vitrine-MainSquelette", composant: DemoMainSquelette, dureeS: 8 },
  { id: "Vitrine-BarresClasses", composant: DemoBarresClasses, dureeS: 4 },
  { id: "Vitrine-OndeSonore", composant: DemoOndeSonore, dureeS: 6 },
  { id: "Vitrine-Transcription", composant: DemoTranscription, dureeS: 6 },
  { id: "Vitrine-PlanVaisseau", composant: DemoPlanVaisseau, dureeS: 8 },
  { id: "Vitrine-GrapheSocial", composant: DemoGrapheSocial, dureeS: 6 },
  { id: "Vitrine-Journal", composant: DemoJournal, dureeS: 6 },
  { id: "Vitrine-ListeControles", composant: DemoListeControles, dureeS: 5 },
  { id: "Vitrine-BarreMemoire", composant: DemoBarreMemoire, dureeS: 7 },
];
