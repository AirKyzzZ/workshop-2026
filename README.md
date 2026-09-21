# ATRIA

Régulation de la santé physique et mentale d'un équipage interstellaire.

Workshop National EPSI B3 2026 — *Horizon 2080*, pilier 1 : HumanTech & HealthTech spatiales.
Alexandre, Melih et Maxime.

## Le problème

Sur un vaisseau coupé de la Terre pendant des décennies, le système de survie le plus fragile
n'est pas le recycleur d'air : c'est l'équipage lui-même. Le vaisseau surveille son oxygène,
son énergie et son eau avec des capteurs, des alarmes et de la redondance. Il surveille ses
humains avec un questionnaire.

ATRIA traite l'équipage pour ce qu'il est, un système de survie critique qui a besoin de
monitoring continu, de régulation active et de tolérance aux pannes.

## Ce que fait le système

ATRIA maintient un état physiologique par membre d'équipage, alimenté par des capteurs réels,
et en déduit une **capacité cognitive** entre 0 et 1. Chaque poste du vaisseau exige un seuil
minimal. Le régulateur alloue postes, repos et créneaux sociaux sous contraintes de santé
dures — et il a le droit de refuser un ordre qui mettrait un membre d'équipage ou la mission
en danger.

Quatre commandes vocales, en français, entièrement hors ligne :

| Commande | Effet |
|---|---|
| `état de <nom>` | état d'un membre, filtré selon le badge présenté |
| `qui peut tenir le poste <poste>` | liste classée des aptes, avec les motifs |
| `affecte <nom> à <poste>` | validé, ou refusé avec motif et alternative |
| `situation` | synthèse : alertes, compartiments, indisponibilités |

Deux niveaux d'accès, résolus physiquement par badge NFC : le porte-clés donne à un membre
d'équipage l'accès à ses propres données, la carte donne au capitaine une vue globale.

## Contrainte d'architecture

**Le système livré tourne intégralement sur la carte.** Le Raspberry Pi 5 porte le régulateur,
le modèle entraîné, la base de données, la synthèse et la reconnaissance vocale. Les machines
de développement servent à écrire le code et à entraîner le modèle, elles ne font pas partie
du vaisseau.

Aucune connexion Internet n'est requise à l'exécution. C'est la contrainte centrale du sujet,
et c'est aussi ce qui rend la démonstration vérifiable : on débranche le réseau, tout continue.

## Organisation du dépôt

```
docs/         documentation technique
firmware/     sketches Arduino (Mega ADK)
pi/           scripts Python (Raspberry Pi 5)
config/       cartographie matérielle et identifiants
sujet/        énoncé officiel du workshop
```

## Démarrage

La documentation matérielle est dans [`docs/materiel.md`](docs/materiel.md) : inventaire
complet, brochage de chaque capteur et état de validation.

Pour reconstruire le Raspberry Pi depuis une carte SD vierge, suivre
[`docs/installation-pi.md`](docs/installation-pi.md).

Les écueils rencontrés pendant le montage, et leurs solutions, sont consignés dans
[`docs/pieges.md`](docs/pieges.md). À lire avant de rebrancher quoi que ce soit.
