# Montage

Vue d'ensemble du vaisseau tel qu'il est câblé aujourd'hui. Le brochage détaillé, les tensions
et l'état de validation de chaque composant sont dans [`materiel.md`](materiel.md) ; ce
document sert à voir d'un coup d'œil ce qui est relié à quoi.

![Plan de câblage d'ATRIA](../hardware/montage-complet.svg)

Ce plan est généré par [`hardware/schema.py`](../hardware/schema.py), un script plutôt
qu'un dessin fait à la main : la géométrie reste cohérente quand on déplace une carte ou
qu'on ajoute un capteur, et un diff reste lisible dans une pull request. Le relancer
régénère le SVG.

Wokwi ne propose aucun Raspberry Pi, seulement le Pico qui est un microcontrôleur : y
mettre un Pico à la place du Pi 5 serait faux. Le détail électrique fil par fil et
simulable des cartes Arduino reste donc dans [`hardware/wokwi/`](../hardware/wokwi/), et
ce plan porte la vue d'ensemble.

## Le montage actuel

Relevé sur la carte le 2026-09-22 par `lsusb -t`, `/sys/kernel/debug/gpio`, `vcgencmd` et
`/dev/serial/by-id`. Tout ce qui figure ici a été lu sur la machine, rien n'est supposé.

```mermaid
graph TB
  SECTEUR["Bloc secteur USB-C<br/>5,1 V / 5 A<br/>rail mesure a 5,11 V"]

  subgraph PI["Raspberry Pi 5 Model B Rev 1.1 - 4 Go - Debian 13 trixie"]
    direction TB
    SERVICES["atria-api  ·  atria-terminal  ·  atria-llm"]
    BASE[("SQLite WAL  ·  data/atria.db<br/>25 crew · 899 ambiance · 226 journal · 16 gabarits")]
    MODELES["modeles embarques 1,1 Go<br/>Qwen2.5-1.5B 941 Mo · Vosk 66 Mo<br/>Piper 61 Mo · YuNet+SFace 38 Mo"]
  end

  subgraph HAT["PiTFT 2,8 pouces sur le connecteur 40 broches"]
    ECRAN["ILI9340 320x240 RGB565<br/>/dev/fb0"]
    GPIOS["SPI0 CS0 (GPIO8) ecran<br/>SPI0 CS1 (GPIO7) tactile HS<br/>GPIO25 data/command"]
    BOUTONS["GPIO 17 · 22 · 23 · 27<br/>haut · bas · valider · retour"]
  end

  subgraph USB["Arbre USB"]
    MEGA["Bus 001 · 2341:0044<br/>Arduino Mega ADK R3<br/>by-id ...0044_9533633373535..."]
    CAM["Bus 003 · 046d:0825<br/>Logitech C270<br/>video + micro"]
    NOEUD["libre<br/>noeud de compartiment"]
  end

  subgraph PLAQUE["Plaque d'essai - front-end analogique du Mega"]
    direction TB
    R33["rail 3,3 V<br/>RC522 NFC"]
    R5["rail 5 V<br/>capteur de son · MQ-2 · DHT22"]
    ECG["AD8232 ECG<br/>liaison intermittente, hors service"]
  end

  RESERVE["En reserve : Mega 2560 + LCD1602,<br/>NodeMCU V3, ESP-12F"]

  SECTEUR --> PI
  PI --- HAT
  PI --- USB
  MEGA --- PLAQUE
  SERVICES --- BASE
  SERVICES --- MODELES
  CAM -. "uvcvideo + snd-usb-audio" .-> SERVICES
  NOEUD -. "a brancher" .-> RESERVE
  PI -- "Wi-Fi 2,4 GHz · HTTP + WebSocket :8000" --> CLIENTS["Navigateurs du bord"]

  classDef ok fill:#E9F5EF,stroke:#1E7F58,color:#1D1B1B;
  classDef hs fill:#FBEBE8,stroke:#B3311F,color:#1D1B1B;
  classDef futur fill:#FDF4E6,stroke:#9A6410,color:#1D1B1B,stroke-dasharray:4 3;
  class MEGA,CAM,ECRAN,BOUTONS,R33,R5 ok;
  class ECG hs;
  class NOEUD,RESERVE futur;
```

### Ce que le Pi expose vraiment

| Ressource | Etat mesure |
|---|---|
| `/dev/fb0` | `fb_ili9340`, 320x240, 16 bits |
| GPIO 7 et 8 | `spi0 CS1` et `CS0`, pris par le PiTFT |
| GPIO 25 | `dc`, data/command de l'ILI9340 |
| GPIO 17 22 23 27 | revendiques par `lgpio`, les quatre boutons |
| `/dev/i2c-1` | active, libre |
| Capture audio | carte 0, micro integre de la C270 |
| Sortie audio | **HDMI uniquement**, aucun peripherique USB audio |
| `/dev/ttyACM0` | Mega ADK, adresse par son chemin `by-id` |

Le connecteur 40 broches est entierement recouvert par le PiTFT et l'overlay de celui-ci
reserve SPI0. Aucun capteur ne peut y aller : tout passe par le Mega, en USB.

Le micro de la C270 change une conclusion prise plus tot dans le projet. La reconnaissance
vocale redevient possible sans achat. Il manque toujours une **sortie** audio : seul le
HDMI est disponible, donc pour que ATRIA parle il faut un dongle USB audio.

## Ce qui circule

```mermaid
sequenceDiagram
  participant C as Capteurs
  participant M as Mega ADK
  participant A as atria-api
  participant D as SQLite
  participant W as Dashboard

  loop toutes les 2 s
    C->>M: niveaux analogiques
    M->>A: SENSE mic mq2 temp hum
    A->>D: enregistrer_ambiance()
  end
  C->>M: badge présenté
  M->>A: BADGE <uid>
  A->>D: ouvrir_session() + journaliser()
  A->>M: BEEP OK
  A-->>W: push WebSocket (3 s)
  W->>A: GET /api/ambiance/{compartiment}
  A->>D: serie_ambiance(24 h)
```

Rien ne sort du vaisseau. Le dashboard est servi par le Pi, les modèles de voix sont sur sa
carte SD, et la base est un fichier local. Débrancher le réseau ne coupe que les navigateurs.

## La suite

Les composants ci-dessous sont en stock mais pas encore au montage. Ils viennent tous se
greffer sur des points déjà ouverts, sans toucher à ce qui fonctionne.

```mermaid
graph LR
  MEGA["Arduino Mega ADK"]
  PI["Raspberry Pi 5"]

  DHT2["Second DHT22<br/>→ réacteur"]
  ECG["AD8232<br/>câble ou module à remplacer"]
  ELEGOO["Elegoo Mega 2560 + LCD<br/>afficheur de compartiment"]
  NODEMCU["NodeMCU V3<br/>compartiment déporté"]
  AP["Point d'accès Wi-Fi du Pi"]
  DONGLE["Dongle USB audio<br/>+ enceinte amplifiée"]

  MEGA -.-> DHT2
  MEGA -.-> ECG
  PI -.-> ELEGOO
  PI -.-> DONGLE
  PI -.-> AP
  AP -.-> NODEMCU

  classDef futur fill:#FDF4E6,stroke:#9A6410,color:#1D1B1B,stroke-dasharray:4 3;
  class DHT2,ECG,ELEGOO,NODEMCU,AP,DONGLE futur;
```

Le second DHT22 est le plus rentable : il fait passer le plan du vaisseau de un à deux
compartiments instrumentés, et il rend la comparaison entre deux atmosphères lisible sur les
courbes. Le NodeMCU dépend du point d'accès, qui dépend lui-même d'une liaison Ethernet pour
ne pas couper le SSH pendant la bascule.
