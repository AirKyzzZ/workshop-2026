"""Test du micro : toux, cri, et mots qui coutent des points de conduite.

    ssh atria 'cd ~/atria && ./.venv/bin/python tester_micro.py'
"""
import json
import time
import urllib.request

BASE = "http://127.0.0.1:8000"
ETAPES = [
    ("TOUSSE deux ou trois fois", 18, ("toux",)),
    ("CRIE un bon coup", 15, ("cri",)),
    ("DIS un juron, par exemple : putain", 18, ("insulte",)),
    ("DIS une menace, par exemple : je vais te tuer", 18, ("menace",)),
]


def lire(chemin):
    return json.load(urllib.request.urlopen(BASE + chemin))


def incidents_recents(depuis):
    s = lire("/api/surveillance")
    return [i for i in s["incidents"] if i["ts"] > depuis and i["canal"] == "micro"]


def symptomes_recents(depuis):
    p = lire("/api/perception")
    return [x for x in p["symptomes"] if x["ts"] > depuis]


def conduite(nom):
    for c in lire("/api/surveillance")["conduites"]:
        if c["nom"] == nom:
            return c["conduite"]
    return None


print("=" * 62)
print("  TEST DU MICRO — mets-toi devant la camera pour l'attribution")
print("=" * 62)

for libelle, secondes, attendus in ETAPES:
    input(f"\n>>> {libelle}, puis Entree pour lancer {secondes}s d'ecoute...")
    depart = time.time()
    fin = time.time() + secondes
    classes = {}
    transcriptions = []
    while time.time() < fin:
        try:
            e = lire("/api/perception")["ecoute"]
        except Exception:
            time.sleep(0.5)
            continue
        for c in e["classes"]:
            classes[c["nom"]] = max(classes.get(c["nom"], 0), c["score"])
        t = e["transcription"]
        if t and t not in transcriptions:
            transcriptions.append(t)
        reste = int(fin - time.time())
        print(f"    ecoute... {reste:2d}s  |  {', '.join(c['nom'] for c in e['classes'][:3]):40s}",
              end="\r")
    print(" " * 78, end="\r")

    tri = sorted(classes.items(), key=lambda x: -x[1])[:5]
    print("  YAMNet a entendu :", ", ".join(f"{n} {s:.2f}" for n, s in tri))
    if transcriptions:
        print("  Vosk a transcrit  :", " | ".join(transcriptions))
    else:
        print("  Vosk a transcrit  : (rien)")

    trouves = incidents_recents(depart)
    sympt = symptomes_recents(depart)
    for i in trouves:
        print(f"  -> INCIDENT {i['type']} gravite {i['gravite']:.2f} "
              f"auteur {i['crew'] or 'non attribue'} · {i['detail']}")
    for x in sympt:
        print(f"  -> SYMPTOME {x['type']} dans {x['compartiment']} "
              f"(score {x['score']:.2f})")
    if not trouves and not sympt:
        print(f"  -> rien de retenu (attendu : {', '.join(attendus)})")

print("\n" + "=" * 62)
c = lire("/api/surveillance")["conduites"]
print("  Conduites apres le test :")
for x in c[:6]:
    print(f"    {x['nom']:12s} {x['conduite']:.3f}")
print("\n  Contagion tracee :")
for x in lire("/api/perception")["contagion"]:
    print(f"    {x['type']} dans {x['compartiment']} · foyer {x['foyer'] or 'vide'}")
print("=" * 62)
