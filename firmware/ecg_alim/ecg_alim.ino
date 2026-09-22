const uint8_t ECG = A2;
const uint8_t RAIL_33 = A5;
const uint8_t LO_MINUS = 10;
const uint8_t LO_PLUS = 11;
const unsigned long PERIOD_US = 4000;

unsigned long nextSample = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  pinMode(LO_MINUS, INPUT);
  pinMode(LO_PLUS, INPUT);
  Serial.println(F("ECG+ALIM"));
  nextSample = micros();
}

void loop() {
  while ((long)(micros() - nextSample) < 0) {}
  nextSample += PERIOD_US;

  uint16_t ecg = analogRead(ECG);
  uint16_t rail = analogRead(RAIL_33);
  uint8_t off = (digitalRead(LO_MINUS) << 1) | digitalRead(LO_PLUS);

  Serial.print(ecg);
  Serial.print(' ');
  Serial.print(rail);
  Serial.print(' ');
  Serial.println(off);
}
