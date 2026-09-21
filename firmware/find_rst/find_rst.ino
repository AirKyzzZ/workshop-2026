#include <SPI.h>

const uint8_t SS_PIN = 53;
const uint8_t VERSION_REG = 0x37;
const uint8_t CANDIDATES[] = {22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
                              36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49};

uint8_t readVersion() {
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(((VERSION_REG << 1) & 0x7E) | 0x80);
  uint8_t v = SPI.transfer(0x00);
  digitalWrite(SS_PIN, HIGH);
  return v;
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(300);

  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  for (uint8_t i = 0; i < sizeof(CANDIDATES); i++) {
    pinMode(CANDIDATES[i], OUTPUT);
    digitalWrite(CANDIDATES[i], HIGH);
  }
  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  delay(100);

  Serial.print(F("reference VERSION=0x"));
  Serial.println(readVersion(), HEX);

  Serial.println(F("--- recherche RST ---"));
  uint8_t found = 0;
  for (uint8_t i = 0; i < sizeof(CANDIDATES); i++) {
    uint8_t p = CANDIDATES[i];
    digitalWrite(p, LOW);
    delay(20);
    uint8_t v = readVersion();
    digitalWrite(p, HIGH);
    delay(20);
    if (v != 0x92) {
      Serial.print(F("RST = D"));
      Serial.print(p);
      Serial.print(F("  (VERSION devient 0x"));
      Serial.print(v, HEX);
      Serial.println(F(")"));
      found++;
    }
  }
  if (!found) Serial.println(F("RST non trouve -> probablement non connecte"));
  Serial.println(F("--- fin ---"));
}

void loop() {}
