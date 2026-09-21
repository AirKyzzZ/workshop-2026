#include <SPI.h>

const uint8_t VERSION_REG = 0x37;
const uint8_t CANDIDATES[] = {22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
                              36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
                              53, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
const uint8_t N = sizeof(CANDIDATES);

uint8_t readVersion(uint8_t ss) {
  digitalWrite(ss, LOW);
  SPI.transfer(((VERSION_REG << 1) & 0x7E) | 0x80);
  uint8_t v = SPI.transfer(0x00);
  digitalWrite(ss, HIGH);
  return v;
}

bool known(uint8_t v) {
  return v == 0x88 || v == 0x90 || v == 0x91 || v == 0x92 || v == 0xB2;
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(300);

  for (uint8_t i = 0; i < N; i++) {
    pinMode(CANDIDATES[i], OUTPUT);
    digitalWrite(CANDIDATES[i], HIGH);
  }
  delay(100);

  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));

  Serial.println(F("--- scan SS ---"));
  uint8_t hits = 0;
  for (uint8_t i = 0; i < N; i++) {
    uint8_t ss = CANDIDATES[i];
    uint8_t v = readVersion(ss);
    if (known(v)) {
      Serial.print(F("TROUVE  SS=D"));
      Serial.print(ss);
      Serial.print(F("  VERSION=0x"));
      Serial.println(v, HEX);
      hits++;
    }
  }
  SPI.endTransaction();

  Serial.print(F("--- fin, "));
  Serial.print(hits);
  Serial.println(F(" resultat(s) ---"));
}

void loop() {}
