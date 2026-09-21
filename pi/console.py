import json
import os
import socket
import struct
import subprocess
import tempfile

CONSOLE_HOST = os.environ.get("ATRIA_CONSOLE", "192.168.50.150")
CONSOLE_PORT = 9800
PIPER_MODEL = os.path.expanduser("~/atria/models/piper/fr_FR-siwis-medium.onnx")
PIPER_PYTHON = os.path.expanduser("~/atria/.venv/bin/python")


def _recv_exact(sock, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(min(65536, n - len(buf)))
        if not chunk:
            raise ConnectionError("console fermee")
        buf.extend(chunk)
    return bytes(buf)


def _request(header, payload=b"", timeout=60):
    with socket.create_connection((CONSOLE_HOST, CONSOLE_PORT), timeout=timeout) as s:
        raw = json.dumps(header).encode()
        s.sendall(struct.pack(">I", len(raw)) + raw)
        s.sendall(struct.pack(">I", len(payload)))
        if payload:
            s.sendall(payload)
        (hlen,) = struct.unpack(">I", _recv_exact(s, 4))
        resp = json.loads(_recv_exact(s, hlen))
        (plen,) = struct.unpack(">I", _recv_exact(s, 4))
        data = _recv_exact(s, plen) if plen else b""
    return resp, data


def ping():
    return _request({"cmd": "ping"}, timeout=5)[0]


def synth(text):
    path = tempfile.mktemp(suffix=".wav")
    subprocess.run(
        [PIPER_PYTHON, "-m", "piper", "-m", PIPER_MODEL, "-f", path],
        input=text.encode(), check=True, capture_output=True,
    )
    data = open(path, "rb").read()
    os.unlink(path)
    return data


def say(text):
    return _request({"cmd": "play"}, synth(text))[0]


def listen(seconds=5, rate=16000):
    resp, data = _request({"cmd": "record", "seconds": seconds, "rate": rate}, timeout=seconds + 30)
    if not resp.get("ok"):
        raise RuntimeError(resp.get("error", "echec enregistrement"))
    return data
