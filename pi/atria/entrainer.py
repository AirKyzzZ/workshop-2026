"""Entraîne le modèle de rupture d'aptitude et affiche ses métriques.

    python -m atria.entrainer
"""

import sys

from . import apprentissage, db


def main():
    conn = db.connexion()
    modele = apprentissage.valider(conn)
    if modele is None:
        print("pas assez de données pour entraîner")
        return 1

    m = modele["mesures"]
    print(f"{modele['lignes']} exemples, {modele['ruptures']} ruptures "
          f"({modele['ruptures'] / modele['lignes']:.1%})")
    print(f"validation croisée en {m['plis']} plis, groupée par membre "
          f"({m['membres']} membres)")
    print(f"évalué sur {m['lignes_evaluees']} lignes dont "
          f"{m['ruptures_evaluees']} ruptures, chacune prédite par un modèle "
          f"qui n'avait jamais vu ce membre\n")

    print(f"  AUC        {m['auc']}")
    print(f"  précision  {m['precision']}")
    print(f"  rappel     {m['rappel']}")
    print(f"  exactitude {m['exactitude']}\n")

    print("  matrice de confusion")
    print(f"                    prédit rupture   prédit tenue")
    print(f"    rupture réelle       {m['vrais_positifs']:6.0f}         {m['faux_negatifs']:6.0f}")
    print(f"    tenue réelle         {m['faux_positifs']:6.0f}         {m['vrais_negatifs']:6.0f}\n")

    print("  poids appris")
    for nom, libelle, poids in zip(modele["variables"], modele["libelles"],
                                   modele["theta"]):
        print(f"    {libelle:26s} {poids:+.3f}")

    print("\n  ce que chaque variable ajoute")
    ablation = apprentissage.ablation(conn)
    if ablation:
        print(f"    {'jeu':20s} {'vars':>5s} {'AUC':>6s} {'rappel':>7s} {'précision':>10s}")
        for a in ablation:
            print(f"    {a['jeu']:20s} {a['variables']:5d} {str(a['auc']):>6s} "
                  f"{str(a['rappel']):>7s} {str(a['precision']):>10s}")
        modele["ablation"] = ablation

    apprentissage.sauver(modele)
    print(f"\nmodèle écrit dans {apprentissage.MODELE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
