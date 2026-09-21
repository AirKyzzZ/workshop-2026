import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 320, 240
FB = "/dev/fb0"
FONT_DIR = "/usr/share/fonts/truetype/dejavu"

BG = (8, 10, 14)
DIM = (96, 106, 120)
FG = (226, 232, 240)
ACCENT = (56, 189, 172)
ALERT = (239, 88, 88)


def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}", size)


def blit(img):
    arr = np.asarray(img.convert("RGB"), dtype=np.uint16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
    with open(FB, "wb", buffering=0) as fb:
        fb.write(rgb565.astype("<u2").tobytes())


def splash(status="SYSTEMES NOMINAUX", alert=False):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)

    d.text((16, 18), "ATRIA", font=font("DejaVuSans-Bold.ttf", 44), fill=FG)
    d.text((18, 70), "REGULATION D'EQUIPAGE", font=font("DejaVuSans.ttf", 12), fill=DIM)
    d.line((16, 92, WIDTH - 16, 92), fill=(34, 40, 50), width=1)

    rows = [
        ("EQUIPAGE ACTIF", "24 / 200"),
        ("COMPARTIMENTS", "3 surveilles"),
        ("LIEN TERRE", "AUCUN"),
    ]
    y = 106
    for label, value in rows:
        d.text((18, y), label, font=font("DejaVuSansMono.ttf", 11), fill=DIM)
        d.text((190, y), value, font=font("DejaVuSansMono-Bold.ttf", 11), fill=FG)
        y += 22

    colour = ALERT if alert else ACCENT
    d.rectangle((16, 190, WIDTH - 16, 222), outline=colour, width=2)
    f = font("DejaVuSans-Bold.ttf", 14)
    w = d.textlength(status, font=f)
    d.text(((WIDTH - w) / 2, 197), status, font=f, fill=colour)

    blit(img)


if __name__ == "__main__":
    import sys

    splash(sys.argv[1] if len(sys.argv) > 1 else "SYSTEMES NOMINAUX", "--alert" in sys.argv)
    print("affiche")
