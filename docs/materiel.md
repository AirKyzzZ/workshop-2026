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

Le Mega est relié au Pi par un simple câble USB-B, à 115200 bauds, et il se reflashe à
distance sans jamais débrancher un câble.

Il est adressé par son chemin stable
`/dev/serial/by-id/usb-Arduino__www.arduino.cc__0044_953363337353517060D0-if00` et non par
`/dev/ttyACM0`. Avec deux Arduino branchés, `ACM0` et `ACM1` s'échangent d'un démarrage à
l'autre, et la passerelle se retrouverait à parler au nœud de compartiment.

| Broche | Composant | État |
|---|---|---|
| `A0` | Capteur de son (sortie analogique) | validé |
| `A1` | MQ-2, fumée et gaz combustibles | alimenté, non testé au gaz |
| `A2` | AD8232 `OUTPUT`, ECG | alimentation OK, **liaison intermittente** |
| `A3` | DHT22 `DATA` | validé, remonte jusqu'au dashboard |
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

## Thermique

Relevé sous charge le 2026-09-22 : **81,2 °C**, au-dessus du point de consigne de 75 °C,
horloge retombée à 1800 MHz, `get_throttled` à `0xe0000`. Le bit de sous-tension est
éteint, donc ce n'est plus l'alimentation : c'est du bridage thermique.

La cause était logicielle. La boucle caméra calculait l'empreinte faciale SFace sur chaque
image, environ 100 ms, soit un cœur entier en permanence pour personne. Elle ne détecte
plus qu'en présence d'un spectateur ou d'un contrôle en cours, et ne calcule l'empreinte
que pendant un contrôle.

| | Avant | Après |
|---|---|---|
| CPU du service API au repos | 114 % | 2,5 % |
| Température | 81,2 °C | 75,2 °C |

Reste que la carte n'a aucun dissipateur. Sous charge simultanée du modèle de langage et
de la caméra, elle repassera au-dessus de 80 °C. **Un dissipateur avec ventilateur est à
prévoir** pour tenir une démonstration longue.

## Audio

Le Raspberry Pi 5 **n'a plus de prise jack 3,5 mm**, et son connecteur GPIO est occupé par
l'écran, ce qui exclut aussi un DAC I²S. Les seules sorties possibles sont l'USB et l'HDMI.

**La webcam Logitech C270 apporte un micro.** Elle expose une interface `snd-usb-audio` en
plus de la vidéo, et `arecord -l` la voit en carte 0. La reconnaissance vocale redevient
donc possible sans achat, ce qui contredit une conclusion prise plus tôt dans le projet.
Il manque toujours une **sortie** : `aplay -l` ne liste que le HDMI.

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

## ECG

L'AD8232 est alimenté correctement, 3,33 V stables mesurés au multimètre, et les électrodes
sont neuves. Le placement thoracique a bien fait remonter l'amplitude, de 117 à 381 counts,
mais la liaison est intermittente : une minute de ligne plate à 27 counts avec `LO` à 0 % de
contact, puis du pleine échelle sans que rien n'ait bougé. C'est le câble ou le module.

Sans pièce de rechange, l'ECG est mis de côté. Ça ne bloque pas le modèle de stress, qui
s'entraîne de toute façon sur WESAD ; le capteur ne servait qu'à valider sur un signal à nous.

## Alimentation

**Résolu.** Le bloc d'origine ne tenait pas le 5 V et provoquait des extinctions sèches en
pleine démonstration. Après remplacement par un bloc 5 V / 5 A, `get_throttled` renvoie
`0x0`, y compris sous charge du modèle : plus aucun bit, pas même les bits collants. Le
rail mesure 5,16 V au lieu de 4,97 V, l'horloge tient 2400 MHz au lieu de s'effondrer à
1000, et le modèle passe de 8,2 à 10,7 jetons par seconde.

`usb_max_current_enable=1` a été ajouté dans `config.txt`. Sans ce drapeau le firmware
plafonne l'ensemble des ports USB à 600 mA tant qu'il n'a pas négocié une alimentation
5 A ; avec, il accorde 1,6 A, ce qui laisse le Mega ADK et la webcam énumérer ensemble.
**Ce drapeau suppose un bloc réellement capable de 5 A**, sinon il aggrave les coupures.

### Ce qui avait été mesuré avec l'ancien bloc

Gardé parce que c'est la trace du diagnostic. Mesures pendant une génération du modèle,
`vcgencmd` échantillonné toutes les 1,5 s :

| | Au repos | 3 fils de calcul | 2 fils de calcul |
|---|---|---|---|
| Rail `EXT5V` | 4,97 V | descend à **4,66 V** | 4,85 à 5,03 V |
| Horloge ARM | 1500 MHz | oscille 2400 ↔ **1000 MHz** | 1500 MHz stable |
| `get_throttled` | `0x50000` | `0x50005` | `0x50000` |
| Température | 56 °C | 74 °C | 54 °C |

`0x50005` allume les bits 0 et 2, c'est-à-dire sous-tension **active** et bridage de
fréquence **actif**. Le noyau le confirme au démarrage : `hwmon2: Undervoltage detected!`
puis `Voltage normalised`, deux fois de suite. Sous charge le bloc ne tient plus le 5 V,
le firmware divise l'horloge par 2,4 et la carte finit par s'éteindre.

Deux conséquences directes : la carte tombe du réseau pendant les démonstrations, et le
modèle de langage met 20 s au lieu de 7 s. Le contournement en place est
`--threads 2` sur `atria-llm`, qui tient le rail et donne paradoxalement un meilleur débit
que 3 fils, 8,2 jetons par seconde, puisque l'horloge ne s'effondre plus.

## Réseau

Le Pi s'est retrouvé injoignable après plusieurs coupures sèches, et la reprise s'est faite
par la carte SD depuis un Mac, sans écran ni Ethernet.

Deux pièges y ont été trouvés. D'abord **cloud-init ne s'exécute plus** après le premier
démarrage : modifier `network-config`, `user-data` ou `meta-data` sur la partition de boot
n'a plus aucun effet, pas même en changeant l'`instance-id`. Ce qui marche est le crochet
`systemd.run=` dans `cmdline.txt`, qui exécute un script avant tout le reste. Comme
NetworkManager n'y tourne pas encore, le script écrit directement les fichiers
`.nmconnection` dans `/etc/NetworkManager/system-connections/`, en `600` et `root`, faute de
quoi ils sont ignorés.

Ensuite, le routeur est en **Smart Connect** : le SSID `ASUS_E0_5G` est diffusé sur les deux
bandes, canal 8 en 2,4 GHz et canal 100 en 5 GHz. Le nom est donc trompeur, et le canal 100
est un canal DFS que le pilote Broadcom du Pi associe mal. La configuration retenue est un
profil `ASUS_E0_5G-24` verrouillé sur `wifi.band bg` en priorité 20, avec le profil sans
contrainte de bande en priorité 10 comme secours. Le signal passe de 80 à 97.

## À faire

- Second DHT22 sur le réacteur, pour avoir deux atmosphères à comparer sur les courbes.
- MQ-2 : tester la réaction au gaz avec un briquet non allumé.
- Elegoo Mega 2560 + LCD en afficheur de compartiment autonome.
- NodeMCU : câbler en compartiment déporté, nécessite le point d'accès Wi-Fi du Pi.
- Alimentation 5 V / 5 A pour le Pi, et dongle USB audio. Les deux seuls achats bloquants.
