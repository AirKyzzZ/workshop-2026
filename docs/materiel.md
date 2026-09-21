# Matériel

## Cartes

| Carte | Rôle | État |
|---|---|---|
| Raspberry Pi 5, 4 Go | Cerveau. Régulateur, modèle, base, voix, dashboard | opérationnel |
| Arduino Mega ADK R3 | Front-end analogique et capteurs, relié au Pi en USB | opérationnel |
| Elegoo Mega 2560 R3 | Second terminal, non encore utilisé | disponible |
| NodeMCU V3 (ESP8266) | Compartiment déporté en Wi-Fi | à câbler |
| Geekcreit ESP-12F (ESP8266) | Troisième compartiment, ou secours | disponible |
| Adafruit PiTFT 2,8" résistif | Afficheur de bord monté sur le Pi | affichage OK, tactile HS |

Les deux modules vendus comme « ESP-12F devkit » et « NodeMCU V3 » sont tous deux à base
d'**ESP8266**, pas d'ESP32. Une seule entrée analogique, pas de Bluetooth, mono-cœur.

## Brochage du Mega ADK

Le Mega est relié au Pi par un simple câble USB-B. Il est vu comme `/dev/ttyACM0` à
115200 bauds, et il se reflashe à distance sans jamais débrancher un câble.

| Broche | Composant | État |
|---|---|---|
| `A0` | Capteur de son (sortie analogique) | validé |
| `A1` | MQ-2, fumée et gaz combustibles | alimenté, non testé au gaz |
| `A2` | AD8232 `OUTPUT` — ECG | validé électriquement |
| `A4` | DHT22 `DATA` | **ne répond pas** |
| `D6` | Buzzer actif `+` | validé |
| `D10` | AD8232 `LO-` | validé |
| `D11` | AD8232 `LO+` | validé |
| `D49` | RC522 `RST` | validé |
| `D50` / `D51` / `D52` | SPI matériel — `MISO` / `MOSI` / `SCK` | imposé par le matériel |
| `D53` | RC522 `SDA` / `SS` | validé |

**Règle d'alimentation.** L'AD8232 et le RC522 sont des composants **3,3 V** et doivent recevoir
un fil dédié depuis la broche `3.3V` du Mega. Le capteur de son et le MQ-2 sont en **5 V**.
Ne jamais faire partager la même rangée d'alimentation à un composant 3,3 V et à un composant
5 V : c'est ce qui a empêché le RC522 de répondre pendant une bonne partie du montage.

**Règle d'isolation.** Aucune liaison directe entre les broches du Mega et le GPIO du Pi. Le
Mega est en 5 V, le GPIO du Pi en 3,3 V. Tout passe par l'USB.

## Raspberry Pi 5

| Ressource | État |
|---|---|
| OS | Debian 13 trixie, 64 bits, image Lite |
| Noyau | 6.18.50+rpt-rpi-2712 |
| Python | 3.13.5, environnement virtuel dans `~/atria/.venv` |
| I²C | `/dev/i2c-1` activé, libre |
| SPI | réquisitionné par l'overlay du PiTFT |
| UART | activé |
| Audio | **aucune sortie** — voir la section correspondante |

Le connecteur 40 broches est entièrement recouvert par le PiTFT. Plus rien ne peut y être
câblé : tous les capteurs supplémentaires vont sur le Mega ou sur les ESP.

## Écran PiTFT 2,8"

Overlay activé dans `/boot/firmware/config.txt` :

```
dtoverlay=pitft28-resistive,rotate=90,speed=32000000,fps=60
```

L'affichage fonctionne et s'initialise seul au démarrage : `/dev/fb0`, 320×240, RGB565. Le
script `pi/screen.py` y dessine avec Pillow.

La console Linux s'accapare le framebuffer au boot. Pour la détacher :

```bash
echo 0 | sudo tee /sys/class/vtconsole/vtcon1/bind
```

**Le tactile est hors service.** Le contrôleur STMPE610 renvoie un identifiant de puce invalide
(`0x80` au lieu de `0x0811`) à la fréquence correcte de 500 kHz, sur un connecteur qui fait
pourtant contact pour l'affichage. Deux réenfichages n'ont rien changé. Décision : l'écran sert
en affichage seul, l'interaction passe par le badge NFC et les boutons du Mega — ce qui est de
toute façon plus crédible pour un cockpit qu'un écran tactile grand public.

## Badges NFC

Lecteur RC522, puce MFRC522 v2.0 authentique (`VERSION = 0x92`).

| UID | Support | Rôle |
|---|---|---|
| `FC2A1B17` | porte-clés | membre d'équipage |
| `19BD41B2` | carte blanche | capitaine |

Le RC522 est un composant 3,3 V piloté par un Mega en 5 V. C'est hors spécification et ça
fonctionne, mais si des lectures erratiques apparaissent, il faudra trois ponts diviseurs sur
`MOSI`, `SCK` et `SS`.

## Audio

Le Raspberry Pi 5 **n'a plus de prise jack 3,5 mm**, et son connecteur GPIO est occupé par
l'écran, ce qui exclut aussi un DAC I²S. Les seules sorties possibles sont l'USB et l'HDMI.

En développement, un pont réseau sert de contournement : le Pi synthétise la voix, une machine
du réseau la joue et lui renvoie son micro. Voir `pi/console.py` côté Pi et
`pi/atria_console_mac.py` côté poste de commandement.

**Pour la soutenance, un dongle USB audio est indispensable**, avec une enceinte amplifiée : un
dongle sort un niveau casque, insuffisant pour une salle.

## Chaîne vocale

| Composant | Modèle | Performance mesurée |
|---|---|---|
| Synthèse | Piper `fr_FR-siwis-medium`, 61 Mo | facteur temps réel 0,60 |
| Reconnaissance | Vosk `vosk-model-small-fr-0.22`, 66 Mo | 0,32 s en grammaire contrainte |

Les modèles ne sont pas versionnés. Leur téléchargement est décrit dans
[`installation-pi.md`](installation-pi.md).

**La reconnaissance doit utiliser une grammaire contrainte**, pas le vocabulaire ouvert. En
libre, le modèle *small* transcrit mal et met 6,5 s ; avec la liste des phrases autorisées, il
répond en 0,32 s, soit vingt fois plus vite et de façon fiable.

Vocabulaire vérifié dans le lexique du modèle : tous les noms d'équipage retenus (moreau,
bianchi, reyes, weber, novak, silva, martin, dubois…), tous les postes (chirurgie, propulsion,
serre, navigation, maintenance, laboratoire, infirmerie, réacteur) et toutes les commandes
(état, équipage, affecte, situation, statut, alerte, santé, oxygène, stress, fatigue, sommeil).

Deux pièges : **le mot « atria » est absent du lexique** et ne peut pas servir de mot de réveil
— utiliser « aria », qui y figure, ou un bouton de dialogue. Et la grammaire doit être
sérialisée avec `ensure_ascii=False`, sinon les accents sont échappés et plus rien n'est
reconnu.

## À faire

- DHT22 : ne répond sur aucune broche, deux exemplaires testés. Mesurer `VCC` au multimètre et
  vérifier la sérigraphie du module avant tout nouvel essai.
- MQ-2 : tester la réaction au gaz avec un briquet non allumé.
- NodeMCU : câbler en compartiment déporté, nécessite le point d'accès Wi-Fi du Pi.
- Alimentation 5 V / 5 A pour le Pi, et dongle USB audio. Les deux seuls achats bloquants.
