const uint8_t PIN = A4;
const uint8_t MAX_EDGES = 90;

unsigned int widths[MAX_EDGES];
uint8_t levels[MAX_EDGES];

uint8_t capture() {
  pinMode(PIN, OUTPUT);
  digitalWrite(PIN, LOW);
  delay(2);
  pinMode(PIN, INPUT_PULLUP);

  uint8_t n = 0;
  uint8_t level = digitalRead(PIN);
  unsigned long last = micros();

  while (n < MAX_EDGES) {
    unsigned long start = micros();
    while (digitalRead(PIN) == level) {
      if (micros() - start > 1000) {
        return n;
      }
    }
    unsigned long now = micros();
    widths[n] = (unsigned int)(now - last);
    levels[n] = level;
    level = !level;
    last = now;
    n++;
  }
  return n;
}

bool decode(uint8_t n) {
  uint8_t bits[5] = {0, 0, 0, 0, 0};
  uint8_t bit = 0;

  for (uint8_t i = 0; i + 1 < n && bit < 40; i++) {
    if (levels[i] != LOW) continue;
    if (widths[i] < 30 || widths[i] > 90) continue;
    unsigned int high = widths[i + 1];
    if (high < 10 || high > 120) continue;
    bits[bit / 8] <<= 1;
    if (high > 45) bits[bit / 8] |= 1;
    bit++;
  }

  Serial.print(F("  bits decodes: "));
  Serial.println(bit);
  if (bit < 40) return false;

  uint8_t sum = bits[0] + bits[1] + bits[2] + bits[3];
  Serial.print(F("  octets: "));
  for (uint8_t i = 0; i < 5; i++) {
    Serial.print(bits[i], HEX);
    Serial.print(' ');
  }
  Serial.print(F("| checksum attendu "));
  Serial.print(sum, HEX);
  Serial.println(sum == bits[4] ? F("  -> VALIDE") : F("  -> invalide"));

  if (sum != bits[4]) return false;

  float hum = ((bits[0] << 8) | bits[1]) / 10.0;
  int16_t raw = ((bits[2] & 0x7F) << 8) | bits[3];
  float tmp = raw / 10.0;
  if (bits[2] & 0x80) tmp = -tmp;

  Serial.print(F("  >>> "));
  Serial.print(tmp, 1);
  Serial.print(F(" C, "));
  Serial.print(hum, 1);
  Serial.println(F(" % <<<"));
  return true;
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  delay(1500);
  Serial.println(F("=== lecture brute DHT22 sur A4, pull-up interne seul ==="));

  for (uint8_t essai = 0; essai < 4; essai++) {
    delay(2200);
    Serial.print(F("\nessai "));
    Serial.println(essai + 1);
    uint8_t n = capture();
    Serial.print(F("  fronts captures: "));
    Serial.println(n);

    if (n >= 4) {
      Serial.print(F("  reponse: low "));
      Serial.print(widths[1]);
      Serial.print(F("us, high "));
      Serial.print(widths[2]);
      Serial.println(F("us  (attendu ~80/~80)"));
    }
    if (n < 10) {
      Serial.println(F("  trop peu de fronts — le capteur ne repond pas"));
      continue;
    }
    if (decode(n)) break;
  }
  Serial.println(F("FIN"));
}

void loop() {}
