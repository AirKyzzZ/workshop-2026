"""Génère le plan de câblage d'ATRIA en SVG.

Un générateur plutôt qu'un dessin à la main : la géométrie reste cohérente quand on
déplace une carte ou qu'on ajoute un capteur, et un diff reste lisible dans une pull
request. Lancer `python3 hardware/schema.py` régénère `hardware/montage-complet.svg`.
"""

import os

L, H = 1680, 1060

ENCRE = "#1D1B1B"
TEXTE = "#393838"
SOURDINE = "#6D6969"
FAIBLE = "#918D8D"
TRAIT = "#E4E2E2"
FOND = "#FFFFFF"

PCB_PI = "#1F6B4A"
PCB_ARDUINO = "#10618F"
PCB_ROUGE = "#B3311F"
PCB_BLEU = "#3B3F8F"
PCB_NOIR = "#2A2828"
CUIVRE = "#C9A227"
PLAQUE = "#F4F3F1"
RAIL_ROUGE = "#B3311F"
RAIL_BLEU = "#2F5DA8"

NOMINAL = "#1E7F58"
ATTENTION = "#9A6410"
CRITIQUE = "#B3311F"

PAS = 9.0


def _e(texte):
    return (str(texte).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class Dessin:
    def __init__(self):
        self.f = []

    def ajouter(self, balise):
        self.f.append(balise)

    # ---------- primitives ----------

    def rect(self, x, y, w, h, fill, stroke="none", r=3, sw=1, extra=""):
        self.ajouter(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
                     f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def texte(self, x, y, contenu, taille=12, fill=TEXTE, poids="400",
              ancre="start", police="Inter, Helvetica, Arial, sans-serif", espace="0"):
        self.ajouter(f'<text x="{x}" y="{y}" font-size="{taille}" fill="{fill}" '
                     f'font-weight="{poids}" text-anchor="{ancre}" font-family="{police}" '
                     f'letter-spacing="{espace}">{_e(contenu)}</text>')

    def mono(self, x, y, contenu, taille=11, fill=TEXTE, ancre="start"):
        self.texte(x, y, contenu, taille, fill, "400", ancre,
                   "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace")

    def etiquette(self, x, y, contenu, fill=FAIBLE):
        self.texte(x, y, contenu.upper(), 9.5, fill, "600", espace="1.3")

    def cercle(self, cx, cy, r, fill, stroke="none", sw=1):
        self.ajouter(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" '
                     f'stroke="{stroke}" stroke-width="{sw}"/>')

    def chemin(self, d, stroke, sw=2.2, fill="none", tirets=None, opacite=1):
        t = f' stroke-dasharray="{tirets}"' if tirets else ""
        self.ajouter(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
                     f'stroke-linecap="round" stroke-linejoin="round" '
                     f'opacity="{opacite}"{t}/>')

    # ---------- elements de montage ----------

    def broches(self, x, y, colonnes, rangees=1, pas=PAS, couleur=CUIVRE, r=2.1):
        for c in range(colonnes):
            for g in range(rangees):
                self.cercle(x + c * pas, y + g * pas, r, couleur)

    def carte(self, x, y, w, h, couleur, nom, reference=None):
        self.rect(x + 2, y + 3, w, h, "#00000018", r=6)
        self.rect(x, y, w, h, couleur, r=6)
        for dx, dy in ((10, 10), (w - 10, 10), (10, h - 10), (w - 10, h - 10)):
            self.cercle(x + dx, y + dy, 3.4, "#00000055")
        self.texte(x + 16, y + 26, nom, 13.5, "#FFFFFFDD", "700")
        if reference:
            self.texte(x + w - 16, y + 26, reference, 10, "#FFFFFF88", "400", "end")

    def plaque_essai(self, x, y, colonnes, nom=None):
        w = colonnes * PAS + 22
        h = 166
        self.rect(x, y, w, h, PLAQUE, TRAIT, r=4, sw=1.2)

        for i, (couleur, dy) in enumerate(((RAIL_ROUGE, 12), (RAIL_BLEU, 24),
                                           (RAIL_BLEU, h - 26), (RAIL_ROUGE, h - 14))):
            self.chemin(f"M {x + 10} {y + dy} H {x + w - 10}", couleur, 1.1, opacite=.55)

        for bande, base in ((0, 34), (1, 100)):
            for g in range(5):
                for c in range(colonnes):
                    self.cercle(x + 11 + c * PAS, y + base + g * PAS, 1.5, "#C9C6C6")
        self.chemin(f"M {x + 8} {y + 86} H {x + w - 8}", "#DCD9D9", 10)
        if nom:
            self.etiquette(x, y - 10, nom)
        return w, h

    def module(self, x, y, w, h, couleur, nom, broches_texte=None, etat=None):
        self.rect(x + 1.5, y + 2, w, h, "#00000014", r=4)
        self.rect(x, y, w, h, couleur, r=4)
        self.texte(x + 10, y + 19, nom, 11.5, "#FFFFFFDD", "700")
        if broches_texte:
            self.mono(x + 10, y + 36, broches_texte, 10, "#FFFFFFAA")
        if etat:
            couleur_etat = {"ok": NOMINAL, "attention": ATTENTION, "hs": CRITIQUE}[etat]
            self.cercle(x + w - 12, y + 13, 4.2, couleur_etat)
        return x, y, w, h

    def fil(self, points, couleur, sw=2.2, tirets=None):
        d = f"M {points[0][0]} {points[0][1]}"
        for px, py in points[1:]:
            d += f" L {px} {py}"
        self.chemin(d, couleur, sw, tirets=tirets)

    def rendre(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L} {H}" '
                f'width="{L}" height="{H}">\n'
                f'<rect width="{L}" height="{H}" fill="{FOND}"/>\n'
                + "\n".join(self.f) + "\n</svg>\n")


def construire():
    d = Dessin()

    d.texte(48, 56, "ATRIA", 30, ENCRE, "700", espace="1")
    d.texte(150, 56, "plan de câblage", 30, SOURDINE, "300")
    d.texte(48, 80, "Relevé sur la carte le 2026-09-22 par lsusb, /sys/kernel/debug/gpio, "
                    "vcgencmd et /dev/serial/by-id.", 12.5, SOURDINE)
    d.chemin(f"M 48 98 H {L - 48}", TRAIT, 1.4)

    # ---------- alimentation, a gauche du Pi ----------
    d.module(40, 212, 112, 64, PCB_NOIR, "Secteur", "5,1 V / 5 A")
    d.mono(40, 296, "5,109 V mesure", 9.5, SOURDINE)

    # ================= RASPBERRY PI =================
    px, py, pw, ph = 180, 140, 360, 252
    d.carte(px, py, pw, ph, PCB_PI, "Raspberry Pi 5 Model B", "Rev 1.1")

    d.rect(px + 20, py + 44, 190, 22, "#00000033", r=3)
    d.broches(px + 30, py + 50, 20, 2, couleur=CUIVRE, r=2.0)
    d.texte(px + 20, py + 82, "connecteur 40 broches", 9.5, "#FFFFFF99", "600", espace="1")

    d.rect(px + 20, py + 96, 250, 66, "#FFFFFF14", r=3)
    d.mono(px + 30, py + 116, "atria-api  atria-terminal", 9.5, "#FFFFFFCC")
    d.mono(px + 30, py + 134, "atria-llm  SQLite WAL", 9.5, "#FFFFFFCC")
    d.mono(px + 30, py + 152, "modeles embarques 1,1 Go", 9.5, "#FFFFFF88")

    d.rect(px - 8, py + 92, 16, 24, "#00000055", r=2)
    d.texte(px + 20, py + 186, "USB-C 5 V", 9, "#FFFFFF99", "600", espace="1")

    usb_y = (py + 60, py + 92, py + 124, py + 156)
    for y in usb_y:
        d.rect(px + pw - 12, y, 20, 24, "#00000055", r=2)
    d.texte(px + pw - 16, py + 206, "USB", 9.5, "#FFFFFF99", "600", espace="1", ancre="end")

    d.fil([(152, py + 104), (px - 8, py + 104)], RAIL_ROUGE, 2.8)

    # ---------- PiTFT ----------
    tx, ty, tw, th = 180, 452, 252, 162
    d.carte(tx, ty, tw, th, PCB_NOIR, "PiTFT 2,8\u2033", "ILI9340")
    d.rect(tx + 20, ty + 42, 212, 74, "#12305A", r=2)
    d.texte(tx + 32, ty + 72, "320 \u00d7 240", 15, "#7FA6D8", "700")
    d.mono(tx + 32, ty + 92, "/dev/fb0  RGB565", 9.5, "#5F86B8")
    for i in range(4):
        d.cercle(tx + 34 + i * 56, ty + 136, 6.5, "#4A4646", "#6D6969", 1.2)
    d.mono(tx + 20, ty + 152, "GPIO 17   22   23   27", 9, "#FFFFFF99")

    d.fil([(px + 60, py + ph), (px + 60, ty)], CUIVRE, 7)
    d.texte(px + 78, ty - 30, "nappe 40 broches", 10.5, SOURDINE)
    d.mono(px + 78, ty - 14, "SPI0 CS0 / CS1  ·  GPIO 25", 9.5, FAIBLE)

    # ---------- camera ----------
    cx, cy, cw, ch = 452, 452, 88, 162
    d.carte(cx, cy, cw, ch, PCB_NOIR, "C270", None)
    d.cercle(cx + 44, cy + 78, 25, "#1B1919", "#4A4646", 2)
    d.cercle(cx + 44, cy + 78, 15, "#0E2038")
    d.cercle(cx + 38, cy + 72, 4.5, "#7FA6D8", opacite=.6) if False else None
    d.cercle(cx + 74, cy + 22, 4.2, NOMINAL)
    d.mono(cx + 10, cy + 124, "video", 9, "#FFFFFFAA")
    d.mono(cx + 10, cy + 140, "micro", 9, "#FFFFFFAA")

    d.fil([(cx + cw, cy + 40), (562, cy + 40), (562, usb_y[3] + 12),
           (px + pw + 8, usb_y[3] + 12)], TEXTE, 2.2)

    # ================= MEGA ADK =================
    mx, my, mw, mh = 604, 140, 384, 252
    d.carte(mx, my, mw, mh, PCB_ARDUINO, "Arduino Mega ADK R3", "passerelle")
    d.rect(mx + 20, my + 44, 344, 18, "#00000033", r=2)
    d.broches(mx + 30, my + 53, 36, 1, couleur=CUIVRE, r=2.0)
    d.texte(mx + 20, my + 78, "numeriques  D53 \u2192 D22", 9, "#FFFFFF88")

    d.rect(mx + 20, my + mh - 56, 190, 18, "#00000033", r=2)
    d.broches(mx + 30, my + mh - 47, 19, 1, couleur=CUIVRE, r=2.0)
    d.texte(mx + 20, my + mh - 64, "analogiques  A0 \u2192 A15", 9, "#FFFFFF88")

    d.rect(mx - 10, my + 52, 18, 28, "#00000055", r=2)
    d.texte(mx + 20, my + 110, "USB-B  115200 bauds", 9.5, "#FFFFFF99", "600", espace="1")
    d.mono(mx + 20, my + 130, "adresse par /dev/serial/by-id", 9.5, "#FFFFFF77")
    d.mono(mx + 20, my + 150, "jamais par /dev/ttyACM0", 9.5, "#FFFFFF77")

    d.fil([(px + pw + 8, usb_y[0] + 12), (mx - 10, my + 66)], TEXTE, 2.2)

    # ================= PLAQUE D'ESSAI =================
    bx, by = 604, 452
    bw, bh = d.plaque_essai(bx, by, 36, "plaque d'essai")
    d.mono(bx, by + bh + 20, "rail haut 5 V", 10, RAIL_ROUGE)
    d.mono(bx + 118, by + bh + 20, "rail bas 3,3 V", 10, RAIL_BLEU)
    d.texte(bx + 240, by + bh + 20, "jamais 3,3 V et 5 V sur la même rangée",
            10.5, SOURDINE)

    d.fil([(mx + 40, my + mh - 38), (mx + 40, by + 12)], RAIL_ROUGE, 2.4)
    d.fil([(mx + 76, my + mh - 38), (mx + 76, by + bh - 14)], RAIL_BLEU, 2.4)

    # ================= CAPTEURS =================
    capteurs = (
        ("Capteur de son", "A0  ·  5 V", PCB_NOIR, "ok", CUIVRE),
        ("MQ-2 fumée et gaz", "A1  ·  5 V", PCB_BLEU, "attention", "#E8A33C"),
        ("DHT22 infirmerie", "A3  ·  5 V", "#5A5656", "ok", NOMINAL),
        ("RC522 NFC", "D53 D49 + SPI  ·  3,3 V", PCB_BLEU, "ok", "#8FB3E0"),
        ("AD8232 ECG", "A2 D10 D11  ·  3,3 V", PCB_ROUGE, "hs", CRITIQUE),
        ("Buzzer actif", "D6  ·  5 V", PCB_NOIR, "ok", "#D06BC8"),
    )
    sx, sy, sw, sh, pas_s = 1064, 140, 300, 62, 78
    d.etiquette(sx, sy - 14, "capteurs et modules")
    for i, (nom, broche, couleur, etat, fil_couleur) in enumerate(capteurs):
        y = sy + i * pas_s
        d.module(sx, y, sw, sh, couleur, nom, broche, etat=etat)
        voie = 1000 + i * 9
        d.fil([(sx, y + sh / 2), (voie, y + sh / 2), (voie, by + 30 + i * 21),
               (bx + bw, by + 30 + i * 21)], fil_couleur, 2)

    # ================= NOEUD =================
    nx, ny, nw, nh = 604, 716, 384, 214
    d.rect(nx - 16, ny - 40, nw + 32, nh + 62, "#FDF4E6", ATTENTION, r=7, sw=1.4,
           extra='stroke-dasharray="7 5"')
    d.etiquette(nx - 4, ny - 18, "à brancher", ATTENTION)
    d.carte(nx, ny, nw, nh, PCB_ARDUINO, "Mega 2560 + LCD1602", "nœud réacteur")
    d.rect(nx + 20, ny + 46, 216, 58, "#12305A", r=2)
    d.mono(nx + 32, ny + 70, "REACTEUR", 12.5, "#7FA6D8")
    d.mono(nx + 32, ny + 90, "34.0 C   22 %", 11, "#5F86B8")
    d.module(nx + 254, ny + 46, 110, 58, "#5A5656", "DHT22", "A0", etat="attention")
    d.mono(nx + 20, ny + 132, "A0   DHT22 reacteur", 10, "#FFFFFFBB")
    d.mono(nx + 20, ny + 152, "D8 D9 D4 D5 D6 D7   afficheur", 10, "#FFFFFFBB")
    d.mono(nx + 20, ny + 180, "AMBIANCE <comp> <temp> <hum>", 9.5, "#FFFFFF88")

    d.fil([(px + pw + 8, usb_y[2] + 12), (568, usb_y[2] + 12), (568, ny + 66),
           (nx, ny + 66)], ATTENTION, 2.4, tirets="7 5")

    # ================= RESERVE =================
    rx, ry = 150, 700
    d.rect(rx - 16, ry - 40, 360, 178, "#FDF4E6", ATTENTION, r=7, sw=1.4,
           extra='stroke-dasharray="7 5"')
    d.etiquette(rx - 4, ry - 18, "en réserve", ATTENTION)
    for i, (nom, detail) in enumerate((("NodeMCU V3", "ESP8266 · compartiment déporté"),
                                       ("Geekcreit ESP-12F", "ESP8266 · secours"),
                                       ("Support de piles 4\u00d7AA", "alimentation autonome"))):
        d.module(rx, ry + i * 46, 328, 36, PCB_NOIR, nom, detail)

    # ================= RESEAU =================
    d.module(1064, 716, 300, 62, "#1F5A44", "Navigateurs du bord",
             "HTTP + WebSocket :8000", etat="ok")
    d.fil([(px + pw + 8, usb_y[1] + 12), (580, usb_y[1] + 12), (580, 976),
           (1214, 976), (1214, 778)], NOMINAL, 2.2, tirets="3 5")
    d.texte(1000, 970, "Wi-Fi 2,4 GHz  ·  aucun accès hors du vaisseau",
            10.5, NOMINAL)

    # ================= LEGENDE =================
    d.chemin(f"M 48 1000 H {L - 48}", TRAIT, 1.4)
    for i, (couleur, libelle) in enumerate(((NOMINAL, "validé et en service"),
                                            (ATTENTION, "à câbler ou non testé"),
                                            (CRITIQUE, "hors service"))):
        d.cercle(56 + i * 210, 1030, 4.6, couleur)
        d.texte(70 + i * 210, 1034, libelle, 11, SOURDINE)
    d.texte(700, 1034, "Détail fil par fil et simulable : hardware/wokwi/", 11, FAIBLE)
    d.texte(L - 48, 1034, "python3 hardware/schema.py régénère ce fichier", 11, FAIBLE,
            ancre="end")

    return d.rendre()


if __name__ == "__main__":
    cible = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "montage-complet.svg")
    with open(cible, "w", encoding="utf-8") as f:
        f.write(construire())
    print(f"écrit : {cible}")
