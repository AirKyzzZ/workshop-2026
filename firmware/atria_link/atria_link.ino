#include <SPI.h>
#include <MFRC522.h>

const uint8_t SS_PIN = 53;
const uint8_t RST_PIN = 49;
const uint8_t BUZZER = 6;
const uint8_t MIC = A0;
const uint8_t MQ2 = A1;

const unsigned long SENSE_MS = 250;
const unsigned long BADGE_COOLDOWN_MS = 1500;

MFRC522 lecteur(SS_PIN, RST_PIN);

unsigned long prochainSense = 0;
unsigned long dernierBadge = 0;
String dernierUid = "";
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
    bip(1600, 60);
  } else {
    bip(1000, 80);
  }
}

void traiterCommande(char *cmd) {
  if (!strncmp(cmd, "BEEP ", 5)) {
    jouer(cmd + 5);
    Serial.println(F("ACK"));
  } else if (!strcmp(cmd, "PING")) {
    Serial.println(F("PONG"));
  }
}

void lireSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (longueur) {
        ligne[longueur] = 0;
        traiterCommande(ligne);
        longueur = 0;
      }
    } else if (longueur < sizeof(ligne) - 1) {
      ligne[longueur++] = c;
    }
  }
}

void lireBadge() {
  if (!lecteur.PICC_IsNewCardPresent() || !lecteur.PICC_ReadCardSerial()) return;

  String uid = "";
  for (uint8_t i = 0; i < lecteur.uid.size; i++) {
    if (lecteur.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(lecteur.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  unsigned long maintenant = millis();
  if (uid != dernierUid || maintenant - dernierBadge > BADGE_COOLDOWN_MS) {
    Serial.print(F("BADGE "));
    Serial.println(uid);
    dernierUid = uid;
    dernierBadge = maintenant;
  }
  lecteur.PICC_HaltA();
}

void lireCapteurs() {
  uint16_t lo = 1023, hi = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < 25) {
    uint16_t v = analogRead(MIC);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  Serial.print(F("SENSE "));
  Serial.print(hi - lo);
  Serial.print(' ');
  Serial.println(analogRead(MQ2));
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  SPI.begin();
  lecteur.PCD_Init();
  delay(50);
  Serial.print(F("READY rc522=0x"));
  Serial.println(lecteur.PCD_ReadRegister(MFRC522::VersionReg), HEX);
  jouer("OK");
}

void loop() {
  lireSerie();
  lireBadge();
  if (millis() >= prochainSense) {
    prochainSense = millis() + SENSE_MS;
    lireCapteurs();
  }
}
