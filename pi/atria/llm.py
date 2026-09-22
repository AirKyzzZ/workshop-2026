"""Mise en forme des réponses de la console par un modèle de langage local.

Le modèle ne choisit rien et ne décide rien. Il reçoit le relevé produit par un outil
en lecture seule et le reformule en français. Tout chiffre de sa réponse est vérifié
contre le relevé : s'il en invente un, la réponse est jetée et le relevé brut est rendu.
"""

import json
import re
import urllib.error
import urllib.request

HOTE = "http://127.0.0.1:8080"
DELAI_S = 14.0
MAX_JETONS = 140

CONSIGNE = """Tu es ATRIA, le système de bord d'un vaisseau interstellaire.

On te donne une question d'un membre d'équipage et un RELEVÉ produit par un capteur ou
par la base de bord. Reformule le relevé pour répondre à la question, en français, en
deux phrases au maximum.

Règles absolues :
- N'invente aucun chiffre, aucun nom, aucun fait absent du relevé.
- Ne rattache jamais une valeur à une grandeur qu'elle ne mesure pas. Les dB sont un
  niveau sonore, les °C une température, les % une humidité. Ces unités ne se
  remplacent pas.
- Si le relevé dit qu'une mesure est inconnue, réponds qu'elle est inconnue et ne donne
  aucun autre chiffre à la place.
- Tu ne décides rien : aucune affectation, aucun ordre, aucune recommandation médicale.
- Pas de formule de politesse, pas de question en retour."""

EXEMPLES = [
    ("Question : quelle température fait-il à l'atelier ?\n\n"
     "RELEVÉ : atelier : 61 dB. Aucune sonde d'atmosphère ici, je ne connais ni sa "
     "température ni son humidité. Compartiments instrumentés : infirmerie. "
     "Occupants : rossi, silva.",
     "L'atelier n'a pas de sonde d'atmosphère, sa température n'est pas mesurée. "
     "Seule l'infirmerie est instrumentée."),
    ("Question : il fait chaud à l'infirmerie ?\n\n"
     "RELEVÉ : infirmerie : 27.3 °C, 41 % d'humidité, 38 dB. "
     "Occupants : moreau, martin.",
     "Il fait 27,3 °C à l'infirmerie, pour 41 % d'humidité. "
     "Moreau et martin y sont présents."),
]

_nombres = re.compile(r"\d+(?:[.,]\d+)?")


def _normaliser(n):
    return n.replace(",", ".").rstrip("0").rstrip(".") or "0"


def chiffres_inventes(reponse, releve):
    """Nombres présents dans la réponse mais absents du relevé."""
    connus = {_normaliser(n) for n in _nombres.findall(releve)}
    return [n for n in _nombres.findall(reponse) if _normaliser(n) not in connus]


def disponible():
    try:
        with urllib.request.urlopen(f"{HOTE}/health", timeout=1.5) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


def reformuler(question, releve):
    """Rend la reformulation, ou None si le modèle est absent, lent ou non fiable."""
    messages = [{"role": "system", "content": CONSIGNE}]
    for demande, reponse in EXEMPLES:
        messages.append({"role": "user", "content": demande})
        messages.append({"role": "assistant", "content": reponse})
    messages.append({"role": "user",
                     "content": f"Question : {question}\n\nRELEVÉ : {releve}"})

    charge = json.dumps({
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": MAX_JETONS,
        "stream": False,
    }).encode()

    requete = urllib.request.Request(
        f"{HOTE}/v1/chat/completions", data=charge,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=DELAI_S) as r:
            paquet = json.load(r)
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError):
        return None

    texte = (paquet.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    if not texte or chiffres_inventes(texte, releve):
        return None
    return texte
