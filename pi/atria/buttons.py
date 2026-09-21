import time

import lgpio

HAUT = 17
BAS = 22
VALIDER = 23
PARLER = 27
PINS = (HAUT, BAS, VALIDER, PARLER)
DEBOUNCE_S = 0.18


class Boutons:
    def __init__(self):
        self.chip = lgpio.gpiochip_open(0)
        self.dernier = {}
        for pin in PINS:
            lgpio.gpio_claim_input(self.chip, pin, lgpio.SET_PULL_UP)
            self.dernier[pin] = 1

    def lire(self):
        maintenant = time.monotonic()
        for pin in PINS:
            niveau = lgpio.gpio_read(self.chip, pin)
            precedent = self.dernier[pin]
            self.dernier[pin] = niveau
            if precedent == 1 and niveau == 0:
                self.dernier[pin] = 0
                time.sleep(DEBOUNCE_S)
                return pin
        return None

    def fermer(self):
        for pin in PINS:
            try:
                lgpio.gpio_free(self.chip, pin)
            except Exception:
                pass
        lgpio.gpiochip_close(self.chip)
