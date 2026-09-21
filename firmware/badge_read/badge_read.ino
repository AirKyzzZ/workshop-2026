#include <SPI.h>
#include <MFRC522.h>

const uint8_t SS_PIN = 53;
const uint8_t HOLD_HIGH[] = {22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
                             36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49};

MFRC522 reader(SS_PIN, UINT8_MAX);

void setup() {
  Serial.begin(115200);
  while (!Serial) {}

  for (uint8_t i = 0; i < sizeof(HOLD_HIGH); i++) {
    pinMode(HOLD_HIGH[i], OUTPUT);
    digitalWrite(HOLD_HIGH[i], HIGH);
  }

  SPI.begin();
  reader.PCD_Init();
  delay(50);

  Serial.print(F("RC522 version 0x"));
  Serial.println(reader.PCD_ReadRegister(MFRC522::VersionReg), HEX);
  Serial.println(F("READY approche un badge"));
}

void loop() {
  if (!reader.PICC_IsNewCardPresent() || !reader.PICC_ReadCardSerial()) {
    delay(60);
    return;
  }

  Serial.print(F("BADGE "));
  for (uint8_t i = 0; i < reader.uid.size; i++) {
    if (reader.uid.uidByte[i] < 0x10) Serial.print('0');
    Serial.print(reader.uid.uidByte[i], HEX);
  }
  Serial.print(F(" type "));
  Serial.println(reader.PICC_GetTypeName(reader.PICC_GetType(reader.uid.sak)));

  reader.PICC_HaltA();
  delay(700);
}
