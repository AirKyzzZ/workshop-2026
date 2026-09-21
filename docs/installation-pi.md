# Installation du Raspberry Pi

Procédure complète depuis une carte SD vierge. Comptez une heure, dont l'essentiel en
téléchargements.

## Prérequis

- Carte microSD de 16 Go minimum, classe A1
- **Alimentation 5 V / 5 A en USB-C.** Une alimentation de 3 A démarre le Pi mais plafonne le
  courant USB total à 600 mA, ce qui provoque des décrochages dès qu'on branche un Arduino.
  Symptôme : le Pi disparaît du réseau sans raison apparente.
- Un refroidisseur actif est recommandé. Le Pi 5 monte à 50 °C au repos et throttle à 80 °C.

## 1. Flasher la carte

Dans Raspberry Pi Imager :

- **Modèle** : Raspberry Pi 5
- **OS** : Raspberry Pi OS **Lite (64 bits)**. Surtout pas la version desktop, inutile et
  encombrante sur 16 Go.
- **Réglages personnalisés** : nom d'hôte `atria`, utilisateur `atria`, Wi-Fi, pays `FR`,
  fuseau `Europe/Paris`, et **activer SSH**.

Pour le Wi-Fi du premier démarrage, préférer un partage de connexion téléphonique au réseau du
campus : les réseaux d'établissement ont un portail captif et de l'isolation client, le Pi
serait injoignable.

## 2. Accès SSH

```bash
ssh-copy-id atria@atria.local
```

Un alias dans `~/.ssh/config` évite de retaper l'adresse, et `AddressFamily inet` évite que
`ssh` tente une IPv6 de lien local qui échoue :

```
Host atria
    HostName atria.local
    User atria
    AddressFamily inet
    IdentityFile ~/.ssh/id_ed25519
```

## 3. Sudo sans mot de passe

Raspberry Pi OS ne le configure plus par défaut sur Trixie, ce qui bloque toute automatisation.

```bash
ssh -t atria 'echo "atria ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/010-atria-nopasswd \
  && sudo chmod 440 /etc/sudoers.d/010-atria-nopasswd'
```

## 4. Bus matériels et dépendances

```bash
sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_serial_hw 0
sudo raspi-config nonint do_serial_cons 1

sudo apt-get update
sudo apt-get -y install git build-essential cmake python3-venv python3-dev \
                        i2c-tools sqlite3 fonts-dejavu-core python3-lgpio liblgpio-dev
sudo reboot
```

Après redémarrage, `/dev/i2c-1`, `/dev/spidev0.0` et `/dev/ttyAMA0` doivent exister.

## 5. Environnement Python

```bash
mkdir -p ~/atria && cd ~/atria
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install numpy scipy pyserial fastapi uvicorn vosk xgboost \
                      scikit-learn piper-tts pillow mfrc522 rpi-lgpio
```

Toutes ces bibliothèques ont des roues aarch64 compatibles Python 3.13, à une exception près :
`lgpio` ne se compile pas depuis pip sur Trixie. On utilise le binaire Debian en le liant dans
l'environnement virtuel :

```bash
SP=~/atria/.venv/lib/python3.13/site-packages
ln -sf /usr/lib/python3/dist-packages/lgpio.py $SP/lgpio.py
ln -sf /usr/lib/python3/dist-packages/_lgpio.cpython-313-aarch64-linux-gnu.so $SP/
```

`RPi.GPIO` classique ne fonctionne pas sur Pi 5 : la puce RP1 a changé l'accès au GPIO. Le
paquet `rpi-lgpio` fournit un substitut compatible qui s'appuie sur `lgpio`.

## 6. Modèles de voix

Environ 127 Mo, non versionnés.

```bash
cd ~/atria && mkdir -p models/piper models/vosk

B=https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium
curl -fL -o models/piper/fr_FR-siwis-medium.onnx      $B/fr_FR-siwis-medium.onnx
curl -fL -o models/piper/fr_FR-siwis-medium.onnx.json $B/fr_FR-siwis-medium.onnx.json

cd models/vosk
curl -fL -O https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip
unzip -q vosk-model-small-fr-0.22.zip && rm vosk-model-small-fr-0.22.zip
```

Vérification :

```bash
cd ~/atria && echo "ATRIA en ligne." | \
  .venv/bin/python -m piper -m models/piper/fr_FR-siwis-medium.onnx -f /tmp/test.wav
```

## 7. Chaîne de compilation Arduino

Installée **sur le Pi**, pas sur le poste de développement : les cartes restent branchées et se
reflashent à distance.

```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
  | BINDIR=$HOME/bin sh
echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc && export PATH=$HOME/bin:$PATH

arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install MFRC522 "DHT sensor library"
```

Cycle de travail :

```bash
arduino-cli compile --fqbn arduino:avr:megaADK ~/atria/firmware/<sketch>
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:megaADK ~/atria/firmware/<sketch>
```

## 8. Écran PiTFT

```bash
echo "dtoverlay=pitft28-resistive,rotate=90,speed=32000000,fps=60" \
  | sudo tee -a /boot/firmware/config.txt
sudo reboot
```

Raspberry Pi OS livre les overlays officiels, le script d'installation d'Adafruit est inutile
et ne gère pas le Pi 5. Après redémarrage, `/dev/fb0` doit apparaître en 320×240.

Si l'écran reste blanc alors que le pilote s'est chargé, le contrôleur ILI9341 n'a pas été
initialisé — en général un connecteur mal enfiché. Forcer une réinitialisation :

```bash
echo spi0.0 | sudo tee /sys/bus/spi/drivers/fb_ili9340/unbind
echo spi0.0 | sudo tee /sys/bus/spi/drivers/fb_ili9340/bind
```

**Toujours éteindre le Pi avant d'enficher ou de retirer un HAT.**
