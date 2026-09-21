const uint8_t BUZZER = 6;

const int N_GS4 = 415, N_A4 = 440, N_B4 = 494, N_CS5 = 554, N_DS5 = 622, N_E5 = 659;

const int MELODY[] = {
  N_CS5, N_CS5, N_CS5, N_CS5, N_B4, N_CS5, N_CS5, N_CS5, N_CS5, N_B4,
  N_CS5, N_CS5, N_CS5, N_CS5, N_B4, N_A4,  N_B4,  N_CS5, N_B4,  N_A4, N_GS4,
  N_A4,  N_B4,  N_CS5, N_DS5, N_E5,  N_DS5, N_CS5, N_B4,  N_A4,  N_GS4
};
const int DIVISOR[] = {
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
  8, 8, 8, 8, 8, 4, 8, 8, 8, 8, 4,
  8, 8, 8, 8, 4, 8, 8, 8, 8, 2
};
const uint8_t COUNT = sizeof(MELODY) / sizeof(MELODY[0]);

void setup() {
  Serial.begin(115200);
  while (!Serial) {}
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);

  Serial.println(F("TEST 1 - melodie via tone() : un buzzer PASSIF joue l'air"));
  delay(500);
  for (uint8_t i = 0; i < COUNT; i++) {
    unsigned long ms = 1200UL / DIVISOR[i];
    tone(BUZZER, MELODY[i], ms * 9 / 10);
    delay(ms);
  }
  noTone(BUZZER);
  digitalWrite(BUZZER, LOW);

  delay(1200);
  Serial.println(F("TEST 2 - impulsions continues : un buzzer ACTIF emet 5 bips"));
  for (uint8_t i = 0; i < 5; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(180);
    digitalWrite(BUZZER, LOW);
    delay(220);
  }

  delay(1200);
  Serial.println(F("TEST 3 - alerte ATRIA : double bip rapide, 3 fois"));
  for (uint8_t i = 0; i < 3; i++) {
    for (uint8_t j = 0; j < 2; j++) {
      tone(BUZZER, 2000, 70);
      delay(110);
    }
    noTone(BUZZER);
    digitalWrite(BUZZER, LOW);
    delay(400);
  }
  noTone(BUZZER);
  digitalWrite(BUZZER, LOW);
  Serial.println(F("FIN"));
}

void loop() {}
