import os

NEUTRE_950 = (18, 17, 17)
NEUTRE_900 = (29, 27, 27)
NEUTRE_800 = (42, 40, 40)
NEUTRE_700 = (57, 56, 56)
NEUTRE_500 = (109, 105, 105)
NEUTRE_400 = (145, 141, 141)
NEUTRE_200 = (215, 213, 213)
NEUTRE_100 = (238, 237, 237)
NEUTRE_000 = (255, 255, 255)

BASE = NEUTRE_950
PANEL = NEUTRE_900
EDGE = NEUTRE_800
INK = NEUTRE_100
MUTED = NEUTRE_400

VITAL = (75, 214, 148)
WATCH = (232, 163, 60)
CRITICAL = (244, 112, 95)
OFFLINE = NEUTRE_500

_CANDIDATS = {
    "display": [
        "/usr/share/fonts/truetype/atria/Teko-SemiBold.ttf",
        "/usr/share/fonts/truetype/atria/Teko-Medium.ttf",
        "/usr/share/fonts/truetype/ibm-plex/IBMPlexSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "sans": [
        "/usr/share/fonts/truetype/atria/Inter-Regular.ttf",
        "/usr/share/fonts/truetype/ibm-plex/IBMPlexSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ],
    "sans_bold": [
        "/usr/share/fonts/truetype/atria/Inter-SemiBold.ttf",
        "/usr/share/fonts/truetype/ibm-plex/IBMPlexSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "mono": [
        "/usr/share/fonts/truetype/atria/MartianMono-Regular.ttf",
        "/usr/share/fonts/truetype/ibm-plex/IBMPlexMono-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ],
    "mono_bold": [
        "/usr/share/fonts/truetype/atria/MartianMono-SemiBold.ttf",
        "/usr/share/fonts/truetype/ibm-plex/IBMPlexMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    ],
}


def _resoudre(role):
    for chemin in _CANDIDATS[role]:
        if os.path.exists(chemin):
            return chemin
    raise FileNotFoundError(f"aucune police pour le role {role}")


DISPLAY = _resoudre("display")
SANS = _resoudre("sans")
SANS_BOLD = _resoudre("sans_bold")
MONO = _resoudre("mono")
MONO_BOLD = _resoudre("mono_bold")

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
