import time

import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522

reader = SimpleMFRC522()
seen = {}

print("Approche un badge du lecteur. Ctrl-C pour quitter.\n")
try:
    while True:
        uid, text = reader.read_no_block()
        if uid is None:
            time.sleep(0.15)
            continue
        first = uid not in seen
        seen[uid] = seen.get(uid, 0) + 1
        tag = "NOUVEAU" if first else f"deja vu x{seen[uid]}"
        print(f"UID {uid}  hex {uid:X}  [{tag}]  texte={text.strip()!r}")
        time.sleep(0.8)
except KeyboardInterrupt:
    print(f"\n{len(seen)} badge(s) distinct(s) : {sorted(seen)}")
finally:
    GPIO.cleanup()
