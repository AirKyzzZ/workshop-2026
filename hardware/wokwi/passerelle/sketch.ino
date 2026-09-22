// Sous-ensemble simulable du firmware atria_link.
// Le RC522 n'est pas simulable par Wokwi, la partie badge est donc remplacee par une
// commande serie BADGE <uid>. Tout le reste, protocole compris, est identique a
// firmware/atria_link/atria_link.ino.

#include <DHT.h>

const uint8_t BUZZER = 6;
const uint8_t MIC = A0;
const uint8_t MQ2 = A1;
const uint8_t DHT_INFIRMERIE = A3;
const uint8_t DHT_REACTEUR = A4;

const unsigned long SENSE_MS = 250;
const unsigned long DHT_MS = 3000;

DHT climat(DHT_INFIRMERIE, DHT22);
DHT climat_reacteur(DHT_REACTEUR, DHT22);

unsigned long prochainSense = 0;
unsigned long prochainDht = 0;
int tempX10 = -9999;
int humX10 = -9999;
char ligne[24];
uint8_t longueur = 0;

void bip(uint16_t freq, uint16_t duree) {
  tone(BUZZER, freq, duree);
  delay(duree + 25);
  noTone(BUZZER);
  digitalWrite(BUZZER, LOW);
}

void jouer(const char *motif) {
  if (!strcmp(motif, "OK")) {
    bip(880, 70);
    bip(1320, 110);
  } else if (!strcmp(motif, "DENY")) {
    bip(330, 160);
    bip(220, 240);
  } else if (!strcmp(motif, "ALERT")) {
    for (uint8_t i = 0; i < 3; i++) {
      bip(2000, 80);
      delay(60);
    }
  } else if (!strcmp(motif, "LISTEN")) {
    bip(1500, 60);
  }
}

void traiter(char *cmd) {
  if (!strncmp(cmd, "BEEP ", 5)) {
    jouer(cmd + 5);
    Serial.println(F("ACK"));
  } else if (!strcmp(cmd, "PING")) {
    Serial.println(F("PONG"));
  } else if (!strncmp(cmd, "BADGE ", 6)) {
    Serial.print(F("BADGE "));
    Serial.println(cmd + 6);
  }
}

void lireSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (longueur) {
        ligne[longueur] = 0;
        traiter(ligne);
        longueur = 0;
      }
    } else if (longueur < sizeof(ligne) - 1) {
      ligne[longueur++] = c;
    }
  }
}

void echantillonner() {
  // Crete a crete du micro sur une fenetre courte : c'est le niveau sonore, pas la voix.
  int lo = 1023;
  int hi = 0;
  unsigned long fin = millis() + 40;
  while (millis() < fin) {
    int v = analogRead(MIC);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }

  Serial.print(F("SENSE "));
  Serial.print(hi - lo);
  Serial.print(' ');
  Serial.print(analogRead(MQ2));
  Serial.print(' ');
  Serial.print(tempX10);
  Serial.print(' ');
  Serial.println(humX10);
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  climat.begin();
  climat_reacteur.begin();
  Serial.println(F("READY simulation=wokwi"));
}

void loop() {
  lireSerie();

  unsigned long maintenant = millis();
  if (maintenant >= prochainDht) {
    prochainDht = maintenant + DHT_MS;
    float t = climat.readTemperature();
    float h = climat.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      tempX10 = (int)(t * 10);
      humX10 = (int)(h * 10);
    }
  }

  if (maintenant >= prochainSense) {
    prochainSense = maintenant + SENSE_MS;
    echantillonner();
  }
}
