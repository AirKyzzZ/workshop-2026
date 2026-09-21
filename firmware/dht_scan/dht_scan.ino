#include <DHT.h>

const uint8_t PINS[] = {6, 10, 11, 49, 50, 51, 52, 53,
                        54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69};

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(1500);
  Serial.println(F("--- scan DHT22 ---"));

  uint8_t found = 0;
  for (uint8_t i = 0; i < sizeof(PINS); i++) {
    uint8_t p = PINS[i];
    DHT dht(p, DHT22);
    dht.begin();
    delay(60);
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      Serial.print(F("TROUVE  D"));
      Serial.print(p);
      Serial.print(F("  temp="));
      Serial.print(t, 1);
      Serial.print(F("C  humidite="));
      Serial.print(h, 1);
      Serial.println(F("%"));
      found++;
    }
  }

  if (!found) {
    Serial.println(F("--- aucun DHT22 detecte ---"));
    Serial.println(F("Verifie: VCC sur 5V, GND, DATA sur une broche numerique,"));
    Serial.println(F("et une resistance 10k entre VCC et DATA si le module est nu."));
  }
  Serial.println(F("FIN"));
}

void loop() {}
