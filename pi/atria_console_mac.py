import hmac
import json
import os
import pathlib
import secrets
import socket
import struct
import subprocess
import sys
import tempfile
import threading

HOST = os.environ.get("ATRIA_CONSOLE_BIND", "0.0.0.0")
PORT = 9800
MAX_PAYLOAD = 16 * 1024 * 1024
MAX_HEADER = 4096
MAX_CLIENTS = 4
TOKEN_FILE = pathlib.Path.home() / ".atria_console_token"


def load_token():
    if not TOKEN_FILE.exists():
        TOKEN_FILE.write_text(secrets.token_urlsafe(32))
        TOKEN_FILE.chmod(0o600)
        print(f"jeton genere dans {TOKEN_FILE}", flush=True)
    return TOKEN_FILE.read_text().strip()


TOKEN = load_token()
slots = threading.Semaphore(MAX_CLIENTS)


def recv_exact(conn, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = conn.recv(min(65536, n - len(buf)))
        if not chunk:
            raise ConnectionError("connexion fermee")
        buf.extend(chunk)
    return bytes(buf)


def send_frame(conn, header, payload=b""):
    raw = json.dumps(header).encode()
    conn.sendall(struct.pack(">I", len(raw)) + raw)
    conn.sendall(struct.pack(">I", len(payload)))
    if payload:
        conn.sendall(payload)


def recv_frame(conn):
    (hlen,) = struct.unpack(">I", recv_exact(conn, 4))
    if hlen > MAX_HEADER:
        raise ValueError(f"en-tete trop grand: {hlen}")
    header = json.loads(recv_exact(conn, hlen))
    (plen,) = struct.unpack(">I", recv_exact(conn, 4))
    if plen > MAX_PAYLOAD:
        raise ValueError(f"charge utile trop grande: {plen}")
    return header, (recv_exact(conn, plen) if plen else b"")


def do_play(payload):
    fd, path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(payload)
        subprocess.run(["afplay", path], check=True)
        return {"ok": True, "bytes": len(payload)}
    except subprocess.CalledProcessError as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        os.unlink(path)


def do_record(seconds, rate):
    seconds = max(0.5, min(float(seconds), 30.0))
    rate = rate if rate in (8000, 16000, 22050, 44100, 48000) else 16000
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "avfoundation", "-i", ":0",
        "-t", str(seconds), "-ar", str(rate), "-ac", "1",
        "-acodec", "pcm_s16le", path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=seconds + 20)
        return {"ok": True, "bytes": os.path.getsize(path)}, open(path, "rb").read()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        detail = getattr(exc, "stderr", b"") or b""
        return {"ok": False, "error": detail.decode(errors="replace")[:300]}, b""
    finally:
        if os.path.exists(path):
            os.unlink(path)


def handle(conn, addr):
    try:
        conn.settimeout(60)
        header, payload = recv_frame(conn)

        if not hmac.compare_digest(str(header.get("token", "")), TOKEN):
            print(f"  [{addr[0]}] REFUSE — jeton invalide", flush=True)
            send_frame(conn, {"ok": False, "error": "jeton invalide"})
            return

        cmd = header.get("cmd")
        if cmd == "play":
            print(f"  [{addr[0]}] play {len(payload)} octets", flush=True)
            send_frame(conn, do_play(payload))
        elif cmd == "record":
            print(f"  [{addr[0]}] record {header.get('seconds', 5)}s", flush=True)
            resp, data = do_record(header.get("seconds", 5), int(header.get("rate", 16000)))
            send_frame(conn, resp, data)
        elif cmd == "ping":
            send_frame(conn, {"ok": True, "host": socket.gethostname()})
        else:
            send_frame(conn, {"ok": False, "error": f"commande inconnue: {cmd}"})
    except Exception as exc:
        print(f"  [{addr[0]}] erreur: {exc}", flush=True)
    finally:
        conn.close()
        slots.release()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(8)
    print(f"ATRIA console bridge — {HOST}:{PORT}, {MAX_CLIENTS} clients max", flush=True)
    print("Ctrl-C pour arreter\n", flush=True)
    try:
        while True:
            conn, addr = srv.accept()
            if not slots.acquire(blocking=False):
                conn.close()
                continue
            threading.Thread(target=handle, args=(conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        print("\narret")
    finally:
        srv.close()


if __name__ == "__main__":
    sys.exit(main())
