# Schéma de montage

Le câblage complet des capteurs, en texte versionné. `diagram.json` est le format de
[Wokwi](https://wokwi.com) : il se lit dans un éditeur, se compare dans une pull request
et se rend graphiquement en ligne, contrairement à une capture d'écran qu'on ne peut pas
mettre à jour proprement.

Tout le câblage réel vit sur le Mega. Le connecteur 40 broches du Pi est entièrement
recouvert par l'écran PiTFT et l'overlay de celui-ci réquisitionne SPI0, donc aucun
capteur ne peut y aller. Le Pi ne voit que l'USB.

## Ouvrir le schéma

Aller sur [wokwi.com/projects/new/arduino-mega](https://wokwi.com/projects/new/arduino-mega),
ouvrir l'onglet `diagram.json`, tout sélectionner et coller le contenu du fichier. Le
schéma apparaît immédiatement. Coller ensuite `sketch.ino` dans l'onglet du même nom et
ajouter les bibliothèques de `libraries.txt` par le gestionnaire.

Dans VS Code, l'extension Wokwi lit directement `wokwi.toml` et ouvre le schéma à côté du
code.

## Ce que la simulation fait tourner

`sketch.ino` est le sous-ensemble simulable du firmware réel. Il émet exactement le même
protocole série, donc on peut vérifier le format des trames sans matériel :

```
READY simulation=wokwi
SENSE <crete_micro> <mq2_brut> <temperature_x10> <humidite_x10>
```

Les commandes `BEEP OK|DENY|ALERT|LISTEN` et `PING` répondent comme sur la carte. La
partie badge est remplacée par une commande `BADGE <uid>` à taper dans le moniteur série,
puisque le RC522 n'est pas simulable.

Pendant la simulation, cliquer sur un DHT22 ouvre un curseur de température et d'humidité,
et cliquer sur le MQ-2 permet de faire monter la concentration de gaz. C'est de quoi
tester le seuil d'alerte incendie sans allumer quoi que ce soit.

## Deux substitutions

Wokwi ne fournit ni lecteur RC522 ni capteur de son. Le schéma les remplace par des
composants au brochage identique, et les libellés le disent explicitement.

| Réel | Dans le schéma | Pourquoi ça tient |
|---|---|---|
| Capteur de son analogique | Potentiomètre | Une seule sortie analogique vers `A0`, même plage |
| RC522 NFC | Lecteur microSD | Même bus SPI matériel, mêmes broches `MISO` `MOSI` `SCK` `CS` |

## Brochage

| Broche | Composant | Tension | État |
|---|---|---|---|
| `A0` | Capteur de son | 5 V | validé |
| `A1` | MQ-2, fumée et gaz | 5 V | alimenté, non testé au gaz |
| `A2` | AD8232, ECG | 3,3 V | liaison intermittente, mis de côté |
| `A3` | DHT22 infirmerie | 5 V | validé, remonte jusqu'au dashboard |
| `A4` | DHT22 réacteur | 5 V | à câbler |
| `D6` | Buzzer actif | 5 V | validé |
| `D49` | RC522 `RST` | 3,3 V | validé |
| `D50` `D51` `D52` | SPI matériel `MISO` `MOSI` `SCK` | 3,3 V | imposé par le matériel |
| `D53` | RC522 `SDA` / `SS` | 3,3 V | validé |

**Règle d'alimentation.** Le RC522 est un composant 3,3 V, le MQ-2 et le capteur de son
sont en 5 V. Ne jamais faire partager la même rangée d'alimentation à un composant 3,3 V
et à un composant 5 V : c'est ce qui a empêché le RC522 de répondre pendant une bonne
partie du montage.

**Règle d'isolation.** Aucune liaison directe entre les broches du Mega et le GPIO du Pi.
Le Mega est en 5 V, le GPIO du Pi en 3,3 V. Tout passe par l'USB.

## Mettre à jour

Ajouter un composant, c'est une entrée dans `parts` et ses liaisons dans `connections`.
Le format d'une liaison est `[source, cible, couleur, trajet]`, où les deux premiers
champs s'écrivent `identifiant:broche`. Penser à reporter la modification dans le tableau
de brochage ci-dessus et dans [`../../docs/materiel.md`](../../docs/materiel.md).

La vue système, qui couvre aussi le Pi et la circulation des données, est dans
[`../../docs/montage.md`](../../docs/montage.md).
