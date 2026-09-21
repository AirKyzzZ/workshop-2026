BASE = (13, 20, 24)
PANEL = (20, 31, 36)
EDGE = (34, 48, 54)
INK = (220, 227, 224)
MUTED = (107, 123, 128)
VITAL = (63, 217, 138)
WATCH = (232, 178, 58)
CRITICAL = (240, 85, 63)
OFFLINE = (74, 90, 96)

PLEX = "/usr/share/fonts/truetype/ibm-plex"
DEJAVU = "/usr/share/fonts/truetype/dejavu"

SANS = f"{PLEX}/IBMPlexSans-Regular.ttf"
SANS_BOLD = f"{PLEX}/IBMPlexSans-Bold.ttf"
MONO = f"{PLEX}/IBMPlexMono-Regular.ttf"
MONO_BOLD = f"{PLEX}/IBMPlexMono-Bold.ttf"

WIDTH = 320
HEIGHT = 240
HEADER_H = 26
FOOTER_H = 20
ROW_H = 22


def capacity_colour(value):
    if value is None:
        return OFFLINE
    if value >= 0.70:
        return VITAL
    if value >= 0.45:
        return WATCH
    return CRITICAL
