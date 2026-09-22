// Noeud de compartiment ATRIA.
//
// Une seconde carte, un seul compartiment. Elle mesure son atmosphere, l'affiche en
// local sur son ecran, et la remonte au Pi par USB. Elle ne sait rien de l'equipage et
// ne prend aucune decision : c'est une sonde qui parle.
//
// Protocole, une ligne par seconde :
//   READY noeud=<compartiment>
//   AMBIANCE <compartiment> <tempX10> <humX10>
// Le Pi peut repondre :
//   NOM <compartiment>   change le compartiment annonce
//   PING                 -> PONG

#include <DHT.h>
#include <LiquidCrystal.h>

const uint8_t DHT_PIN = A0;
const unsigned long MESURE_MS = 2000;
const unsigned long ANNONCE_MS = 1000;

// Cablage LCD 1602 en mode parallele, tel qu'il est monte sur le shield Elegoo.
LiquidCrystal ecran(8, 9, 4, 5, 6, 7);
DHT climat(DHT_PIN, DHT22);

char compartiment[16] = "reacteur";
unsigned long prochaineMesure = 0;
unsigned long prochaineAnnonce = 0;
int tempX10 = -9999;
int humX10 = -9999;
char ligne[24];
uint8_t longueur = 0;

void traiter(char *cmd) {
  if (!strncmp(cmd, "NOM ", 4)) {
    strncpy(compartiment, cmd + 4, sizeof(compartiment) - 1);
    compartiment[sizeof(compartiment) - 1] = 0;
    Serial.print(F("READY noeud="));
    Serial.println(compartiment);
  } else if (!strcmp(cmd, "PING")) {
    Serial.println(F("PONG"));
  }
}

void lireSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (longueur) {
        ligne[longueur] = 0;
        traiter(ligne);
        longueur = 0;
      }
    } else if (longueur < sizeof(ligne) - 1) {
      ligne[longueur++] = c;
    }
  }
}

void afficher() {
  ecran.setCursor(0, 0);
  for (uint8_t i = 0; i < 16; i++) {
    ecran.print(i < strlen(compartiment) ? (char)toupper(compartiment[i]) : ' ');
  }

  ecran.setCursor(0, 1);
  if (tempX10 == -9999) {
    ecran.print(F("sonde absente   "));
  } else {
    char tampon[17];
    snprintf(tampon, sizeof(tampon), "%d.%d C   %d %%   ",
             tempX10 / 10, abs(tempX10 % 10), humX10 / 10);
    tampon[16] = 0;
    ecran.print(tampon);
  }
}

void setup() {
  Serial.begin(115200);
  ecran.begin(16, 2);
  ecran.print(F("ATRIA"));
  climat.begin();
  Serial.print(F("READY noeud="));
  Serial.println(compartiment);
}

void loop() {
  lireSerie();
  unsigned long maintenant = millis();

  if (maintenant >= prochaineMesure) {
    prochaineMesure = maintenant + MESURE_MS;
    float t = climat.readTemperature();
    float h = climat.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      tempX10 = (int)(t * 10);
      humX10 = (int)(h * 10);
    }
    afficher();
  }

  if (maintenant >= prochaineAnnonce) {
    prochaineAnnonce = maintenant + ANNONCE_MS;
    Serial.print(F("AMBIANCE "));
    Serial.print(compartiment);
    Serial.print(' ');
    Serial.print(tempX10);
    Serial.print(' ');
    Serial.println(humX10);
  }
}
