# Soutenance

`soutenance.html` est le support projeté. Un seul fichier, tout est dedans sauf l'image du
schéma et les polices, chargées depuis Google Fonts. Il s'ouvre dans n'importe quel
navigateur, sans rien installer.

## Naviguer

| Touche | Effet |
|---|---|
| `→` `↓` `espace` | écran suivant |
| `←` `↑` | écran précédent |
| `A` | saute directement aux annexes |
| `Début` `Fin` | premier et dernier écran |

La molette et le balayage tactile fonctionnent aussi. Les pastilles à droite permettent
d'aller n'importe où d'un clic ; les pastilles creuses sont les annexes.

## Découpage

Seize écrans projetés, en trois blocs de parole, plus quatre annexes qui ne sont pas
projetées d'office.

| | Qui | Écrans | Durée visée |
|---|---|---|---|
| Contexte et matériel | Melih | 01 à 05 | 00:00 → 03:20 |
| Montage et intégration | Alexandre | 06 à 10 | 03:20 → 06:40 |
| Logiciel, IA et démonstration | Maxime | 11 à 15 | 06:40 → 09:30 |
| Clôture | à trois | 16 | 09:30 → 10:00 |

Le bandeau du haut indique en permanence qui parle et où on en est dans les trois blocs.

## L'écran 14 est le filet de sécurité

C'est la démonstration du refus d'ordre, avec les chiffres exacts de la machine. Si la
carte tombe ou si le réseau lâche pendant la démonstration en direct, il suffit de rester
sur cet écran et de commenter : le jury voit la même chose, en figé.

## Les annexes

Accessibles par `A` ou par les pastilles creuses. Elles servent aux questions du jury, pas
à la présentation : ce qui n'a pas marché, les mesures d'alimentation et thermiques,
l'architecture logicielle, et le détail de la prédiction.

## Exporter en PDF

```bash
bash ~/.claude/skills/frontend-slides/scripts/export-pdf.sh presentation/soutenance.html
```

Les animations sont remplacées par leur état final, la mise en page ne bouge pas.
