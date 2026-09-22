import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from . import theme

FB = "/dev/fb0"
MARK = os.path.join(os.path.dirname(__file__), "assets", "mark.png")

_fonts = {}
_mark = None


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def mark():
    global _mark
    if _mark is None and os.path.exists(MARK):
        _mark = Image.open(MARK).convert("RGBA")
    return _mark


class Screen:
    def __init__(self):
        self.img = Image.new("RGB", (theme.WIDTH, theme.HEIGHT), theme.BASE)
        self.d = ImageDraw.Draw(self.img)

    def clear(self):
        self.d.rectangle((0, 0, theme.WIDTH, theme.HEIGHT), fill=theme.BASE)

    def header(self, title, right=None):
        x = 10
        logo = mark()
        if logo is not None:
            self.img.paste(logo, (x, 3), logo)
            x += logo.width + 7

        self.d.text((x, -1), title.upper(), font=font(theme.DISPLAY, 24), fill=theme.INK)

        if right:
            f = font(theme.MONO, 9)
            w = self.d.textlength(right, font=f)
            self.d.text((theme.WIDTH - 10 - w, 9), right.upper(), font=f, fill=theme.MUTED)

        y = theme.HEADER_H
        self.d.line((0, y, theme.WIDTH, y), fill=theme.EDGE)

    def footer(self, hints):
        y = theme.HEIGHT - theme.FOOTER_H
        self.d.line((0, y, theme.WIDTH, y), fill=theme.EDGE)
        self.d.text((10, y + 5), hints, font=font(theme.SANS, 9), fill=theme.MUTED)

    def label_value(self, y, label, value, colour=None):
        self.d.text((12, y), label, font=font(theme.SANS, 11), fill=theme.MUTED)
        f = font(theme.MONO_BOLD, 11)
        w = self.d.textlength(value, font=f)
        self.d.text((theme.WIDTH - 12 - w, y), value, font=f, fill=colour or theme.INK)

    def row(self, y, text, value, colour, selected=False, bar=None):
        if selected:
            self.d.rectangle((4, y - 3, theme.WIDTH - 4, y + 15), fill=theme.PANEL)
            self.d.rectangle((4, y - 3, 6, y + 15), fill=colour)
        self.d.text((12, y), text, font=font(theme.SANS, 12), fill=theme.INK)
        if bar is not None:
            self.gauge(theme.WIDTH - 118, y + 4, 60, bar, colour)
        f = font(theme.MONO_BOLD, 11)
        w = self.d.textlength(value, font=f)
        self.d.text((theme.WIDTH - 12 - w, y + 1), value, font=f, fill=colour)

    def gauge(self, x, y, width, ratio, colour):
        ratio = max(0.0, min(1.0, ratio))
        self.d.rectangle((x, y, x + width, y + 6), fill=theme.EDGE)
        if ratio > 0:
            self.d.rectangle((x, y, x + int(width * ratio), y + 6), fill=colour)

    def banner(self, y, text, colour):
        self.d.rectangle((8, y, theme.WIDTH - 8, y + 30), outline=colour, width=2)
        f = font(theme.DISPLAY, 22)
        w = self.d.textlength(text.upper(), font=f)
        self.d.text(((theme.WIDTH - w) / 2, y + 3), text.upper(), font=f, fill=colour)

    def title(self, y, text, colour=None):
        self.d.text((12, y), text.upper(), font=font(theme.DISPLAY, 20), fill=colour or theme.INK)

    def paragraph(self, y, text, colour=None, size=11, max_width=296):
        f = font(theme.SANS, size)
        words, line, lines = text.split(), "", []
        for word in words:
            trial = f"{line} {word}".strip()
            if self.d.textlength(trial, font=f) > max_width and line:
                lines.append(line)
                line = word
            else:
                line = trial
        if line:
            lines.append(line)
        for i, ln in enumerate(lines[:8]):
            self.d.text((12, y + i * (size + 4)), ln, font=f, fill=colour or theme.INK)
        return y + len(lines[:8]) * (size + 4)

    def waveform(self, x, y, width, height, samples, colour):
        if len(samples) < 2:
            return
        lo, hi = min(samples), max(samples)
        span = max(hi - lo, 1)
        step = width / (len(samples) - 1)
        pts = [(x + i * step, y + height - (v - lo) / span * height) for i, v in enumerate(samples)]
        self.d.line(pts, fill=colour, width=1)

    def blit(self):
        arr = np.asarray(self.img, dtype=np.uint16)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        packed = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
        with open(FB, "wb", buffering=0) as fb:
            fb.write(packed.astype("<u2").tobytes())
