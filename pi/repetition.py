"""Répétition complète de la soutenance : les cinq temps forts, dans l'ordre, vérifiés.

    ssh -t atria 'cd ~/atria && ./.venv/bin/python repetition.py'

Le script attend une touche entre chaque temps fort. Il ne joue rien à ta place : il
vérifie que ce qui doit se passer s'est passé, et le dit si ce n'est pas le cas.
"""
import json
import subprocess
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8000"
VERT, ROUGE, JAUNE, GRIS, FIN = "\033[32m", "\033[31m", "\033[33m", "\033[90m", "\033[0m"


def lire(chemin):
    return json.load(urllib.request.urlopen(BASE + chemin, timeout=10))


def poste(chemin, corps):
    r = urllib.request.Request(BASE + chemin, data=json.dumps(corps).encode(),
                               headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=20))


def ok(texte):
    print(f"  {VERT}✓{FIN} {texte}")


def ko(texte):
    print(f"  {ROUGE}✗{FIN} {texte}")


def info(texte):
    print(f"  {GRIS}{texte}{FIN}")


def titre(n, texte):
    print(f"\n{JAUNE}━━━ {n}. {texte} ━━━{FIN}")


def attendre(consigne):
    input(f"\n  {JAUNE}▸{FIN} {consigne}\n    Entrée pour vérifier... ")


def temperature():
    s = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True).stdout
    return float(s.split("=")[1].split("'")[0])


def verifier_sante():
    titre(0, "ÉTAT DE LA CARTE")
    t = temperature()
    (ok if t < 70 else ko)(f"température {t:.1f} °C")

    th = subprocess.run(["vcgencmd", "get_throttled"], capture_output=True,
                        text=True).stdout.strip()
    (ok if th.endswith("0x0") else ko)(f"{th}")

    try:
        p = lire("/api/perception")
    except Exception as e:
        ko(f"API injoignable : {e}")
        sys.exit(1)
    c = p["camera"]
    (ok if c["actif"] and not c["erreur"] else ko)(
        f"caméra {c['chemin']} {'active' if c['actif'] else 'inactive'}")
    e = p["ecoute"] or {}
    (ok if e.get("actif") else ko)(
        f"micro {e.get('peripherique', '?')} · YAMNet {e.get('latence_ms', '?')} ms"
        f" · vosk {'chargé' if e.get('vosk') else 'absent'}")

    modeles = {m["nom"]: m for m in p["modules"]}
    for nom in ("surveillance", "ecoute", "transcription"):
        m = modeles.get(nom, {})
        etat = f"armé {m.get('reste_s', 0) // 60} min" if m.get("actif") else "non armé"
        info(f"module {nom:15s} {etat}")

    pred = lire("/api/prediction")
    (ok if pred["modele"] else ko)(
        "modèle de rupture chargé"
        + (f" · AUC {pred['modele']['mesures']['auc']}" if pred["modele"] else ""))


def temps_1_mise_en_scene():
    titre(1, "MISE EN SCÈNE")
    r = poste("/api/demo/preparer", {})
    ok(f"{r['places']} présences ouvertes, {sum(r['efface'].values())} traces effacées")
    for nom, gens in r["compartiments"].items():
        info(f"{nom:14s} {', '.join(gens) if gens else '(vide)'}")
    for nom in ("surveillance", "ecoute", "transcription"):
        poste("/api/modules", {"nom": nom, "actif": True, "minutes": 15})
    ok("trois modules armés pour 15 minutes")


def temps_2_badge():
    titre(2, "BADGE ET RECONNAISSANCE FACIALE")
    attendre("MELIH badge et présente son visage (il est enrôlé comme moreau)")
    s = lire("/api/session")
    (ok if s["acteur"] else ko)(f"session ouverte pour {s['acteur'] or 'personne'}")

    attendre("ALEXANDRE badge avec le badge de quelqu'un d'autre (il n'est pas enrôlé)")
    cam = lire("/api/camera/etat")
    v = cam.get("verification")
    if v:
        (ko if v["etat"] == "accorde" else ok)(f"verdict : {v['etat']} · {v['motif']}")
    else:
        info("aucune vérification en cours au moment du relevé")


def temps_3_geste():
    titre(3, "GESTE ET CONDUITE")
    avant = {c["nom"]: c["conduite"] for c in lire("/api/surveillance")["conduites"]}
    attendre("MELIH fait un doigt d'honneur devant la caméra, 15 secondes")
    apres = lire("/api/surveillance")
    o = (apres["surveillance"].get("observation") or {})
    info(f"vu : mains={o.get('mains')} gestes={o.get('gestes')} doigts={o.get('doigts')}")

    recents = [i for i in apres["incidents"] if time.time() - i["ts"] < 90
               and i["canal"] == "camera"]
    (ok if recents else ko)(f"{len(recents)} incidents caméra enregistrés")
    for i in recents[:4]:
        info(f"{i['type']} gravité {i['gravite']} auteur {i['crew'] or 'non attribué'}")

    for c in apres["conduites"][:4]:
        av = avant.get(c["nom"])
        fleche = f" (était {av:.2f})" if av is not None and abs(av - c["conduite"]) > 0.01 else ""
        info(f"conduite {c['nom']:12s} {c['conduite']:.3f}{fleche}")


def temps_4_refus():
    titre(4, "REFUS D'AFFECTATION")
    postes = [p for p in lire("/api/etat")["postes"] if p["criticite"] == "vital"]
    if not postes:
        ko("aucun poste vital au registre")
        return
    p = postes[0]
    info(f"tentative : moreau sur {p['nom']} (seuil {p['seuil']})")
    r = poste("/api/affectation", {"nom": "moreau", "poste": p["nom"]})
    (ok if not r.get("accepte") else ko)(f"{r.get('titre')} · {r.get('parole')}")


def temps_5_incendie():
    titre(5, "INCENDIE ET CONFINEMENT")
    info("la serre doit être occupée")
    poste("/api/surete/simulation", {"compartiment": "serre", "actif": True})
    time.sleep(7)
    s = lire("/api/surete")
    cas = next((c for c in s["feu"] if c["compartiment"] == "serre"), None)
    if not cas:
        ko("aucune combustion détectée dans la serre")
        return
    (ok if cas["decision"] == "evacuer" else ko)(
        f"décision : {cas['decision']} · {len(cas['occupants'])} occupants "
        f"({', '.join(cas['occupants'])})")
    info("ATRIA n'a pas scellé : elle ordonne l'évacuation")

    attendre("laisser ainsi, puis Entrée pour vider la serre et voir le scellement")
    import sqlite3
    conn = sqlite3.connect("/home/atria/atria/data/atria.db")
    conn.execute("UPDATE presence SET sortie = ? WHERE compartiment = 'serre'"
                 " AND sortie IS NULL", (time.time(),))
    conn.commit()
    conn.close()
    time.sleep(8)
    s = lire("/api/surete")
    cas = next((c for c in s["feu"] if c["compartiment"] == "serre"), None)
    (ok if cas and cas["decision"] == "sceller" else ko)(
        f"décision : {cas['decision'] if cas else 'aucune'}")

    poste("/api/surete/simulation", {"compartiment": "serre", "actif": False})
    time.sleep(7)
    ok("combustion levée, cloison rouverte")


def temps_6_social():
    titre(6, "GRAPHE SOCIAL ET PRÉDICTION")
    g = lire("/api/social")
    hostiles = [l for l in g["liens"] if l["nature"] == "hostile"]
    amicaux = [l for l in g["liens"] if l["nature"] == "amical"]
    ok(f"{len(g['noeuds'])} membres · {len(amicaux)} affinités · {len(hostiles)} hostilités")
    for l in hostiles[:3]:
        info(f"hostile {l['un']} / {l['deux']} lien {l['lien']} · {l['compartiment']}")
    isoles = [n["nom"] for n in g["noeuds"] if n["isolement"] >= 0.9]
    info(f"isolés : {', '.join(isoles) if isoles else 'aucun'}")

    p = lire("/api/prediction")
    if p["modele"]:
        m = p["modele"]["mesures"]
        ok(f"modèle : AUC {m['auc']} · rappel {m['rappel']} · {m['vrais_positifs']} "
           f"ruptures sur {m['vrais_positifs'] + m['faux_negatifs']}")
    risques = [r for r in p["risques"] if r["risque"] is not None]
    for r in risques[:3]:
        info(f"risque {r['crew']:12s} {r['risque']:.2f} ← "
             + ", ".join(f"{c['libelle']} {c['apport']:+.2f}"
                         for c in r["contributions"][:2]))

    b = lire("/api/briefing")
    ok(f"briefing : {len(b['constats'])} constats, rédigé par {b['source']}")


def main():
    print(f"{JAUNE}RÉPÉTITION ATRIA — les six vérifications de la soutenance{FIN}")
    verifier_sante()
    temps_1_mise_en_scene()
    temps_2_badge()
    temps_3_geste()
    temps_4_refus()
    temps_5_incendie()
    temps_6_social()

    t = temperature()
    print(f"\n{JAUNE}━━━ BILAN ━━━{FIN}")
    print(f"  température en fin de répétition : {t:.1f} °C")
    print(f"  {GRIS}pense à relancer la mise en scène juste avant de passer{FIN}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
