import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import threading

HOST = "0.0.0.0"
PORT = 9800


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
    header = json.loads(recv_exact(conn, hlen))
    (plen,) = struct.unpack(">I", recv_exact(conn, 4))
    payload = recv_exact(conn, plen) if plen else b""
    return header, payload


def do_play(payload):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(payload)
        path = f.name
    try:
        subprocess.run(["afplay", path], check=True)
        return {"ok": True, "bytes": len(payload)}
    except subprocess.CalledProcessError as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        os.unlink(path)


def do_record(seconds, rate):
    path = tempfile.mktemp(suffix=".wav")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "avfoundation", "-i", ":0",
        "-t", str(seconds), "-ar", str(rate), "-ac", "1",
        "-acodec", "pcm_s16le", path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        data = open(path, "rb").read()
        return {"ok": True, "bytes": len(data)}, data
    except subprocess.CalledProcessError as exc:
        return {"ok": False, "error": exc.stderr.decode()[:300]}, b""
    finally:
        if os.path.exists(path):
            os.unlink(path)


def handle(conn, addr):
    try:
        header, payload = recv_frame(conn)
        cmd = header.get("cmd")
        if cmd == "play":
            print(f"  [{addr[0]}] play {len(payload)} octets", flush=True)
            send_frame(conn, do_play(payload))
        elif cmd == "record":
            secs = float(header.get("seconds", 5))
            rate = int(header.get("rate", 16000))
            print(f"  [{addr[0]}] record {secs}s a {rate} Hz", flush=True)
            resp, data = do_record(secs, rate)
            send_frame(conn, resp, data)
        elif cmd == "ping":
            send_frame(conn, {"ok": True, "host": socket.gethostname()})
        else:
            send_frame(conn, {"ok": False, "error": f"commande inconnue: {cmd}"})
    except Exception as exc:
        print(f"  [{addr[0]}] erreur: {exc}", flush=True)
    finally:
        conn.close()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(8)
    print(f"ATRIA console bridge — ecoute sur {HOST}:{PORT}", flush=True)
    print("Ctrl-C pour arreter\n", flush=True)
    try:
        while True:
            conn, addr = srv.accept()
            threading.Thread(target=handle, args=(conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        print("\narret")
    finally:
        srv.close()


if __name__ == "__main__":
    sys.exit(main())
