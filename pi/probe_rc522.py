import time

import lgpio
import spidev

VERSION_REG = 0x37
KNOWN = {0x88: "clone", 0x90: "v0.0", 0x91: "v1.0", 0x92: "v2.0", 0xB2: "clone FM17522"}

BCM_TO_PHYS = {4: 7, 17: 11, 27: 13, 22: 15, 18: 12, 23: 16, 24: 18, 25: 22, 5: 29, 6: 31, 12: 32, 13: 33, 16: 36, 26: 37}


def read_version(bus, device):
    spi = spidev.SpiDev()
    try:
        spi.open(bus, device)
        spi.max_speed_hz = 1_000_000
        spi.mode = 0
        addr = ((VERSION_REG << 1) & 0x7E) | 0x80
        resp = spi.xfer2([addr, 0x00])
        return resp[1]
    except Exception as exc:
        return f"ERR {exc}"
    finally:
        try:
            spi.close()
        except Exception:
            pass


print("=== sans toucher au RST ===")
for dev in (0, 1):
    v = read_version(0, dev)
    tag = KNOWN.get(v, "inconnu") if isinstance(v, int) else ""
    shown = f"0x{v:02X} ({tag})" if isinstance(v, int) else v
    print(f"  SPI0 CE{dev} (pin {24 if dev == 0 else 26}) -> VERSION = {shown}")

print("\n=== en forcant chaque GPIO candidat a l'etat haut (RST) ===")
chip = lgpio.gpiochip_open(0)
found = []
for bcm, phys in sorted(BCM_TO_PHYS.items()):
    try:
        lgpio.gpio_claim_output(chip, bcm, 0)
        lgpio.gpio_write(chip, bcm, 0)
        time.sleep(0.02)
        lgpio.gpio_write(chip, bcm, 1)
        time.sleep(0.08)
    except Exception:
        continue
    for dev in (0, 1):
        v = read_version(0, dev)
        if isinstance(v, int) and v in KNOWN:
            print(f"  >>> TROUVE  RST=BCM{bcm} (pin {phys})  CE{dev} (pin {24 if dev == 0 else 26})  VERSION=0x{v:02X} {KNOWN[v]}")
            found.append((bcm, phys, dev, v))
    try:
        lgpio.gpio_free(chip, bcm)
    except Exception:
        pass
lgpio.gpiochip_close(chip)

print()
if found:
    bcm, phys, dev, v = found[0]
    print(f"RESULTAT : RC522 detecte -> RST sur pin {phys} (BCM{bcm}), SS sur CE{dev}")
else:
    print("RESULTAT : aucun RC522 detecte sur SPI0.")
    print("Verifie MOSI=19, MISO=21, SCK=23, alimentation 3.3V et GND.")
