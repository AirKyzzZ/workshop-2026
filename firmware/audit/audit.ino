#include <SPI.h>
#include <DHT.h>

const uint8_t DHT_PINS[] = {2, 3, 4, 5, 7, 8, 9, 12, 13, 22, 23, 24, 25, 26, 27, 28,
                            29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
                            43, 44, 45, 46, 47, 48, 54, 55, 56, 57, 58, 59, 60, 61,
                            62, 63, 64, 65, 66, 67, 68, 69};

const uint8_t SS_PIN = 53;
const uint8_t VERSION_REG = 0x37;

void analogique() {
  Serial.println(F("--- ENTREES ANALOGIQUES ---"));
  for (uint8_t i = 0; i < 16; i++) {
    uint16_t lo = 1023, hi = 0;
    unsigned long t0 = millis();
    while (millis() - t0 < 60) {
      uint16_t v = analogRead(A0 + i);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    uint16_t v = analogRead(A0 + i);
    Serial.print(F("A"));
    Serial.print(i);
    Serial.print(F(" val="));
    Serial.print(v);
    Serial.print(F(" pp="));
    Serial.println(hi - lo);
  }
}

void rc522() {
  Serial.println(F("--- RC522 ---"));
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  pinMode(49, OUTPUT);
  digitalWrite(49, HIGH);
  delay(50);
  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(((VERSION_REG << 1) & 0x7E) | 0x80);
  uint8_t v = SPI.transfer(0x00);
  digitalWrite(SS_PIN, HIGH);
  SPI.endTransaction();
  Serial.print(F("version=0x"));
  Serial.print(v, HEX);
  Serial.println(v == 0x91 || v == 0x92 ? F(" OK") : F(" HS"));
}

void dht() {
  Serial.println(F("--- SCAN DHT22 ---"));
  uint8_t trouves = 0;
  for (uint8_t i = 0; i < sizeof(DHT_PINS); i++) {
    uint8_t p = DHT_PINS[i];
    DHT capteur(p, DHT22);
    capteur.begin();
    delay(40);
    float h = capteur.readHumidity();
    float t = capteur.readTemperature();
    if (!isnan(h) && !isnan(t) && !(h == 0.0 && t == 0.0)) {
      Serial.print(F("trouve pin="));
      Serial.print(p);
      Serial.print(F(" temp="));
      Serial.print(t, 1);
      Serial.print(F(" hum="));
      Serial.println(h, 1);
      trouves++;
    }
  }
  Serial.print(F("total="));
  Serial.println(trouves);
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(1200);
  Serial.println(F("=== AUDIT MEGA ==="));
  analogique();
  rc522();
  dht();
  Serial.println(F("=== FIN ==="));
}

void loop() {}
