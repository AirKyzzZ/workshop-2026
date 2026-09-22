import sys
import time
import traceback

import json
import urllib.error
import urllib.request

from . import buttons, db, link, model, noeud, regulator, theme, ui, visage, voice

BADGES = {
    "FC2A1B17": ("moreau", False),
    "19BD41B2": ("maxime", True),
}

SECTIONS = [
    ("equipage", "Equipage"),
    ("postes", "Postes"),
    ("compartiments", "Compartiments"),
    ("alertes", "Alertes"),
]

API = "http://127.0.0.1:8000"
DELAI_CONTROLE_S = 20.0

BADGE_AFFICHAGE_S = 2.5
COMPARTIMENT_LOCAL = "infirmerie"
INGESTION_S = 20.0
SCRUTATION_S = 15.0


class Terminal:
    def __init__(self):
        self.etat = model.Etat()
        self.ecran = ui.Screen()
        self.boutons = buttons.Boutons()
        self.lien = link.Link()
        self.reseau = noeud.Reseau(self.etat.conn)
        self.reseau.scruter()
        self.vue = "accueil"
        self.retour = "accueil"
        self.curseur = 0
        self.defilement = 0
        self.selection = None
        self.identite = (None, False)
        self.badge_jusqua = 0.0
        self.badge_info = None
        self.dialogue = None
        self.prochaine_ingestion = 0.0
        self.prochaine_scrutation = 0.0
        self.actif = True

    def porteur(self):
        return (self.identite[0] or "non identifie").upper()

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

        if self.vue == "badge":
            nom, capitaine = self.badge_info
            couleur = theme.WATCH if capitaine else theme.VITAL
            e.header("IDENTIFICATION", "RC522")
            e.d.text((12, 56), nom.upper(), font=ui.font(theme.SANS_BOLD, 26), fill=couleur)
            role = "COMMANDEMENT — acces complet" if capitaine else "EQUIPAGE — donnees personnelles"
            e.paragraph(96, role, theme.MUTED, 11)
            e.banner(150, "ACCES ACCORDE", couleur)
            e.footer("● continuer")

        elif self.vue == "accueil":
            e.header("ATRIA", self.porteur())
            actifs = sum(1 for c in self.etat.equipage if c.statut == "actif")
            alertes = self.etat.alertes()
            decouverts = self.etat.postes_decouverts()
            e.label_value(38, "Equipage en service", f"{actifs} / 200")
            e.label_value(60, "Postes decouverts", str(len(decouverts)),
                          theme.CRITICAL if decouverts else theme.VITAL)
            e.label_value(82, "Alertes actives", str(len(alertes)),
                          theme.WATCH if alertes else theme.VITAL)
            if self.lien.humidite is not None:
                humide = self.lien.humidite > db.SEUIL_HUMIDITE
                e.label_value(104, "Atmosphère infirmerie",
                              f"{self.lien.temp_c:.0f}C  {self.lien.humidite:.0f}%",
                              theme.WATCH if humide else theme.MUTED)
            else:
                e.label_value(104, "Ambiance sonore", f"{db.bruit_db(self.lien.mic)} dB",
                              theme.MUTED)
            e.label_value(126, "Lien Terre", "AUCUN", theme.OFFLINE)
            couleur = theme.CRITICAL if decouverts else (theme.WATCH if alertes else theme.VITAL)
            etiquette = "INTERVENTION REQUISE" if decouverts else (
                "SURVEILLANCE" if alertes else "SYSTEMES NOMINAUX")
            e.banner(158, etiquette, couleur)
            e.footer("● menu    ← retour    badge pour s'identifier")

        elif self.vue == "fiche":
            membre = self.selection
            e.header(membre.nom.upper(), membre.role)
            couleur = theme.capacity_colour(membre.cognitive)
            e.label_value(38, "Capacite cognitive", f"{membre.cognitive:.2f}", couleur)
            e.gauge(12, 56, 296, membre.cognitive, couleur)
            if self.identite[1]:
                apte = "APTE" if membre.cognitive >= 0.60 else "APTITUDE REDUITE"
                e.label_value(76, "Aptitude", apte, couleur)
                e.label_value(98, "Poste", membre.poste or "aucun")
                e.label_value(120, "Compartiment", membre.compartiment)
                e.paragraph(148, "Donnees physiologiques non communiquees au commandement.",
                            theme.MUTED, 10)
            else:
                e.label_value(76, "Frequence cardiaque", f"{membre.hr} bpm")
                e.label_value(98, "RMSSD", f"{membre.rmssd:.0f} ms")
                e.label_value(120, "Sommeil", f"{membre.sommeil_h:.1f} h")
                e.label_value(142, "Dette sociale", f"{membre.dette_sociale} j")
                e.label_value(164, "Poste", membre.poste or "aucun")
            e.footer("● menu    ← retour")

        elif self.vue == "dialogue":
            e.header("DIALOGUE", self.porteur())
            if self.dialogue is None:
                e.banner(86, "ECOUTE...", theme.VITAL)
                e.paragraph(130, "Parle maintenant, cinq secondes.", theme.MUTED, 10)
            else:
                texte, reponse = self.dialogue
                e.d.text((12, 36), f'"{texte or "..."}"',
                         font=ui.font(theme.SANS, 11), fill=theme.MUTED)
                couleur = theme.VITAL if reponse.accepte else theme.CRITICAL
                e.d.text((12, 58), reponse.titre,
                         font=ui.font(theme.SANS_BOLD, 13), fill=couleur)
                y = e.paragraph(80, reponse.detail, theme.INK, 11)
                e.paragraph(y + 6, reponse.parole, theme.MUTED, 10)
            e.footer("● menu    ← retour")

        else:
            titres = {"menu": "MENU", "equipage": "EQUIPAGE", "postes": "POSTES",
                      "compartiments": "COMPARTIMENTS", "alertes": "ALERTES"}
            lignes = self.lignes()
            e.header(titres.get(self.vue, self.vue.upper()),
                     f"{self.curseur + 1}/{len(lignes)}" if lignes else "-")
            visibles = 7
            if self.curseur < self.defilement:
                self.defilement = self.curseur
            elif self.curseur >= self.defilement + visibles:
                self.defilement = self.curseur - visibles + 1
            self.defilement = max(0, min(self.defilement, max(0, len(lignes) - visibles)))

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
                    humide = obj.humidite is not None and obj.humidite > db.SEUIL_HUMIDITE
                    alerte = obj.fumee or humide or obj.bruit_db > 65
                    couleur = theme.CRITICAL if obj.fumee else (
                        theme.WATCH if alerte else theme.VITAL)
                    if obj.humidite is not None:
                        valeur = f"{obj.temp_c:.0f}C {obj.humidite:.0f}%"
                    else:
                        valeur = f"{obj.bruit_db} dB"
                    e.row(y, obj.nom, valeur, couleur, selected)
                else:
                    couleur = theme.CRITICAL if cle == "critique" else theme.WATCH
                    e.row(y, obj, "!", couleur, selected)
                y += theme.ROW_H

            if not lignes:
                e.paragraph(90, "Rien a signaler.", theme.MUTED)
            e.footer("▲▼ naviguer   ● ouvrir   ← retour")

        e.blit()

    def controle_facial(self, nom):
        """Second facteur, delegue a l'API qui detient la camera.

        Un membre sans gabarit enrole passe au badge seul : la biometrie ne doit pas
        verrouiller un equipage qui ne s'est jamais presente devant la camera. Si l'API
        ne repond pas, on n'enferme pas non plus la passerelle.
        """
        if not visage.disponible() or not db.gabarits(self.etat.conn, nom):
            # Le badge seul suffit tant que personne n'est enrole, sinon plus personne
            # ne pourrait entrer pour s'enroler. On le trace, pour qu'aucun acces ne
            # passe sans laisser de motif au journal.
            db.journaliser(self.etat.conn, "identification",
                           f"badge {nom} accepte sans controle facial, aucun gabarit",
                           acteur=nom, sujet=nom)
            return True, None, "aucun gabarit enrole"

        charge = json.dumps({"nom": nom}).encode()
        requete = urllib.request.Request(
            f"{API}/api/visage/verifier", data=charge,
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(requete, timeout=DELAI_CONTROLE_S) as r:
                paquet = json.load(r)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            return True, None, f"controle indisponible : {str(exc)[:40]}"

        return paquet.get("accorde", False), paquet.get("score"), paquet.get("motif", "")

    def sur_badge(self, uid):
        connu = BADGES.get(uid)
        if connu is None:
            self.lien.beep("DENY")
            self.badge_info = (f"inconnu {uid}", False)
            self.identite = (None, False)
            self.retour = self.vue if self.vue not in ("badge", "dialogue") else "accueil"
            self.vue = "badge"
            self.badge_jusqua = time.monotonic() + BADGE_AFFICHAGE_S
            self.rendre()
            return

        nom, capitaine = connu
        self.badge_info = (f"{nom} · visage...", capitaine)
        self.vue = "badge"
        self.rendre()

        accorde, score, motif = self.controle_facial(nom)
        donnees = {"similarite": round(score, 3) if score is not None else None,
                   "seuil": visage.SEUIL_COSINUS}

        if accorde:
            self.lien.beep("OK")
            self.identite = connu
            self.badge_info = connu
            db.ouvrir_session(self.etat.conn, nom, "capitaine" if capitaine else "equipage")
            db.journaliser(self.etat.conn, "identification",
                           f"badge {nom} présenté au terminal, {motif}",
                           acteur=nom, sujet=nom, donnees=donnees)
        else:
            self.lien.beep("DENY")
            self.identite = (None, False)
            self.badge_info = (f"{nom} REFUSE", False)
            db.fermer_session(self.etat.conn)
            db.journaliser(self.etat.conn, "refus",
                           f"badge {nom} présenté sans correspondance faciale, {motif}",
                           acteur="atria", sujet=nom, donnees=donnees)

        self.retour = self.vue if self.vue not in ("badge", "dialogue") else "accueil"
        self.vue = "badge"
        self.badge_jusqua = time.monotonic() + BADGE_AFFICHAGE_S
        self.rendre()

    def parler(self):
        self.vue = "dialogue"
        self.dialogue = None
        self.rendre()
        self.lien.beep("LISTEN")
        try:
            texte = voice.ecouter(self.etat, secondes=5.0)
            reponse = voice.interpreter(self.etat, texte, capitaine=self.identite[1])
        except Exception as exc:
            reponse = regulator.Reponse("Systeme vocal indisponible.", "ERREUR",
                                        str(exc)[:70], False)
            texte = ""
        self.dialogue = (texte, reponse)
        self.rendre()
        self.lien.beep("OK" if reponse.accepte else "DENY")
        try:
            voice.repondre(reponse)
        except Exception:
            pass

    PARENT = {
        "fiche": "equipage",
        "equipage": "menu",
        "postes": "menu",
        "compartiments": "menu",
        "alertes": "menu",
        "dialogue": "menu",
        "menu": "accueil",
    }

    def revenir(self):
        if self.vue == "badge":
            self.vue = self.retour
            return
        parent = self.PARENT.get(self.vue)
        if parent is None:
            return
        self.vue = parent
        self.curseur = self.defilement = 0

    def valider(self):
        lignes = self.lignes()
        if self.vue == "badge":
            self.vue = self.retour
        elif self.vue == "accueil":
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

    def ingerer(self):
        if self.lien.temp_c is None:
            return
        db.enregistrer_ambiance(self.etat.conn, COMPARTIMENT_LOCAL, self.lien.mic,
                                self.lien.mq2, self.lien.temp_c, self.lien.humidite)
        self.etat.recharger()

    def boucle(self):
        self.rendre()
        dernier_rendu = time.monotonic()
        while self.actif:
            if time.monotonic() >= self.prochaine_scrutation:
                self.prochaine_scrutation = time.monotonic() + SCRUTATION_S
                self.reseau.scruter()

            if time.monotonic() >= self.prochaine_ingestion:
                self.prochaine_ingestion = time.monotonic() + INGESTION_S
                try:
                    self.ingerer()
                except Exception:
                    pass
            evenement = self.lien.prochain()
            if evenement and evenement[0] == "badge":
                self.sur_badge(evenement[1])
                continue

            if self.vue == "badge" and time.monotonic() > self.badge_jusqua:
                self.vue = self.retour
                self.rendre()
                continue

            pin = self.boutons.lire()
            if pin is None:
                if self.vue == "accueil" and time.monotonic() - dernier_rendu > 2.0:
                    dernier_rendu = time.monotonic()
                    self.rendre()
                time.sleep(0.02)
                continue

            lignes = self.lignes()
            if pin == buttons.RETOUR:
                self.revenir()
                self.rendre()
            elif pin == buttons.VALIDER:
                self.valider()
                self.rendre()
            elif pin == buttons.HAUT and lignes:
                self.curseur = (self.curseur - 1) % len(lignes)
                self.rendre()
            elif pin == buttons.BAS and lignes:
                self.curseur = (self.curseur + 1) % len(lignes)
                self.rendre()
            dernier_rendu = time.monotonic()

    def fermer(self):
        self.boutons.fermer()
        self.lien.fermer()
        self.reseau.fermer()


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
