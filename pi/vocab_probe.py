import contextlib
import io
import json
import os
import re
import sys
import tempfile

from vosk import KaldiRecognizer, Model, SetLogLevel

MODEL_DIR = "models/vosk/vosk-model-small-fr-0.22"

CANDIDATES = {
    "reveil": ["atria", "atlas", "astra", "aria", "athena", "vigie", "sentinelle",
               "oracle", "centrale", "ordinateur", "systeme", "système", "bord", "commandant"],
    "noms": ["moreau", "bianchi", "reyes", "weber", "novak", "silva", "martin",
             "bernard", "dubois", "durand", "lefebvre", "mercier", "garcia", "rossi"],
    "postes": ["chirurgie", "propulsion", "serre", "navigation", "maintenance",
               "laboratoire", "infirmerie", "reacteur", "réacteur", "atelier", "pont", "vigie"],
    "verbes": ["etat", "état", "affecte", "affecter", "situation", "statut", "rapport",
               "alerte", "poste", "equipage", "équipage", "qui", "peut", "tenir",
               "montre", "donne", "liste", "urgence", "repos", "sommeil", "fatigue",
               "stress", "sante", "santé", "compartiment", "oxygene", "oxygène"],
}


def known(words):
    """Retourne les mots reconnus par le lexique du modele."""
    err = io.StringIO()
    fd = os.dup(2)
    tmp = tempfile.TemporaryFile()
    os.dup2(tmp.fileno(), 2)
    try:
        KaldiRecognizer(model, 16000, json.dumps(list(words) + ["[unk]"]))
    finally:
        os.dup2(fd, 2)
        os.close(fd)
        tmp.seek(0)
        err.write(tmp.read().decode(errors="replace"))
        tmp.close()
    missing = set(re.findall(r"Ignoring word missing in vocabulary: '([^']+)'", err.getvalue()))
    return [w for w in words if w not in missing], sorted(missing)


SetLogLevel(-1)
model = Model(MODEL_DIR)

for groupe, mots in CANDIDATES.items():
    ok, ko = known(mots)
    print(f"\n### {groupe.upper()}")
    print(f"  CONNUS  ({len(ok)}) : {', '.join(ok) if ok else '-'}")
    print(f"  ABSENTS ({len(ko)}) : {', '.join(ko) if ko else '-'}")
