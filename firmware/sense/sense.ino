const unsigned long WINDOW_MS = 100;

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  Serial.println(F("FAST boot"));
}

void loop() {
  uint16_t lo0 = 1023, hi0 = 0, lo1 = 1023, hi1 = 0;
  uint32_t sum0 = 0, sum1 = 0, n = 0;
  unsigned long t0 = millis();

  while (millis() - t0 < WINDOW_MS) {
    uint16_t v0 = analogRead(A0);
    uint16_t v1 = analogRead(A1);
    if (v0 < lo0) lo0 = v0;
    if (v0 > hi0) hi0 = v0;
    if (v1 < lo1) lo1 = v1;
    if (v1 > hi1) hi1 = v1;
    sum0 += v0;
    sum1 += v1;
    n++;
  }

  Serial.print(F("N "));  Serial.print(n);
  Serial.print(F(" A0 "));  Serial.print(sum0 / n);
  Serial.print(F(" pp ")); Serial.print(hi0 - lo0);
  Serial.print(F(" A1 "));  Serial.print(sum1 / n);
  Serial.print(F(" pp ")); Serial.println(hi1 - lo1);
}
