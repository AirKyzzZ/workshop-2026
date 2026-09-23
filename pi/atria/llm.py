"""Mise en forme des réponses de la console par un modèle de langage local.

Le modèle ne choisit rien et ne décide rien. Il reçoit un relevé étiqueté produit par un
outil en lecture seule et le rend en français courant. Deux gardes filtrent sa sortie :
tout nombre absent du relevé la fait rejeter, et tout mot qui ressemble à un nom du relevé
sans en être un aussi. Rejetée, la réponse retombe sur le texte déterministe de l'outil.
"""

import json
import os
import re
import urllib.error
import urllib.request

ACTIF = os.environ.get("ATRIA_MODELE") == "1"
"""Le modele est desactive par defaut.

Qwen2.5-1.5B passe les gardes sur les nombres, les mots et la causalite, mais il continue
d'affirmer des choses que le releve contredit : sur « combustion: aucune » il a repondu
que la fumee pouvait etre presente. Sur une question de securite c'est disqualifiant, et
rattraper chaque cas par un garde de plus ne converge pas. Le service reste en place, la
chaine est complete et mesuree ; elle se rallume avec ATRIA_MODELE=1, et elle merite un
modele plus gros, ce qui suppose d'abord une alimentation qui tienne le 5 V."""

HOTE = "http://127.0.0.1:8080"
LEXIQUE = os.path.expanduser("~/atria/models/lexique/francais.txt")
DELAI_S = 20.0
MAX_JETONS = 160

CONSIGNE = """Tu es ATRIA, le système de bord d'un vaisseau interstellaire.

On te donne une question d'un membre d'équipage et un RELEVÉ, sous forme de champs
étiquetés lus par les capteurs et la base de bord. Réponds à la question en français
courant, à partir du relevé et de rien d'autre.

Règles absolues :
- Chaque nombre et chaque nom de ta réponse doit apparaître tel quel dans le relevé.
- N'ajoute aucun champ, aucune conclusion, aucune cause que le relevé ne donne pas.
- Si un champ vaut « non mesurée », dis que la mesure n'existe pas. Ne mets aucune autre
  valeur à la place : les dB sont un niveau sonore, jamais une température.
- Reprends tous les champs utiles à la question. Tu reformules, tu ne résumes pas.
- N'explique rien. Le relevé ne dit jamais pourquoi : n'écris ni « car », ni « parce
  que », ni « donc », et ne relie jamais deux champs entre eux.
- Tu ne décides rien : aucune affectation, aucun ordre, aucune recommandation médicale.
- Pas de formule de politesse, pas de question en retour."""

EXEMPLES = [
    ("Question : quelle température fait-il à l'atelier ?\n\n"
     "RELEVÉ :\n"
     "compartiment: atelier\n"
     "température: non mesurée, ce compartiment n'a pas de sonde\n"
     "humidité: non mesurée, ce compartiment n'a pas de sonde\n"
     "niveau sonore: 61 dB\n"
     "combustion: aucune\n"
     "occupants: rossi, silva",
     "L'atelier n'a pas de sonde d'atmosphère, sa température n'est donc pas mesurée. "
     "Le seul relevé disponible est le niveau sonore, à 61 dB."),
    ("Question : il fait chaud à l'infirmerie ?\n\n"
     "RELEVÉ :\n"
     "compartiment: infirmerie\n"
     "température: 27.3 °C\n"
     "humidité: 41 %\n"
     "niveau sonore: 38 dB\n"
     "combustion: aucune\n"
     "occupants: moreau, martin",
     "Il fait 27.3 °C à l'infirmerie, pour 41 % d'humidité et 38 dB. "
     "Moreau et martin y sont présents."),
]

_nombres = re.compile(r"\d+(?:[.,]\d+)?")
_causalite = re.compile(
    r"\b(car|parce que|puisque|donc|ainsi|c'est pourquoi|indique|signifie|explique"
    r"|en raison de|à cause de|grâce à|par conséquent|cela montre)\b")
_mots = re.compile(r"[a-zà-ÿ]{4,}", re.IGNORECASE)


def rendre(faits):
    return "\n".join(f"{cle}: {valeur}" for cle, valeur in faits.items())


def _normaliser(n):
    return n.replace(",", ".").rstrip("0").rstrip(".") or "0"


def chiffres_inventes(reponse, releve):
    connus = {_normaliser(n) for n in _nombres.findall(releve)}
    return [n for n in _nombres.findall(reponse) if _normaliser(n) not in connus]


_lexique = None


def lexique():
    """Liste de mots français de Debian, chargée au premier besoin."""
    global _lexique
    if _lexique is None:
        try:
            with open(LEXIQUE, encoding="utf-8", errors="ignore") as f:
                _lexique = frozenset(ligne.strip().lower() for ligne in f)
        except OSError:
            _lexique = frozenset()
    return _lexique


def causalite(reponse):
    """Connecteurs de cause absents de tout relevé.

    Un petit modèle relie volontiers deux champs sans rapport : « pas de fumée, car le
    niveau sonore est de 43 dB ». Ni les nombres ni les mots ne sont faux, seul le lien
    l'est, donc il faut le refuser sur la forme.
    """
    return _causalite.findall(reponse.lower())


def mots_inventes(reponse, releve):
    """Mots de la réponse qui ne sont ni dans le relevé ni dans le lexique français.

    C'est ainsi qu'un petit modèle rate un nom propre : « plusau » pour « moreau ». La
    déformation est trop éloignée pour une distance d'édition, mais elle n'est pas un mot.
    Sans lexique disponible, le garde se tait plutôt que de tout rejeter.
    """
    francais = lexique()
    if not francais:
        return []
    connus = {m.lower() for m in _mots.findall(releve)}
    return [m for m in _mots.findall(reponse)
            if m.lower() not in connus and m.lower() not in francais]


def disponible():
    try:
        with urllib.request.urlopen(f"{HOTE}/health", timeout=1.5) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


def reformuler(question, faits, interdits=()):
    """Rend la mise en forme, ou None si le modèle est éteint, absent, lent ou en défaut.

    `interdits` porte les noms d'équipage absents du relevé : les citer reviendrait à
    attribuer une mesure au mauvais membre.
    """
    from . import modules

    if not ACTIF or not modules.actif("modele"):
        return None
    releve = rendre(faits) if isinstance(faits, dict) else str(faits)

    messages = [{"role": "system", "content": CONSIGNE}]
    for demande, reponse in EXEMPLES:
        messages.append({"role": "user", "content": demande})
        messages.append({"role": "assistant", "content": reponse})
    messages.append({"role": "user",
                     "content": f"Question : {question}\n\nRELEVÉ :\n{releve}"})

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
    if not texte:
        return None
    bas = texte.lower()
    if (chiffres_inventes(texte, releve) or mots_inventes(texte, releve)
            or causalite(texte)):
        return None
    if any(re.search(rf"\b{re.escape(n)}\b", bas) for n in interdits):
        return None
    return texte


def prechauffer():
    """Fait passer la consigne et les exemples dans le cache de llama-server.

    Sans cela le premier appel de la démonstration traite tout le prompt et dépasse le
    délai, alors que les suivants répondent en cinq secondes.
    """
    reformuler("température", {"compartiment": "essai", "température": "20.0 °C"})
