#include <DHT.h>

const uint8_t PIN = A4;

void rawProbe(bool usePullup) {
  Serial.print(F("\n--- sonde brute, pull-up interne "));
  Serial.print(usePullup ? F("ACTIVE") : F("inactif"));
  Serial.println(F(" ---"));

  pinMode(PIN, usePullup ? INPUT_PULLUP : INPUT);
  delay(50);
  Serial.print(F("  etat au repos : "));
  Serial.println(digitalRead(PIN) ? F("HAUT (normal)") : F("BAS  (anormal: court-circuit ou pas d'alim)"));

  pinMode(PIN, OUTPUT);
  digitalWrite(PIN, LOW);
  delay(2);
  pinMode(PIN, usePullup ? INPUT_PULLUP : INPUT);

  unsigned long t0 = micros();
  while (digitalRead(PIN) == HIGH) {
    if (micros() - t0 > 500) {
      Serial.println(F("  AUCUNE reponse du capteur (la ligne reste haute)"));
      return;
    }
  }
  unsigned long tLow = micros();
  while (digitalRead(PIN) == LOW) {
    if (micros() - tLow > 500) {
      Serial.println(F("  la ligne reste BASSE — capteur bloque"));
      return;
    }
  }
  unsigned long tHigh = micros();
  while (digitalRead(PIN) == HIGH) {
    if (micros() - tHigh > 500) break;
  }

  Serial.print(F("  REPONSE : silence "));
  Serial.print(tLow - t0);
  Serial.print(F("us, low "));
  Serial.print(tHigh - tLow);
  Serial.print(F("us, high "));
  Serial.print(micros() - tHigh);
  Serial.println(F("us   (attendu ~80us / ~80us)"));
}

void libTest() {
  Serial.println(F("\n--- 5 tentatives avec la bibliotheque ---"));
  DHT dht(PIN, DHT22);
  dht.begin();
  for (uint8_t i = 0; i < 5; i++) {
    delay(2100);
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    Serial.print(F("  essai "));
    Serial.print(i + 1);
    if (isnan(h) || isnan(t)) {
      Serial.println(F(" : echec (NaN)"));
    } else {
      Serial.print(F(" : "));
      Serial.print(t, 1);
      Serial.print(F(" C, "));
      Serial.print(h, 1);
      Serial.println(F(" %"));
    }
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(1500);
  Serial.println(F("=== DIAGNOSTIC DHT22 sur A4 ==="));
  rawProbe(false);
  delay(2000);
  rawProbe(true);
  libTest();
  Serial.println(F("FIN"));
}

void loop() {}
