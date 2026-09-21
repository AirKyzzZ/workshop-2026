import re
import time

import serial

s = serial.Serial("/dev/ttyACM0", 115200, timeout=1)
time.sleep(2)
s.reset_input_buffer()

PATTERN = re.compile(r"N (\d+) A0 (\d+) pp (\d+) A1 (\d+) pp (\d+)")
peak0 = 0
base1 = None
print("Ctrl-C pour quitter\n")
print(f"{'MICRO A0':^46s} | {'MQ-2 A1':^30s}")

while True:
    line = s.readline().decode(errors="replace").strip()
    m = PATTERN.match(line)
    if not m:
        continue
    _, v0, p0, v1, p1 = map(int, m.groups())
    peak0 = max(peak0 * 0.97, p0)
    if base1 is None:
        base1 = v1
    delta1 = v1 - base1
    bar0 = "#" * min(int(p0 / 4), 40)
    bar1 = "+" * min(max(delta1, 0) // 4, 24) or "-" * min(max(-delta1, 0) // 4, 24)
    print(
        f"cc {p0:4d} pic {int(peak0):4d} {bar0:<40s} | {v1:4d} d{delta1:+5d} {bar1}",
        flush=True,
    )
