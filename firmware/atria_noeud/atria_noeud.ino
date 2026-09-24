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
//   NOM <compartiment>       change le compartiment annonce
//   ECRAN <haut>|<bas>       affiche un message, prioritaire sur la mesure
//   ECRAN                    efface le message et rend l'ecran a la mesure
//   POULS 1 | POULS 0        arme ou desarme la lecture du capteur de pouls
//   PING                     -> PONG
// Pouls arme, une ligne par battement :
//   BATTEMENT <ms depuis le precedent> <amplitude>

#include <DHT.h>
#include <LiquidCrystal.h>

const uint8_t DHT_PIN = A1;
const uint8_t POULS_PIN = A0;
const uint8_t RETRO = 10;
const unsigned long MESURE_MS = 2000;
const unsigned long ANNONCE_MS = 1000;

const int SONDE_REPOS_MIN = 1000;
/* Une ligne DATA de DHT22 au repos est tiree au niveau haut et lit pres de 1023.
   Nettement en dessous, c'est qu'un courant passe dans la ligne, VCC et DATA inverses par
   exemple. Piloter cette broche fait alors redemarrer la carte en boucle, donc on verifie
   avant de toucher au capteur plutot que de tomber dans la boucle. */

bool sonde_ok = false;

/* Detection de battements sur le capteur photoplethysmographique.

   La ligne de base derive avec la pression du doigt et la lumiere ambiante : un seuil fixe
   ne tient pas dix secondes. On suit donc une moyenne glissante et on declenche sur un
   depassement relatif, avec une periode refractaire qui borne la cadence a 200 battements
   par minute. Sans elle, le rebond dicrote du meme battement en compte un second. */
const unsigned long REFRACTAIRE_MS = 300;
const unsigned long POULS_PERIODE_MS = 20;
const int MARGE_BATTEMENT = 14;

bool pouls_arme = false;
float pouls_base = 0;
bool pouls_haut = false;
unsigned long pouls_dernier = 0;
unsigned long prochainPouls = 0;

// Cablage LCD 1602 en mode parallele, tel qu'il est monte sur le shield Elegoo.
LiquidCrystal ecran(8, 9, 4, 5, 6, 7);
DHT climat(DHT_PIN, DHT22);

char compartiment[16] = "reacteur";
char messageHaut[17] = "";
char messageBas[17] = "";
bool message = false;
unsigned long prochaineMesure = 0;
unsigned long prochaineAnnonce = 0;
int tempX10 = -9999;
int humX10 = -9999;
char ligne[48];
uint8_t longueur = 0;

void poserMessage(char *texte) {
  message = texte && *texte;
  messageHaut[0] = messageBas[0] = 0;
  if (!message) return;
  char *coupure = strchr(texte, '|');
  if (coupure) *coupure = 0;
  strncpy(messageHaut, texte, 16);
  messageHaut[16] = 0;
  if (coupure) {
    strncpy(messageBas, coupure + 1, 16);
    messageBas[16] = 0;
  }
}

void traiter(char *cmd) {
  if (!strncmp(cmd, "ECRAN", 5)) {
    poserMessage(cmd[5] == ' ' ? cmd + 6 : (char *)"");
    afficher();
    Serial.print(F("ECRAN "));
    Serial.println(message ? messageHaut : "-");
  } else if (!strncmp(cmd, "NOM ", 4)) {
    strncpy(compartiment, cmd + 4, sizeof(compartiment) - 1);
    compartiment[sizeof(compartiment) - 1] = 0;
    Serial.print(F("READY noeud="));
    Serial.println(compartiment);
  } else if (!strncmp(cmd, "POULS ", 6)) {
    pouls_arme = cmd[6] == '1';
    if (pouls_arme) {
      pouls_base = analogRead(POULS_PIN);
      pouls_haut = false;
      pouls_dernier = 0;
    }
    Serial.print(F("POULS "));
    Serial.println(pouls_arme ? F("arme") : F("desarme"));
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

void remplir(const char *texte, bool majuscules) {
  uint8_t n = strlen(texte);
  for (uint8_t i = 0; i < 16; i++) {
    char c = i < n ? texte[i] : ' ';
    ecran.print(majuscules ? (char)toupper(c) : c);
  }
}

void afficher() {
  if (message) {
    ecran.setCursor(0, 0);
    remplir(messageHaut, false);
    ecran.setCursor(0, 1);
    remplir(messageBas, false);
    return;
  }

  ecran.setCursor(0, 0);
  remplir(compartiment, true);

  ecran.setCursor(0, 1);
  if (!sonde_ok) {
    ecran.print(F("CABLAGE SONDE ! "));
  } else if (tempX10 == -9999) {
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

  // Retroeclairage du LCD : sans cette ligne l'ecran reste noir meme bien cable.
  pinMode(RETRO, OUTPUT);
  digitalWrite(RETRO, HIGH);

  pinMode(DHT_PIN, INPUT);
  delay(50);
  int repos = analogRead(DHT_PIN);
  sonde_ok = repos >= SONDE_REPOS_MIN;
  if (sonde_ok) climat.begin();

  Serial.print(F("READY noeud="));
  Serial.print(compartiment);
  Serial.print(F(" sonde="));
  Serial.print(sonde_ok ? F("ok") : F("CABLAGE"));
  Serial.print(F(" repos="));
  Serial.println(repos);
}

void lirePouls(unsigned long maintenant) {
  if (!pouls_arme || maintenant < prochainPouls) return;
  prochainPouls = maintenant + POULS_PERIODE_MS;

  int valeur = analogRead(POULS_PIN);
  pouls_base = pouls_base * 0.97 + valeur * 0.03;
  int ecart = valeur - (int)pouls_base;

  if (!pouls_haut && ecart > MARGE_BATTEMENT) {
    pouls_haut = true;
    if (pouls_dernier && maintenant - pouls_dernier >= REFRACTAIRE_MS) {
      Serial.print(F("BATTEMENT "));
      Serial.print(maintenant - pouls_dernier);
      Serial.print(' ');
      Serial.println(ecart);
      pouls_dernier = maintenant;
    } else if (!pouls_dernier) {
      pouls_dernier = maintenant;
    }
  } else if (pouls_haut && ecart < MARGE_BATTEMENT / 2) {
    pouls_haut = false;
  }
}

void loop() {
  lireSerie();
  unsigned long maintenant = millis();
  lirePouls(maintenant);

  if (maintenant >= prochaineMesure) {
    prochaineMesure = maintenant + MESURE_MS;
    if (sonde_ok) {
      float t = climat.readTemperature();
      float h = climat.readHumidity();
      if (!isnan(t) && !isnan(h)) {
        tempX10 = (int)(t * 10);
        humX10 = (int)(h * 10);
      }
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
