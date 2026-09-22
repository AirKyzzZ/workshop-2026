# Montage

Vue d'ensemble du vaisseau tel qu'il est câblé aujourd'hui. Le brochage détaillé, les tensions
et l'état de validation de chaque composant sont dans [`materiel.md`](materiel.md) ; ce
document sert à voir d'un coup d'œil ce qui est relié à quoi.

## Le montage actuel

```mermaid
graph LR
  SECTEUR["Bloc secteur 5 V / 5 A"]

  subgraph PI["Raspberry Pi 5 · 4 Go · Debian 13"]
    SERVICES["atria-api + atria-terminal<br/>Python 3.13"]
    BASE[("SQLite WAL<br/>atria.db")]
    VOIX["Vosk STT + Piper TTS<br/>modèles locaux"]
  end

  subgraph MEGA["Arduino Mega ADK · firmware atria_link"]
    LOOP["boucle 4450 Hz<br/>SENSE / BADGE / BEEP"]
  end

  subgraph R33["Rail 3,3 V"]
    RC522["RC522<br/>lecteur NFC<br/>D53 SS · D49 RST · SPI D50-52"]
  end

  subgraph R5["Rail 5 V"]
    MIC["Capteur de son<br/>A0"]
    MQ2["MQ-2<br/>fumée et gaz<br/>A1"]
    DHT["DHT22<br/>température + humidité<br/>A3"]
  end

  PITFT["PiTFT 2,8 pouces<br/>320x240 sur SPI0<br/>tactile HS"]
  BOUTONS["4 boutons<br/>GPIO 17 · 22 · 23 · 27"]
  BUZZER["Buzzer actif<br/>D6"]
  CLIENTS["Navigateurs du bord<br/>dashboard :8000"]

  SECTEUR --> PI
  PI -- "USB-B · /dev/ttyACM0 · 115200" --> MEGA
  PI --> PITFT
  PI --> BOUTONS
  MEGA --> R33
  MEGA --> R5
  MEGA --> BUZZER
  SERVICES --- BASE
  SERVICES --- VOIX
  PI -- "Wi-Fi · HTTP + WebSocket" --> CLIENTS

  classDef ok fill:#E9F5EF,stroke:#1E7F58,color:#1D1B1B;
  classDef hs fill:#FBEBE8,stroke:#B3311F,color:#1D1B1B;
  class RC522,MIC,MQ2,DHT,BUZZER,BOUTONS ok;
  class PITFT hs;
```

Le Mega est le seul endroit où des capteurs sont câblés. Le connecteur 40 broches du Pi est
entièrement recouvert par le PiTFT, et l'overlay de l'écran réquisitionne SPI0, donc tout ce
qui arrive après passe par le Mega et remonte en USB. C'est aussi ce qui garde le 5 V du Mega
loin du 3,3 V du Pi.

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
