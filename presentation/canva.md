# Soutenance ATRIA — contenu prêt à coller dans Canva

5 minutes d'oral, 5 minutes de questions. Sept slides projetées, quatre gardées en
réserve pour les questions.

## Choisir le template

Cherche **« dark tech presentation »** ou **« space startup pitch »** dans Canva. Trois
choses comptent plus que le style :

- **Fond sombre.** Le dashboard est sombre, et vous basculerez dessus en plein milieu. Un
  template blanc fait un flash désagréable à chaque bascule.
- **Une typographie de titre à fort caractère**, condensée de préférence. Les chiffres
  sont l'argument de ce projet : ils doivent être gros.
- **Peu de décor.** Les templates chargés en formes géométriques mangent la place dont la
  slide 5 a besoin.

Évite les modèles à dégradé violet sur blanc : c'est ce que trois autres groupes auront.

## Règles pour ne pas rater le rendu

Le texte ci-dessous est déjà calibré. Ne l'allonge pas : chaque slide tient en une
respiration. Si une phrase déborde, coupe-la plutôt que de réduire la police.

Les slides 1, 4 et 7 doivent rester très vides. Le vide est ce qui fait qu'on écoute
celui qui parle au lieu de lire l'écran.

---

## Slide 1 — Ouverture · Melih · 20 s

**Sur-titre (petit, en haut)**
> Workshop national EPSI 2026 · Horizon 2080 · Groupe G2

**Titre géant**
> ATRIA

**Sous-titre (une seule ligne, grande)**
> Le système de survie le plus fragile d'un vaisseau, c'est son équipage.

**Pied de slide**
> Alexandre · Melih · Maxime

Rien d'autre. Pas d'image. Melih dit la phrase, marque un temps, passe.

---

## Slide 2 — L'asymétrie · Melih · 40 s

**Titre**
> On mesure tout, sauf les gens

**Colonne de gauche — « Ce qu'un vaisseau mesure en continu »**
> Oxygène — capteurs, seuils, redondance
> Énergie — coupures automatiques
> Eau — recyclage mesuré sans arrêt

**Colonne de droite — « Ce qu'il demande à l'intéressé »**
> L'équipage — « comment vous sentez-vous ? »

**Phrase de bas de slide, mise en valeur**
> Un réacteur ne ment pas sur son état. Un équipier, si.

C'est la slide qui justifie tout le reste. Melih doit la laisser respirer : la colonne de
droite ne contient qu'une ligne, et ce déséquilibre visuel **est** l'argument.

---

## Slide 3 — Le montage · Alexandre · 40 s

**Titre**
> Tout tourne sur une carte à 80 €

**Image plein cadre**
> `hardware/wokwi/montage-complet.png`

**Trois chiffres en bandeau sous l'image**
> 7 — modèles en local
> 4 Go — de mémoire
> 0 — octet vers l'extérieur

**Une ligne sous les chiffres**
> Deux compartiments instrumentés, aucun réseau : le nuage est à quarante ans-lumière.

Alexandre ne doit **jamais** énumérer les capteurs. Le schéma sert à prouver que c'est du
vrai matériel, pas à être lu.

---

## Slide 4 — La démonstration · Maxime · 2 min 30

Cette slide reste affichée pendant que vous basculez sur le dashboard. Elle sert
d'aide-mémoire au jury, pas de support de parole.

**Titre**
> Démonstration

**Quatre cartes, titre en gras puis une ou deux lignes**

> **Le badge ne suffit pas**
> Melih badge et présente son visage. Alexandre badge avec le même badge et se fait
> refuser : son visage n'est pas enrôlé.

> **Le geste compte**
> Un doigt d'honneur filmé, reconnu, attribué par reconnaissance faciale. La conduite
> tombe, le poste vital est refusé.

> **Le feu ne tue personne**
> Combustion dans la serre, trois occupants. ATRIA **ne scelle pas** : elle ordonne
> l'évacuation sur l'écran du compartiment, et ferme au dernier sorti.

> **Les liens se déduisent**
> Personne ne déclare ses affinités. Elles se lisent dans les présences partagées et les
> frictions observées.

---

## Slide 5 — Le modèle · Maxime · 45 s

**Titre**
> Chaque variable gagne sa place, ou elle part

**Sous-titre**
> Ce membre passera-t-il sous le seuil d'aptitude dans les six heures ?

**Tableau à deux colonnes**

| Variables du modèle | AUC |
|---|---|
| capacité seule | 0.922 |
| + pente sur 6 heures | 0.945 |
| + sommeil de la nuit | 0.955 |
| **+ dette de sommeil** | **0.962** |
| + cardio, stress, conduite | 0.957 ↓ |

Mets la dernière ligne en gris : c'est une régression, et c'est volontaire.

**Sous le tableau**
> Trois variables essayées puis retirées : elles faisaient redescendre le score.
> Validation croisée groupée par membre.

**Encadré, en bas**
> 34 ruptures sur 36 attrapées, au prix de 99 fausses alertes. Rater une rupture coûte
> plus cher qu'alerter pour rien.

C'est le tableau qui est l'argument, pas l'AUC. Un jury technique reconnaît immédiatement
quelqu'un qui a mesuré l'apport de ses variables au lieu de les empiler.

---

## Slide 6 — L'autorité · à trois · 40 s

**Titre**
> Elle ferme des cloisons, pas des gens

**Bloc de gauche, accent vert — « Ce qu'elle décide seule »**
> Sceller un compartiment en feu, à une condition vérifiée à l'instant de la décision :
> qu'il soit vide.

**Bloc de droite, accent rouge — « Ce qu'elle ne décide jamais »**
> Isoler quelqu'un. Elle mesure, elle argumente, elle propose. Le capitaine tranche, et
> son refus tient trente minutes.

**Sous les deux blocs**
> Chaque décision est écrite au journal avec la mesure qui l'a déclenchée. C'est une
> surveillance, elle est assumée comme telle, et elle se laisse contredire.

C'est votre meilleure défense en questions. Un projet de surveillance sans limite
explicite se fait démonter ; un projet qui dit où s'arrête sa propre autorité se fait
respecter.

---

## Slide 7 — Clôture · à trois · 25 s

**Petit sur-titre**
> Pour conclure

**Phrase géante, exactement celle de la slide 1**
> Le système de survie le plus fragile d'un vaisseau, c'est son équipage.

**Une ligne en dessous**
> On a passé la semaine à lui donner les capteurs qu'on donne déjà à l'oxygène, et à
> décider ce qu'ATRIA n'aurait jamais le droit de faire avec.

**Pied**
> github.com/AirKyzzZ/workshop-2026

Reprendre la phrase d'ouverture mot pour mot, puis se taire. Ne pas remercier, ne pas
demander s'il y a des questions : le jury les posera.

---

# Les quatre slides de réserve

À placer **après** la slide 7, jamais projetées. En mode présentation Canva, on y accède
en tapant le numéro de la slide puis Entrée.

## Réserve A — « d'où viennent vos affinités ? »

**Titre**
> Le graphe social se déduit, il ne se déclare pas

> Le lien part du temps réellement partagé dans un compartiment, et les frictions le
> tirent vers le négatif.
>
> Un incident devant six personnes ne crée pas six inimitiés : chaque témoin n'en reçoit
> qu'un sixième, et l'hostilité sature. Il faut que ça se répète **avec la même personne**
> pour que le lien bascule.
>
> 24 membres · 10 affinités · 6 hostilités

**À dire, et ne pas cacher :** les sept jours de présences sont rejoués. Quelques heures
réelles ne suffisent pas à dessiner un graphe. Le mécanisme est le même sur des présences
réelles, et il tourne déjà sur celles d'aujourd'hui.

## Réserve B — « vous avez fine-tuné quoi ? »

**Titre**
> Sept modèles, un seul entraîné par nous

| Modèle | Rôle |
|---|---|
| YuNet | détection de visage |
| SFace | empreinte 128 réels |
| MediaPipe visage | 52 coefficients d'expression |
| MediaPipe mains | 21 points, gestes |
| YAMNet | 521 classes sonores |
| Vosk | transcription du français |
| **Rupture d'aptitude** | **écrit et entraîné par nous** |

> Les six premiers sont pris sur étagère et utilisés tels quels. Le septième est une
> régression logistique écrite à la main en numpy, entraînée sur nos données, et qui rend
> une contribution par variable : ATRIA ne dit pas « risque 0.78 », elle dit quelle mesure
> a fait monter ce chiffre.

**Ne dites jamais « on a fine-tuné ».** C'est faux et vérifiable en une question. « On a
entraîné un modèle de zéro » est vrai, et plus fort.

## Réserve C — « vos données sont réelles ? »

**Titre**
> Ce qui est simulé, et ce qui ne l'est pas

**Simulé**
> L'équipage de 24 membres et son historique
> La physiologie : sommeil, dette, stress
> Sept jours de présences par compartiment

**Mesuré sur le vrai monde**
> Température et humidité, deux compartiments
> Fumée et gaz, niveau sonore
> Visages, gestes, expressions
> Sons et paroles
> Somnolence : PERCLOS calibré par personne

> Le simulateur décrit un vaisseau qui n'existe pas, et il le dit. Ce qui n'est pas
> simulé, c'est que le modèle ne voit que les traces et doit retrouver la règle seul, sur
> des membres qu'il n'a jamais vus.

## Réserve D — « qu'est-ce qui ne marche pas ? »

**Titre**
> Trois échecs mesurés

> **La marge thermique.** Sans refroidissement actif, la carte repose à 72 °C et le garde
> suspend la surveillance à 78. On a divisé la charge par deux ; il aurait fallu un
> ventilateur à 5 €.
>
> **Le modèle de langage.** Qwen 1.5B passe nos gardes sur les chiffres et les noms, mais
> il affirme encore ce que le relevé contredit. Le briefing est donc écrit par les outils,
> et le modèle ne fait que reformuler.
>
> **Le capteur de pouls.** La chaîne est complète, du firmware au dossier médical. Le
> capteur n'était pas câblé à temps.

> Trois échecs mesurés plutôt que trois angles morts.

Arriver avec cette slide déjà écrite vaut mieux que d'improviser. Un jury creuse toujours,
et un groupe qui connaît ses propres limites inspire plus confiance qu'un groupe qui
prétend n'en avoir aucune.
