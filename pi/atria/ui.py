import numpy as np
from PIL import Image, ImageDraw, ImageFont

from . import theme

FB = "/dev/fb0"
_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


class Screen:
    def __init__(self):
        self.img = Image.new("RGB", (theme.WIDTH, theme.HEIGHT), theme.BASE)
        self.d = ImageDraw.Draw(self.img)

    def clear(self):
        self.d.rectangle((0, 0, theme.WIDTH, theme.HEIGHT), fill=theme.BASE)

    def header(self, title, right=None):
        self.d.text((10, 6), title, font=font(theme.SANS_BOLD, 14), fill=theme.INK)
        if right:
            f = font(theme.MONO, 10)
            w = self.d.textlength(right, font=f)
            self.d.text((theme.WIDTH - 10 - w, 10), right, font=f, fill=theme.MUTED)
        y = theme.HEADER_H
        self.d.line((0, y, theme.WIDTH, y), fill=theme.EDGE)

    def footer(self, hints):
        y = theme.HEIGHT - theme.FOOTER_H
        self.d.line((0, y, theme.WIDTH, y), fill=theme.EDGE)
        self.d.text((10, y + 4), hints, font=font(theme.SANS, 10), fill=theme.MUTED)

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
        f = font(theme.SANS_BOLD, 13)
        w = self.d.textlength(text, font=f)
        self.d.text(((theme.WIDTH - w) / 2, y + 7), text, font=f, fill=colour)

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
