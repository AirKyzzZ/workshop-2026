import argparse
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path

from generer import (APP, CHAINES, GRAINES, MODELES, TEXTE_ESSAI, TTS, attaque_parasite, chemin_brut, ecrire_json,
                     lire_json, normaliser, traiter)

WHISPER = "mlx-community/whisper-large-v3-turbo"
NOMS_ENTENDUS = {"melih": "meli"}


def mots(texte: str) -> list[str]:
    texte = normaliser(texte.replace("’", "'")).lower()
    return re.findall(r"[a-zàâäçéèêëîïôöùûüÿœæ]+", texte)


def cle_phonetique(mot: str) -> str:
    mot = unicodedata.normalize("NFD", NOMS_ENTENDUS.get(mot, mot)).encode("ascii", "ignore").decode()
    mot = re.sub(r"ent$", "", mot) if len(mot) > 4 else mot
    return re.sub(r"[sxte]+$", "", mot) or mot


def wer_tolerant(reference: list[str], hypothese: list[str]) -> float:
    return wer([cle_phonetique(m) for m in reference], [cle_phonetique(m) for m in hypothese])


def wer(reference: list[str], hypothese: list[str]) -> float:
    precedente = list(range(len(hypothese) + 1))
    for i, mot_ref in enumerate(reference, 1):
        courante = [i]
        for j, mot_hyp in enumerate(hypothese, 1):
            courante.append(min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + (mot_ref != mot_hyp)))
        precedente = courante
    return precedente[-1] / max(len(reference), 1)


def transcrire(fichier: Path, modele: str) -> str:
    import mlx_whisper

    resultat = mlx_whisper.transcribe(
        str(fichier), path_or_hf_repo=modele, language="fr", condition_on_previous_text=False
    )
    return resultat["text"].strip()


def relancer_dans_env() -> None:
    env = TTS / "whisper"
    if Path(sys.prefix).resolve() == env.resolve():
        return
    python = env / "bin" / "python"
    os.execv(python, [str(python), __file__, *sys.argv[1:]])


def choisir(modele: str, chaine: str, chemin_json: Path, ids: list[str], whisper: str) -> None:
    repliques = lire_json(chemin_json)
    graines = lire_json(GRAINES)
    for identifiant, replique in repliques.items():
        if ids and identifiant not in ids:
            continue
        motif = chemin_brut(modele, identifiant, normaliser(replique["texte"]), "*")
        prises = sorted(motif.parent.glob(motif.name), key=lambda f: int(f.stem.rsplit("-g", 1)[1]))
        if not prises:
            continue
        notes = []
        with tempfile.TemporaryDirectory() as dossier:
            for prise in prises:
                graine = int(prise.stem.rsplit("-g", 1)[1])
                attaque = attaque_parasite(prise)
                for debut, rang in ([(attaque, 1), (0.0, 2)] if attaque else [(0.0, 0)]):
                    traitee = Path(dossier) / f"{graine}-{debut}.wav"
                    traiter(prise, traitee, chaine, debut=debut)
                    transcription = transcrire(traitee, whisper)
                    taux = wer_tolerant(mots(replique["texte"]), mots(transcription))
                    notes.append((taux, rang, graine, debut, transcription))
        taux, _, graine, debut, transcription = min(notes)
        graines.setdefault(modele, {})[identifiant] = {"graine": graine, "debut": debut}
        ecrire_json(GRAINES, graines)
        detail = " ".join(f"g{g}{'✂' if d else ''}:{t:.0%}" for t, _, g, d, _ in notes)
        print(f"{identifiant}  graine {graine}  début {debut}s  {taux:5.1%}  ({detail})  {transcription}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcrit les voix avec Whisper et calcule le WER.")
    parser.add_argument("fichiers", nargs="*", type=Path, help="fichiers à comparer à la phrase d'essai")
    parser.add_argument("--json", type=Path, default=APP / "data" / "repliques.json")
    parser.add_argument("--public", type=Path, default=APP / "public")
    parser.add_argument("--seuil", type=float, default=0.05, help="sur le WER tolérant aux homophones")
    parser.add_argument("--choisir", choices=MODELES, help="garde la meilleure prise brute de chaque réplique")
    parser.add_argument("--chaine", choices=CHAINES, default="leger")
    parser.add_argument("--ids", nargs="*", default=[])
    args = parser.parse_args()

    relancer_dans_env()
    from huggingface_hub import snapshot_download

    whisper = snapshot_download(WHISPER, cache_dir=Path.home() / ".cache" / "huggingface" / "hub")
    if args.choisir:
        choisir(args.choisir, args.chaine, args.json, args.ids, whisper)
        return
    if args.fichiers:
        paires = [(f.name, TEXTE_ESSAI, f) for f in args.fichiers]
    else:
        repliques = lire_json(args.json)
        paires = [(i, r["texte"], args.public / r["fichier"]) for i, r in repliques.items() if r["genere"]]

    au_dessus = []
    print("strict  tolérant")
    for nom, texte, fichier in paires:
        transcription = transcrire(fichier, whisper)
        reference, hypothese = mots(texte), mots(transcription)
        taux = wer_tolerant(reference, hypothese)
        if taux > args.seuil:
            au_dessus.append(nom)
        print(f"{wer(reference, hypothese):6.1%}  {taux:6.1%}  {nom}  {transcription}")
    print(f"\n{len(paires) - len(au_dessus)}/{len(paires)} sous {args.seuil:.0%} de WER tolérant" +
          (f", à revoir : {' '.join(au_dessus)}" if au_dessus else ""))
    sys.exit(1 if au_dessus else 0)


if __name__ == "__main__":
    main()
