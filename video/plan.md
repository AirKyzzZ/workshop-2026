# Plan de réalisation · vidéo nationale

Met en œuvre `video/scenario.md`. Deux phases : A maintenant, sans les rushes (valeurs et plans
provisoires) ; B après le tournage du samedi 26.

**Pile** : Remotion 4 (TypeScript, React), `@remotion/media`, `@remotion/transitions`,
`@remotion/fonts`, scripts Python locaux pour la voix et l'extraction de données.

**Règles** : zéro commentaire dans le code, fichiers en kebab-case, exports nommés, TypeScript
strict. Aucun chiffre en dur dans les scènes, tout vient de `data/`. Aucun texte sous 24 px.
Commits locaux, rien n'est poussé sans l'accord de Maxime (dépôt public, finale en concours).

## Interfaces partagées

```ts
type Replique = {id: string; acte: number; scene: string; texte: string; fichier: string; dureeS: number};
type Valeurs = Record<string, number | string>;
type Point = {x: number; y: number; z: number};
type ImageMain = {frame: number; points: Point[]};
```

- `src/charte.ts` : `couleurs`, `polices`, `espacements`, repris de `brand/tokens.json`.
- `src/timing.ts` : `framesScene(scene, fps)` = durée de la réplique + marge, avec un minimum par
  scène ; `framesTotal()` ; la composition échoue si le total dépasse 4:45.
- `src/donnees.ts` : lit `data/repliques.json`, `data/valeurs.json`, `data/mains.json`,
  `data/audio-analyse.json`.

## Phase A

| # | Tâche | Livrable | Qui | Vérification |
|---|---|---|---|---|
| A1 | Échafaudage : `create-video --blank --no-tailwind` dans `video/app/`, paquets Remotion, polices de la charte, `charte.ts`, composition `AtriaNational` 1920 × 1080 à 30 i/s | Le Studio s'ouvre | Claude | `tsc`, `npx remotion still` |
| A2 | Données et minutage : `data/*.json` provisoires, `donnees.ts`, `timing.ts` et son test | Durées calculées depuis les répliques | Claude | test du minutage, garde des 4:45 |
| A3 | Essai de voix : deux ou trois modèles TTS français open source actuels, en local sur le Mac, même extrait de 20 s, chaîne robotique ffmpeg | Extraits à écouter, Maxime choisit | sous-agent | écoute |
| A4 | Musique et effets : nappe libre de droits ou générée en local, banque d'effets CC0, fonction d'atténuation sous la voix | `public/audio/` et `attenuation.ts` | sous-agent | test de l'atténuation |
| A5 | Composants de charte : `CadreHud`, `Lecture`, `Jauge`, `TypoCinetique`, `FicheIdentite`, `SousTitres`, transitions `Rembobinage`, `Balayage`, `OuvertureObjectif` | Une composition de démonstration par composant | sous-agent | images fixes relues dans Chrome |
| A6 | Composants métier : `MainSquelette` (21 points depuis `mains.json`), `BarresClasses`, `OndeSonore`, `PlanVaisseau`, `GrapheSocial`, `Journal`, `BarreMemoire` | idem | sous-agent | idem |
| A7 | Captures du dashboard en 2x (serveur local, registre simulé, état de démo) | `public/captures/` | Claude | relecture |
| A8 | Actes I à VII assemblés sur les composants, rushes remplacés par des cartons « PLAN À TOURNER » | La vidéo complète se lit de bout en bout | 2 ou 3 sous-agents | rendu basse définition, relecture acte par acte dans le Studio |
| A9 | Voix finale sur toutes les répliques avec le modèle choisi, sous-titres, mixage | Vidéo sonorisée | Claude | sonie `ebur128`, durée ≤ 4:45 |
| A10 | Relecture croisée par `cit` sur le code et une planche d'images | Liste de corrections appliquées | Claude | — |

## Phase B · après le tournage

| # | Tâche | Livrable |
|---|---|---|
| B1 | Rushes dans `public/rushes/`, découpe ffmpeg | Plans prêts |
| B2 | Extraction MediaPipe des 21 points sur le gros plan de la main | `data/mains.json` réel |
| B3 | YAMNet et Vosk sur le son de l'embrouille et la toux | `data/audio-analyse.json` réel |
| B4 | Vraies valeurs relevées sur la carte au tournage | `data/valeurs.json` réel |
| B5 | Rendu final 1080p, lisibilité en 720p, test sur un appel Teams | `out/atria-national.mp4` |
