"""Audit complet du bord : matériel, services, chaînes de mesure, routes du dashboard.

    ssh atria 'cd ~/atria && ./.venv/bin/python audit.py'

Chaque ligne est un constat vérifiable. Rien n'est réparé ici : on regarde.
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
VERT, ROUGE, JAUNE, GRIS, GRAS, FIN = (
    "\033[32m", "\033[31m", "\033[33m", "\033[90m", "\033[1m", "\033[0m")

bilan = {"ok": 0, "alerte": 0, "echec": 0}


def ok(t):
    bilan["ok"] += 1
    print(f"  {VERT}✓{FIN} {t}")


def alerte(t):
    bilan["alerte"] += 1
    print(f"  {JAUNE}!{FIN} {t}")


def echec(t):
    bilan["echec"] += 1
    print(f"  {ROUGE}✗{FIN} {t}")


def info(t):
    print(f"  {GRIS}{t}{FIN}")


def titre(t):
    print(f"\n{GRAS}{t}{FIN}")


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


def lire(chemin, delai=10):
    debut = time.time()
    with urllib.request.urlopen(BASE + chemin, timeout=delai) as r:
        return json.load(r), time.time() - debut


def materiel():
    titre("MATÉRIEL")
    th = sh("vcgencmd get_throttled")
    valeur = int(th.split("=")[1], 16) if "=" in th else -1
    if valeur == 0:
        ok(f"alimentation saine, {th}")
    elif valeur & 0xF:
        echec(f"bridage EN COURS, {th} — sous-tension ou surchauffe maintenant")
    else:
        alerte(f"{th} — un creux est survenu depuis le démarrage, sans effet actuel")

    t = float(sh("vcgencmd measure_temp").split("=")[1].split("'")[0])
    (ok if t < 75 else alerte if t < 80 else echec)(f"SoC à {t:.1f} °C")
    info(f"rail 5 V : {sh('vcgencmd pmic_read_adc EXT5V_V').split('=')[-1]}")
    info(f"uptime : {sh('uptime -p')}")

    usb = sh("lsusb")
    for nom, motif in (("Mega ADK (passerelle)", "2341:0044"),
                       ("Mega 2560 (nœud)", "2341:0042"),
                       ("caméra C270", "046d:0825"),
                       ("micro QuadCast", "HyperX")):
        (ok if motif in usb else echec)(f"{nom} {'présent' if motif in usb else 'ABSENT'}")

    ports = sh("ls -1 /dev/serial/by-id/ 2>/dev/null").splitlines()
    (ok if len(ports) >= 2 else echec)(f"{len(ports)} ports série sur 2 attendus")
    video = sh("ls -1 /dev/v4l/by-id/ 2>/dev/null").splitlines()
    (ok if video else echec)(f"{len(video)} périphériques vidéo")


def services():
    titre("SERVICES")
    for s in ("atria-api", "atria-terminal", "atria-llm"):
        etat = sh(f"systemctl is-active {s}")
        (ok if etat == "active" else echec)(f"{s} : {etat}")
    libre = sh("free -m | awk 'NR==2 {print $7}'")
    (ok if int(libre) > 400 else alerte)(f"{libre} Mo de mémoire disponible")


def capteurs():
    titre("CHAÎNES DE MESURE")
    sys.path.insert(0, os.path.expanduser("~/atria"))
    from atria import db
    conn = db.connexion()
    maintenant = time.time()

    for comp in ("infirmerie", "réacteur"):
        r = conn.execute(
            "SELECT ts, temp_c, humidite FROM ambiance WHERE compartiment = ?"
            " AND temp_c IS NOT NULL ORDER BY ts DESC LIMIT 1", (comp,)).fetchone()
        if r is None:
            echec(f"{comp} : aucune mesure d'atmosphère")
        else:
            age = maintenant - r["ts"]
            (ok if age < 120 else alerte)(
                f"{comp} : {r['temp_c']} °C, {r['humidite']} % il y a {age:.0f} s")

    e = db.ecrans(conn).get("réacteur")
    if e and e["applique"]:
        ok(f"écran du nœud acquitté il y a {maintenant - e['applique']:.0f} s")
    elif e:
        alerte("consigne d'écran posée mais jamais acquittée")
    else:
        info("aucune consigne d'écran en cours")

    enroles = db.membres_enroles(conn)
    (ok if enroles else echec)(
        "gabarits faciaux : " + (", ".join(f"{n} ({g})" for n, g in enroles) or "aucun"))

    badges = conn.execute(
        "SELECT COUNT(*) n FROM crew WHERE badge IS NOT NULL").fetchone()["n"]
    (ok if badges >= 2 else alerte)(f"{badges} badges enregistrés")

    j = conn.execute(
        "SELECT ts, motif FROM journal WHERE type = 'identification'"
        " ORDER BY ts DESC LIMIT 1").fetchone()
    if j:
        info(f"dernière identification il y a {(maintenant - j['ts']) / 60:.0f} min : "
             f"{j['motif'][:60]}")


def routes():
    titre("ROUTES DU DASHBOARD")
    attendus = {
        "/api/etat": ("equipage", "compartiments", "confinements"),
        "/api/social": ("noeuds", "liens", "conflits"),
        "/api/surete": ("feu", "menaces", "dossiers"),
        "/api/perception": ("camera", "ecoute", "modules"),
        "/api/prediction": ("modele", "risques", "anomalies"),
        "/api/briefing": ("constats", "texte"),
        "/api/pouls": ("actif", "duree_s"),
        "/api/ecoute": ("ecoute", "modules", "incidents"),
        "/api/modules": ("modules",),
        "/api/surveillance": ("incidents", "conduites"),
        "/api/journal": ("entrees",),
        "/api/camera/etat": ("actif", "surveillance"),
        "/api/session": ("acteur", "capitaine"),
    }
    for chemin, cles in attendus.items():
        try:
            d, duree = lire(chemin)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            echec(f"{chemin} : {type(exc).__name__}")
            continue
        manquantes = [c for c in cles if c not in d]
        if manquantes:
            echec(f"{chemin} : clés absentes {manquantes}")
        elif duree > 2.0:
            alerte(f"{chemin} : {duree:.2f} s, lent")
        else:
            ok(f"{chemin} : {duree * 1000:.0f} ms")

    try:
        with urllib.request.urlopen(BASE + "/api/camera/image", timeout=10) as r:
            taille = len(r.read())
        (ok if taille > 3000 else echec)(f"/api/camera/image : {taille} octets")
    except Exception as exc:
        echec(f"/api/camera/image : {exc}")


def fonctions():
    titre("FONCTIONS")
    d, _ = lire("/api/camera/etat")
    s = d["surveillance"]
    (ok if s["arme"] else echec)("module surveillance armé")
    (ok if s["modeles"] else echec)("modèles MediaPipe présents")
    if s["en_pause"]:
        alerte(f"surveillance suspendue : {s['motif_pause']}")
    elif s["vu_il_y_a"] is not None and s["vu_il_y_a"] < 5:
        ok(f"analyse comportementale active, vue il y a {s['vu_il_y_a']} s")
    else:
        alerte("analyse comportementale jamais exécutée depuis le démarrage")
    (ok if d["age"] is not None and d["age"] < 5 else echec)(
        f"image caméra fraîche ({d['age']} s)")

    p, _ = lire("/api/prediction")
    if p["modele"]:
        m = p["modele"]["mesures"]
        ok(f"modèle entraîné : AUC {m['auc']}, rappel {m['rappel']}, "
           f"{p['modele']['lignes']} exemples")
        (ok if p["risques"] else alerte)(f"{len(p['risques'])} membres évalués")
    else:
        echec("aucun modèle de prédiction sur la carte")

    g, _ = lire("/api/social")
    hostiles = [x for x in g["liens"] if x["nature"] == "hostile"]
    amicaux = [x for x in g["liens"] if x["nature"] == "amical"]
    (ok if g["noeuds"] else echec)(
        f"graphe social : {len(g['noeuds'])} membres, {len(amicaux)} affinités, "
        f"{len(hostiles)} hostilités")

    e, _ = lire("/api/ecoute")
    ec = e["ecoute"]
    (ok if ec.get("modele") else echec)("modèle YAMNet présent")
    (ok if ec.get("vosk") else alerte)("transcription Vosk chargée")
    info("écoute et transcription : " + ", ".join(
        f"{m['nom']}={'armé' if m['actif'] else 'au repos'}" for m in e["modules"]))

    b, _ = lire("/api/briefing")
    (ok if len(b["constats"]) >= 4 else alerte)(
        f"briefing : {len(b['constats'])} constats, rédigé par {b['source']}")
    if b.get("rejet"):
        info(f"reformulation refusée : {b['rejet']}")

    etat, _ = lire("/api/etat")
    occupes = [c["nom"] for c in etat["compartiments"] if c["occupants"]]
    (ok if len(occupes) >= 3 else alerte)(
        f"{len(occupes)} compartiments occupés : {', '.join(occupes)}")
    instrumentes = [c["nom"] for c in etat["compartiments"] if c["instrumente"]]
    (ok if len(instrumentes) >= 2 else alerte)(
        f"{len(instrumentes)} compartiments instrumentés : {', '.join(instrumentes)}")
    if etat["confinements"]:
        alerte(f"confinements actifs : {list(etat['confinements'])}")
    else:
        ok("aucun confinement en cours")


def main():
    print(f"{GRAS}AUDIT ATRIA — {time.strftime('%d/%m %H:%M:%S')}{FIN}")
    for etape in (materiel, services, capteurs, routes, fonctions):
        try:
            etape()
        except Exception as exc:
            echec(f"{etape.__name__} interrompu : {type(exc).__name__}: {exc}")

    print(f"\n{GRAS}BILAN{FIN}  "
          f"{VERT}{bilan['ok']} ok{FIN}  "
          f"{JAUNE}{bilan['alerte']} à surveiller{FIN}  "
          f"{ROUGE}{bilan['echec']} en échec{FIN}\n")
    return 1 if bilan["echec"] else 0


if __name__ == "__main__":
    sys.exit(main())
