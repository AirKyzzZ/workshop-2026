# Schémas de montage

Le câblage en texte versionné, au format [Wokwi](https://wokwi.com) : ça se lit dans un
éditeur, ça se compare dans une pull request et ça se rend graphiquement en ligne,
contrairement à une capture d'écran qu'on ne peut pas mettre à jour proprement.

Deux cartes, deux dossiers, parce que ce sont deux firmwares indépendants.

| Dossier | Carte | Rôle |
|---|---|---|
| `passerelle/` | Arduino Mega ADK | Badges, buzzer, son, gaz, atmosphère de l'infirmerie |
| `noeud/` | Mega 2560 + LCD1602 | Un compartiment, sa sonde et son afficheur local |

Les schémas ne portent que les libellés de composants. Le brochage, les tensions et les
états de validation sont dans les tableaux ci-dessous et dans
[`../../docs/materiel.md`](../../docs/materiel.md), là où on peut les chercher.

Tout le câblage vit sur les Arduino. Le connecteur 40 broches du Pi est entièrement
recouvert par l'écran PiTFT et l'overlay de celui-ci réserve SPI0, donc aucun capteur ne
peut y aller. Le Pi ne voit que l'USB.

## Ouvrir un schéma

Aller sur [wokwi.com/projects/new/arduino-mega](https://wokwi.com/projects/new/arduino-mega),
ouvrir l'onglet `diagram.json`, tout sélectionner et coller le fichier du dossier voulu.
Le schéma apparaît immédiatement. Coller ensuite `sketch.ino` et ajouter les bibliothèques
de `libraries.txt` par le gestionnaire.

Dans VS Code, l'extension Wokwi lit directement `wokwi.toml`.

## Passerelle

| Broche | Composant | Tension | État |
|---|---|---|---|
| `A0` | Capteur de son | 5 V | validé |
| `A1` | MQ-2, fumée et gaz | 5 V | alimenté, non testé au gaz |
| `A2` | AD8232 `OUTPUT` | 3,3 V | liaison intermittente, hors service |
| `A3` | DHT22 infirmerie | 5 V | validé, remonte jusqu'au dashboard |
| `D6` | Buzzer actif | 5 V | validé |
| `D10` | AD8232 `LO-` | 3,3 V | hors service |
| `D11` | AD8232 `LO+` | 3,3 V | hors service |
| `D49` | RC522 `RST` | 3,3 V | validé |
| `D50` `D51` `D52` | SPI matériel `MISO` `MOSI` `SCK` | 3,3 V | imposé par le matériel |
| `D53` | RC522 `SDA` / `SS` | 3,3 V | validé |

`sketch.ino` est le sous-ensemble simulable du firmware réel. Il émet le même protocole,
donc on peut vérifier le format des trames sans matériel :

```
READY simulation=wokwi
SENSE <crete_micro> <mq2_brut> <temperature_x10> <humidite_x10>
```

Les commandes `BEEP OK|DENY|ALERT|LISTEN` et `PING` répondent comme sur la carte. La
partie badge devient une commande `BADGE <uid>` à taper dans le moniteur série, le RC522
n'étant pas simulable.

Pendant la simulation, cliquer sur le DHT22 ouvre un curseur de température et
d'humidité, et cliquer sur le MQ-2 fait monter la concentration de gaz. C'est de quoi
tester le seuil d'alerte incendie sans allumer quoi que ce soit.

## Nœud de compartiment

| Broche | Composant |
|---|---|
| `A0` | DHT22 `DATA`, 5 V |
| `D8` | LCD `RS` |
| `D9` | LCD `E` |
| `D4` `D5` `D6` `D7` | LCD `D4`..`D7` |

Le firmware est celui de [`../../firmware/atria_noeud/`](../../firmware/atria_noeud/),
à l'identique. Il mesure, affiche en local et annonce une ligne par seconde :

```
READY noeud=<compartiment>
AMBIANCE <compartiment> <tempX10> <humX10>
```

Le Pi peut répondre `NOM <compartiment>` pour le renommer, ou `PING`.

Côté Pi, `pi/atria/noeud.py` scrute `/dev/serial/by-id` toutes les quinze secondes et
ouvre toute carte qui n'est pas la passerelle. Rien à configurer : brancher le câble
suffit, la carte annonce elle-même son compartiment.

## Deux règles de câblage

**Alimentation.** Le RC522 et l'AD8232 sont en 3,3 V, le capteur de son, le MQ-2 et les
DHT22 en 5 V. Ne jamais faire partager la même rangée à un composant 3,3 V et à un
composant 5 V : c'est ce qui a empêché le RC522 de répondre pendant une bonne partie du
montage.

**Isolation.** Aucune liaison directe entre les broches d'un Arduino et le GPIO du Pi.
Les Arduino sont en 5 V, le GPIO du Pi en 3,3 V. Tout passe par l'USB, et chaque carte est
adressée par son chemin `/dev/serial/by-id` plutôt que par `/dev/ttyACM0`, sinon l'ordre
d'énumération change d'un démarrage à l'autre.

## Trois substitutions

Wokwi ne fournit ni RC522, ni capteur de son, ni AD8232. Le schéma les remplace par des
composants au brochage équivalent, et les libellés le disent.

| Réel | Dans le schéma | Pourquoi ça tient |
|---|---|---|
| Capteur de son analogique | Potentiomètre | Une sortie analogique, même plage |
| AD8232 `OUTPUT` | Potentiomètre | Idem, plus deux boutons pour `LO+` et `LO-` |
| RC522 NFC | Lecteur microSD | Même bus SPI matériel, mêmes broches |

## Mettre à jour

Ajouter un composant, c'est une entrée dans `parts` et ses liaisons dans `connections`.
Une liaison s'écrit `[source, cible, couleur, trajet]`, les deux premiers champs sous la
forme `identifiant:broche`. Reporter ensuite dans les tableaux ci-dessus et dans
[`../../docs/materiel.md`](../../docs/materiel.md).

La vue système, qui couvre le Pi, son écran, l'arbre USB et la circulation des données,
est dans [`../../docs/montage.md`](../../docs/montage.md).
