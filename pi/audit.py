import importlib
import os
import shutil
import subprocess
import sys


def sh(cmd, defaut="?"):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True,
                              timeout=15).stdout.strip() or defaut
    except Exception:
        return defaut


def titre(t):
    print(f"\n{'=' * 58}\n {t}\n{'=' * 58}")


def ligne(cle, valeur, verdict=None):
    marque = "" if verdict is None else ("  OK" if verdict else "  ECHEC")
    print(f"  {cle:<30} {valeur}{marque}")


titre("CALCULATEUR")
ligne("modele", sh("cat /proc/device-tree/model | tr -d '\\0'"))
ligne("os", sh(". /etc/os-release && echo $PRETTY_NAME"))
ligne("noyau", sh("uname -r"))
ligne("python", sys.version.split()[0])
ligne("temperature", sh("vcgencmd measure_temp | cut -d= -f2"))
throttled = sh("vcgencmd get_throttled | cut -d= -f2")
ligne("throttling", throttled, throttled == "0x0")
ligne("alimentation", sh("vcgencmd pmic_read_adc | grep EXT5V | awk '{print $3}' | cut -d= -f2"))
ligne("uptime", sh("uptime -p"))

titre("RESSOURCES")
ligne("ram", sh("free -h | awk 'NR==2{print $3\" / \"$2\" utilises\"}'"))
ligne("disque", sh("df -h / | awk 'NR==2{print $3\" / \"$2\" (\"$5\")\"}'"))
libre_go = float(sh("df -BG / | awk 'NR==2{print $4}' | tr -d G", "0"))
ligne("marge disque", f"{libre_go:.0f} Go libres", libre_go > 3)

titre("BUS ET PERIPHERIQUES")
for chemin, nom in (("/dev/i2c-1", "i2c-1"), ("/dev/spidev0.0", "spi0.0"),
                    ("/dev/fb0", "framebuffer"), ("/dev/ttyACM0", "mega (serie)")):
    ligne(nom, chemin, os.path.exists(chemin))
ligne("ecran", sh("cat /sys/class/graphics/fb0/virtual_size 2>/dev/null", "absent"))
ligne("tactile", sh("grep -ci stmpe /proc/bus/input/devices || echo 0") != "0" and "present" or "HS (connu)")
ligne("audio", sh("aplay -l 2>/dev/null | grep -c '^card'", "0") + " carte(s)")
ligne("usb", sh("lsusb | grep -vic 'root hub'", "0") + " peripherique(s)")

titre("BIBLIOTHEQUES PYTHON")
for module, role in (("numpy", "calcul"), ("scipy", "traitement du signal"),
                     ("xgboost", "modele de stress"), ("sklearn", "apprentissage"),
                     ("vosk", "reconnaissance vocale"), ("piper", "synthese vocale"),
                     ("serial", "liaison arduino"), ("PIL", "rendu ecran"),
                     ("lgpio", "gpio"), ("mfrc522", "badge"), ("fastapi", "api")):
    try:
        m = importlib.import_module(module)
        ligne(module, f"{getattr(m, '__version__', 'ok')}  ({role})", True)
    except Exception as exc:
        ligne(module, f"{type(exc).__name__}  ({role})", False)

titre("MODELES EMBARQUES")
for chemin, nom in (
    ("~/atria/models/piper/fr_FR-siwis-medium.onnx", "piper voix fr"),
    ("~/atria/models/vosk/vosk-model-small-fr-0.22", "vosk fr"),
    ("~/atria/models/stress", "classifieur de stress"),
):
    p = os.path.expanduser(chemin)
    existe = os.path.exists(p)
    taille = sh(f"du -sh {p} 2>/dev/null | cut -f1", "-") if existe else "absent"
    ligne(nom, taille, existe)

titre("POLICES DE LA CHARTE")
for f in ("Teko-SemiBold", "Inter-Regular", "MartianMono-Regular"):
    p = f"/usr/share/fonts/truetype/atria/{f}.ttf"
    ligne(f, "installee" if os.path.exists(p) else "absente", os.path.exists(p))

titre("BASE DE DONNEES")
try:
    sys.path.insert(0, os.path.expanduser("~/atria"))
    from atria import db
    conn = db.connexion()
    for table in ("crew", "poste", "compartiment", "capacite", "vitals",
                  "ambiance", "presence", "affectation", "journal"):
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        ligne(table, f"{n} lignes", n > 0)
    taille = sh("du -h ~/atria/data/atria.db | cut -f1", "?")
    ligne("taille fichier", taille)
except Exception as exc:
    ligne("base", f"{type(exc).__name__}: {exc}", False)

titre("SERVICES")
for service in ("atria-terminal",):
    etat = sh(f"systemctl is-active {service}", "inconnu")
    active = sh(f"systemctl is-enabled {service}", "?")
    ligne(service, f"{etat} (au demarrage: {active})", etat == "active")

titre("RESEAU")
ligne("adresse", sh("hostname -I | awk '{print $1}'"))
ligne("hostname", sh("hostname"))
ligne("internet", "joignable" if sh("ping -c1 -W2 1.1.1.1 >/dev/null 2>&1 && echo ok") == "ok"
      else "hors ligne")
ligne("wifi", sh("iwgetid -r", "non connecte"))

titre("OUTILS")
for outil in ("arduino-cli", "sqlite3", "fc-cache", "aplay"):
    chemin = shutil.which(outil) or os.path.expanduser(f"~/bin/{outil}")
    ligne(outil, chemin if os.path.exists(chemin) else "absent", os.path.exists(chemin))
