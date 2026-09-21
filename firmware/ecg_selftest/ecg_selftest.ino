const uint8_t ECG_PIN = A2;
const uint8_t LOW_CH = A0;
const uint8_t HIGH_CH = A1;
const uint8_t LO_MINUS = 10;
const uint8_t LO_PLUS = 11;
const unsigned long PERIOD_US = 4000;

unsigned long nextSample = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  pinMode(LO_MINUS, INPUT);
  pinMode(LO_PLUS, INPUT);
  Serial.println(F("SELFTEST2"));
  nextSample = micros();
}

void loop() {
  while ((long)(micros() - nextSample) < 0) {}
  nextSample += PERIOD_US;

  analogRead(LOW_CH);
  uint16_t afterLow = analogRead(ECG_PIN);
  uint16_t settled = analogRead(ECG_PIN);
  analogRead(HIGH_CH);
  uint16_t afterHigh = analogRead(ECG_PIN);

  Serial.print(afterLow);
  Serial.print(' ');
  Serial.print(settled);
  Serial.print(' ');
  Serial.print(afterHigh);
  Serial.print(' ');
  Serial.print(digitalRead(LO_MINUS));
  Serial.print(' ');
  Serial.println(digitalRead(LO_PLUS));
}
