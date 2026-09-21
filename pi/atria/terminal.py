import sys
import time
import traceback

from . import buttons, model, regulator, theme, ui, voice

BADGES = {
    "FC2A1B17": ("moreau", False),
    "19BD41B2": ("capitaine", True),
}

SECTIONS = [
    ("equipage", "Equipage"),
    ("postes", "Postes"),
    ("compartiments", "Compartiments"),
    ("alertes", "Alertes"),
]


class Terminal:
    def __init__(self):
        self.etat = model.Etat()
        self.ecran = ui.Screen()
        self.boutons = buttons.Boutons()
        self.vue = "accueil"
        self.curseur = 0
        self.defilement = 0
        self.selection = None
        self.identite = ("equipage", False)
        self.dialogue = None
        self.actif = True

    def lignes(self):
        if self.vue == "menu":
            return SECTIONS
        if self.vue == "equipage":
            return [(c.nom, c) for c in self.etat.equipage]
        if self.vue == "postes":
            return [(p.nom, p) for p in self.etat.postes]
        if self.vue == "compartiments":
            return [(c.nom, c) for c in self.etat.compartiments]
        if self.vue == "alertes":
            return [(t, m) for t, m in self.etat.alertes()]
        return []

    def rendre(self):
        e = self.ecran
        e.clear()
        porteur = self.identite[0].upper()

        if self.vue == "accueil":
            e.header("ATRIA", porteur)
            actifs = sum(1 for c in self.etat.equipage if c.statut == "actif")
            alertes = self.etat.alertes()
            decouverts = self.etat.postes_decouverts()
            e.label_value(40, "Equipage en service", f"{actifs} / 200")
            e.label_value(62, "Postes decouverts", str(len(decouverts)),
                          theme.CRITICAL if decouverts else theme.VITAL)
            e.label_value(84, "Alertes actives", str(len(alertes)),
                          theme.WATCH if alertes else theme.VITAL)
            e.label_value(106, "Lien Terre", "AUCUN", theme.OFFLINE)
            couleur = theme.CRITICAL if decouverts else (theme.WATCH if alertes else theme.VITAL)
            etiquette = "INTERVENTION REQUISE" if decouverts else (
                "SURVEILLANCE" if alertes else "SYSTEMES NOMINAUX")
            e.banner(150, etiquette, couleur)
            e.footer("● menu    🎙 parler")

        elif self.vue == "fiche":
            membre = self.selection
            e.header(membre.nom.upper(), membre.role)
            couleur = theme.capacity_colour(membre.cognitive)
            e.label_value(38, "Capacite cognitive", f"{membre.cognitive:.2f}", couleur)
            e.gauge(12, 56, 296, membre.cognitive, couleur)
            e.label_value(72, "Frequence cardiaque", f"{membre.hr} bpm")
            e.label_value(94, "RMSSD", f"{membre.rmssd:.0f} ms")
            e.label_value(116, "Sommeil", f"{membre.sommeil_h:.1f} h")
            e.label_value(138, "Dette sociale", f"{membre.dette_sociale} j")
            e.label_value(160, "Poste", membre.poste or "aucun")
            e.label_value(182, "Compartiment", membre.compartiment)
            e.footer("● retour    🎙 parler")

        elif self.vue == "dialogue":
            e.header("DIALOGUE", porteur)
            if self.dialogue is None:
                e.banner(90, "ECOUTE...", theme.VITAL)
            else:
                texte, reponse = self.dialogue
                e.d.text((12, 36), f'"{texte or "..."}"',
                         font=ui.font(theme.SANS, 11), fill=theme.MUTED)
                couleur = theme.VITAL if reponse.accepte else theme.CRITICAL
                e.d.text((12, 60), reponse.titre,
                         font=ui.font(theme.SANS_BOLD, 13), fill=couleur)
                e.paragraph(82, reponse.detail, theme.INK, 11)
                e.paragraph(126, reponse.parole, theme.MUTED, 10)
            e.footer("● retour    🎙 reparler")

        else:
            titres = {"menu": "MENU", "equipage": "EQUIPAGE", "postes": "POSTES",
                      "compartiments": "COMPARTIMENTS", "alertes": "ALERTES"}
            lignes = self.lignes()
            e.header(titres.get(self.vue, self.vue.upper()),
                     f"{self.curseur + 1}/{len(lignes)}" if lignes else "-")
            visibles = 7
            self.defilement = max(0, min(self.defilement, max(0, len(lignes) - visibles)))
            if self.curseur < self.defilement:
                self.defilement = self.curseur
            elif self.curseur >= self.defilement + visibles:
                self.defilement = self.curseur - visibles + 1

            y = 34
            for i in range(self.defilement, min(len(lignes), self.defilement + visibles)):
                cle, obj = lignes[i]
                selected = i == self.curseur
                if self.vue == "menu":
                    e.row(y, obj, "›", theme.MUTED, selected)
                elif self.vue == "equipage":
                    couleur = theme.capacity_colour(obj.cognitive)
                    e.row(y, obj.nom, f"{obj.cognitive:.2f}", couleur, selected, obj.cognitive)
                elif self.vue == "postes":
                    couvert = obj.titulaire is not None
                    couleur = theme.VITAL if couvert else theme.CRITICAL
                    e.row(y, obj.nom, obj.titulaire or "VACANT", couleur, selected)
                elif self.vue == "compartiments":
                    alerte = obj.fumee or obj.co2 > 1000 or obj.bruit_db > 65
                    couleur = theme.CRITICAL if obj.fumee else (
                        theme.WATCH if alerte else theme.VITAL)
                    e.row(y, obj.nom, f"{obj.co2} ppm", couleur, selected)
                else:
                    couleur = theme.CRITICAL if cle == "critique" else theme.WATCH
                    e.row(y, obj, "!", couleur, selected)
                y += theme.ROW_H

            if not lignes:
                e.paragraph(90, "Rien a signaler.", theme.MUTED)
            e.footer("▲▼ naviguer   ● ouvrir   🎙 parler")

        e.blit()

    def parler(self):
        self.vue = "dialogue"
        self.dialogue = None
        self.rendre()
        try:
            texte = voice.ecouter(self.etat, secondes=5.0)
            reponse = voice.interpreter(self.etat, texte, capitaine=self.identite[1])
        except Exception as exc:
            reponse = regulator.Reponse("Systeme vocal indisponible.", "ERREUR",
                                        str(exc)[:70], False)
            texte = ""
        self.dialogue = (texte, reponse)
        self.rendre()
        try:
            voice.repondre(reponse)
        except Exception:
            pass

    def valider(self):
        lignes = self.lignes()
        if self.vue == "accueil":
            self.vue, self.curseur, self.defilement = "menu", 0, 0
        elif self.vue in ("fiche", "dialogue"):
            self.vue, self.curseur, self.defilement = "menu", 0, 0
        elif self.vue == "menu":
            self.vue = SECTIONS[self.curseur][0]
            self.curseur = self.defilement = 0
        elif self.vue == "equipage" and lignes:
            self.selection = lignes[self.curseur][1]
            self.vue = "fiche"
        else:
            self.vue, self.curseur, self.defilement = "menu", 0, 0

    def boucle(self):
        self.rendre()
        while self.actif:
            pin = self.boutons.lire()
            if pin is None:
                time.sleep(0.02)
                continue
            lignes = self.lignes()
            if pin == buttons.PARLER:
                self.parler()
            elif pin == buttons.VALIDER:
                self.valider()
                self.rendre()
            elif pin == buttons.HAUT and lignes:
                self.curseur = (self.curseur - 1) % len(lignes)
                self.rendre()
            elif pin == buttons.BAS and lignes:
                self.curseur = (self.curseur + 1) % len(lignes)
                self.rendre()
            elif pin in (buttons.HAUT, buttons.BAS) and self.vue == "accueil":
                self.valider()
                self.rendre()

    def fermer(self):
        self.boutons.fermer()


def main():
    terminal = Terminal()
    try:
        terminal.boucle()
    except KeyboardInterrupt:
        pass
    except Exception:
        traceback.print_exc()
        return 1
    finally:
        terminal.fermer()
    return 0


if __name__ == "__main__":
    sys.exit(main())
