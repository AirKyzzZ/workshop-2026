import asyncio
import os
import time

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import camera, db, llm, model, predict, regulator, social, visage

WEB = os.path.join(os.path.dirname(__file__), "web")
PERIODE_PUSH = 3.0

app = FastAPI(title="ATRIA", docs_url=None, redoc_url=None)
etat = model.Etat()

_dernier_acces_medical = 0.0

"""Modele d'acces : une seule console active a bord. L'identite vient du dernier badge
presente au terminal physique, elle expire en trois minutes, et chaque ouverture d'acces
medical est tracee au journal. Il n'y a pas d'authentification par client : le reseau de
bord est considere comme le perimetre de confiance, comme sur une passerelle reelle."""


def compartiment_json(c):
    return {
        "nom": c.nom,
        "bruit_db": c.bruit_db,
        "fumee": c.fumee,
        "temp_c": c.temp_c,
        "humidite": c.humidite,
        "occupants": c.occupants,
        "instrumente": c.humidite is not None,
        "alerte": bool(c.fumee or (c.humidite and c.humidite > db.SEUIL_HUMIDITE)
                       or c.bruit_db > 65),
    }


def membre_json(c, medical=False, conduite=None):
    base = {
        "nom": c.nom,
        "role": c.role,
        "competences": sorted(c.competences),
        "cognitive": c.cognitive,
        "compartiment": c.compartiment,
        "poste": c.poste,
        "statut": c.statut,
        "apte": c.cognitive >= 0.60,
        "conduite": 1.0 if conduite is None else round(conduite, 3),
    }
    if medical:
        base.update({
            "hr": c.hr, "rmssd": c.rmssd, "stress": c.stress,
            "sommeil_h": c.sommeil_h, "dette_sociale": c.dette_sociale,
            "fatigue": c.fatigue,
        })
    return base


def tracer_acces_medical(session):
    global _dernier_acces_medical
    maintenant = time.time()
    if maintenant - _dernier_acces_medical < 60:
        return
    _dernier_acces_medical = maintenant
    db.journaliser(etat.conn, "identification",
                   "consultation des données physiologiques",
                   acteur=session["acteur"], sujet="équipage")


def instantane(medical=False, acteur=None):
    etat.recharger()
    decouverts = etat.postes_decouverts()
    _conduites = db.conduites(etat.conn)

    return {
        "ts": time.time(),

        "equipage": [
            membre_json(
                c,
                medical and c.nom == acteur,
                _conduites.get(c.nom)
            )
            for c in sorted(
                etat.equipage,
                key=lambda c: c.cognitive
            )
        ],

        "postes": [
            {
                "nom": p.nom,
                "compartiment": p.compartiment,
                "competence": p.competence,
                "seuil": p.seuil,
                "criticite": p.criticite,
                "titulaire": p.titulaire
            }
            for p in etat.postes
        ],

        "compartiments": [
            compartiment_json(c)
            for c in etat.compartiments
        ],

        "alertes": [
            {"niveau": n, "texte": t}
            for n, t in etat.alertes()
        ],

        "previsions": regulator.alertes_predictives(
            etat,
            limite=4
        ),

        "resume": {
            "actifs": sum(
                1 for c in etat.equipage
                if c.statut == "actif"
            ),
            "total": 200,
            "decouverts": len(decouverts),
            "aptes": sum(
                1 for c in etat.equipage
                if c.cognitive >= 0.70
            ),
            "critiques": sum(
                1 for c in etat.equipage
                if c.cognitive < 0.45
            ),
            "lien_terre": False,
        },
    }


@app.on_event("startup")
async def prechauffer_modele():
    asyncio.get_running_loop().run_in_executor(None, llm.prechauffer)


LOCAUX = {"127.0.0.1", "::1", "localhost"}


def refus_biometrie(requete, action, sujet=None):
    """Garde des routes biometriques. Rend un refus, ou None si l'acces est legitime.

    Un gabarit facial vaut une cle : qui peut en deposer un peut se faire passer pour
    n'importe qui, et qui peut en effacer un fait retomber sa cible au badge seul. Ces
    routes sont donc reservees au capitaine identifie, ou au terminal de bord lui-meme,
    qui est le seul appelant local legitime.
    """
    if requete is not None and requete.client and requete.client.host in LOCAUX:
        return None
    session = db.session(etat.conn)
    if session["capitaine"]:
        return None
    db.journaliser(etat.conn, "refus", f"{action} refuse, identification capitaine requise",
                   acteur=session["acteur"] or "anonyme", sujet=sujet)
    return {"erreur": "reserve au capitaine identifie"}


@app.on_event("startup")
async def demarrer_services():
    asyncio.get_running_loop().run_in_executor(None, llm.prechauffer)
    if visage.disponible():
        camera.flux.demarrer()
        camera.flux.armer_surveillance(etat.conn)


@app.on_event("shutdown")
async def arreter_services():
    camera.flux.arreter()


SPECTATEURS_MAX = 3
_spectateurs = 0


async def flux_mjpeg(requete):
    """Un flux MJPEG ne se termine jamais de lui-meme.

    Il faut donc surveiller la deconnexion du client, sans quoi le generateur tourne
    indefiniment : le navigateur sature ses six creneaux par hote et le dashboard entier
    se fige, requetes de session comprises.
    """
    global _spectateurs
    limite = b"--trame"
    vide = 0
    _spectateurs += 1
    camera.flux.regarder(+1)
    try:
        while camera.flux.actif:
            if await requete.is_disconnected():
                break
            image = camera.flux.image()
            if image is None:
                vide += 1
                if vide > 100:
                    break
                await asyncio.sleep(0.05)
                continue
            vide = 0
            yield (limite + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                   + str(len(image)).encode() + b"\r\n\r\n" + image + b"\r\n")
            await asyncio.sleep(0.08)
    finally:
        _spectateurs -= 1
        camera.flux.regarder(-1)


@app.get("/api/camera/flux")
async def api_camera_flux(requete: Request):
    if not camera.flux.actif:
        return {"erreur": "flux camera inactif"}
    if _spectateurs >= SPECTATEURS_MAX:
        return {"erreur": f"deja {_spectateurs} flux ouverts"}
    return StreamingResponse(flux_mjpeg(requete),
                             media_type="multipart/x-mixed-replace; boundary=trame")


@app.get("/api/camera/etat")
def api_camera_etat():
    etat_flux = camera.flux.etat()
    etat_flux["verification"] = camera.flux.etat_verification()
    etat_flux["seuil"] = visage.SEUIL_COSINUS
    return etat_flux


@app.get("/api/visage/enroles")
def api_visage_enroles(requete: Request):
    refus = refus_biometrie(requete, "consultation des gabarits")
    if refus:
        return refus
    return {"membres": [{"nom": n, "gabarits": k}
                        for n, k in db.membres_enroles(etat.conn)],
            "cible": visage.GABARITS_PAR_MEMBRE}


@app.post("/api/visage/enroler")
def api_visage_enroler(corps: dict, requete: Request):
    nom = (corps.get("nom") or "").strip().lower()
    refus = refus_biometrie(requete, "enrolement facial", nom or None)
    if refus:
        return refus
    if not nom:
        return {"erreur": "nom manquant"}
    if etat.conn.execute("SELECT 1 FROM crew WHERE nom = ?", (nom,)).fetchone() is None:
        return {"erreur": f"{nom} ne figure pas au registre d'equipage"}

    empreinte = camera.flux.empreinte_courante()
    if empreinte is None:
        return {"erreur": "aucun visage devant la camera",
                "gabarits": len(db.gabarits(etat.conn, nom))}

    db.enregistrer_gabarit(etat.conn, nom, empreinte)
    total = len(db.gabarits(etat.conn, nom))
    db.journaliser(etat.conn, "biometrie", f"gabarit facial {total} enrole",
                   acteur="systeme", sujet=nom)
    return {"nom": nom, "gabarits": total, "cible": visage.GABARITS_PAR_MEMBRE,
            "surface": camera.flux.etat()["surface"]}


@app.delete("/api/visage/{nom}")
def api_visage_oublier(nom: str, requete: Request):
    refus = refus_biometrie(requete, "effacement des gabarits", nom)
    if refus:
        return refus
    n = db.oublier_gabarits(etat.conn, nom)
    db.journaliser(etat.conn, "biometrie", f"{n} gabarits faciaux effaces",
                   acteur="systeme", sujet=nom)
    return {"nom": nom, "supprimes": n}


@app.post("/api/visage/verifier")
async def api_visage_verifier(corps: dict, requete: Request):
    refus = refus_biometrie(requete, "controle facial")
    if refus:
        return {**refus, "accorde": False}
    nom = (corps.get("nom") or "").strip().lower()
    accorde, score, motif = await asyncio.to_thread(camera.verifier, etat.conn, nom)
    return {"nom": nom, "accorde": accorde,
            "score": None if score is None else round(score, 3), "motif": motif}


@app.get("/api/session")
def api_session():
    return db.session(etat.conn)


def reponse_json(r, extra=None):
    return {"accepte": r.accepte, "titre": r.titre, "parole": r.parole,
            "detail": r.detail, **(extra or {})}


def alternative(nom, nom_poste):
    """Le remplacant que le regulateur recommande, pour l'afficher a cote du refus."""
    poste = etat.poste(nom_poste)
    if poste is None:
        return None
    aptes = sorted((c for c in etat.equipage
                    if poste.competence in c.competences and c.cognitive >= poste.seuil),
                   key=lambda c: c.cognitive, reverse=True)
    if not aptes:
        return None
    return {"nom": aptes[0].nom, "cognitive": round(aptes[0].cognitive, 2)}


@app.post("/api/affectation")
def api_affectation(corps: dict):
    """Seule route qui modifie l'etat operationnel du vaisseau.

    Le capitaine propose, le regulateur tranche, et un refus n'est pas une erreur :
    c'est une reponse motivee, chiffree, assortie d'une alternative.
    """
    session = db.session(etat.conn)
    if not session["capitaine"]:
        db.journaliser(etat.conn, "refus", "affectation refusee, capitaine non identifie",
                       acteur=session["acteur"] or "anonyme")
        return {"erreur": "reserve au capitaine identifie", "accepte": False}

    nom = (corps.get("nom") or "").strip().lower()
    poste = (corps.get("poste") or "").strip().lower()
    etat.recharger()
    reponse = regulator.affecter(etat, nom, poste, auteur=session["acteur"])
    return reponse_json(reponse, {"nom": nom, "poste": poste,
                                  "alternative": None if reponse.accepte
                                  else alternative(nom, poste)})


@app.post("/api/derogation")
def api_derogation(corps: dict):
    """Passage en force du capitaine. Horodate, attribue, journalise."""
    session = db.session(etat.conn)
    if not session["capitaine"]:
        db.journaliser(etat.conn, "refus", "derogation refusee, capitaine non identifie",
                       acteur=session["acteur"] or "anonyme")
        return {"erreur": "reserve au capitaine identifie", "accepte": False}

    nom = (corps.get("nom") or "").strip().lower()
    poste = (corps.get("poste") or "").strip().lower()
    etat.recharger()
    return reponse_json(regulator.deroger(etat, nom, poste, auteur=session["acteur"]),
                        {"nom": nom, "poste": poste})


@app.post("/api/session/fermer")
def api_session_fermer():
    session = db.session(etat.conn)
    if session["acteur"]:
        db.journaliser(etat.conn, "identification",
                       f"session de {session['acteur']} fermee depuis le dashboard",
                       acteur=session["acteur"], sujet=session["acteur"])
    db.fermer_session(etat.conn)
    return {"ferme": True}


@app.get("/api/etat")
def api_etat():
    session = db.session(etat.conn)

    medical = session["role"] == "equipage"

    if medical:
        tracer_acces_medical(session)

    return instantane(
        medical,
        session["acteur"]
    )


@app.get("/api/social")
def api_social():
    """Graphe social complet : noeuds, liens, conflits probables."""
    g = social.graphe(etat.conn)
    etat.recharger()
    g["conflits"] = social.conflits_probables(etat.conn, limite=6)
    g["contagion_mentale"] = social.contagion_mentale(etat.conn, etat)
    conduites = db.conduites(etat.conn)
    capacites = {c.nom: c.cognitive for c in etat.equipage}
    for n in g["noeuds"]:
        n["conduite"] = round(conduites.get(n["nom"], 1.0), 3)
        n["cognitive"] = round(capacites.get(n["nom"], 0.0), 3)
    return g


@app.get("/api/exposition/{nom}")
def api_exposition(nom: str, heures: int = 24):
    """Chaine d'exposition autour d'un membre, pour le tracage d'une contamination."""
    return social.exposition(etat.conn, nom, heures)


@app.get("/api/surveillance")
def api_surveillance(limite: int = 30):
    """Fil des incidents et etat de la detection comportementale."""
    etat_cam = camera.flux.etat()
    return {
        "incidents": db.incidents(etat.conn, limite=limite),
        "seuil": db.SEUIL_CONDUITE,
        "demi_vie_h": db.DEMI_VIE_INCIDENT_S / 3600,
        "surveillance": etat_cam.get("surveillance"),
        "auteur": etat_cam.get("auteur"),
        "detections": etat_cam.get("detections"),
        "conduites": sorted(
            ({"nom": n, "conduite": round(v, 3)} for n, v in db.conduites(etat.conn).items()),
            key=lambda x: x["conduite"]),
    }


@app.get("/api/journal")
def api_journal(limite: int = 40):
    return {"entrees": db.journal(etat.conn, limite)}


@app.get("/api/serie/{nom}")
def api_serie(nom: str, points: int = 48):
    serie = db.releve_capacite(etat.conn, nom, points)
    tendance = predict.ajuster(serie)
    return {
        "nom": nom,
        "points": [{"ts": ts, "valeur": v} for ts, v in serie],
        "tendance": None if tendance is None else {
            "pente_h": round(tendance.pente_h, 4),
            "r2": round(tendance.r2, 3),
            "fiable": tendance.fiable,
            "projection_6h": round(tendance.projection(6), 3),
        },
    }


@app.get("/api/ambiance/{compartiment}")
def api_ambiance(compartiment: str, heures: int = 24):
    return {"compartiment": compartiment, "heures": heures,
            "points": db.serie_ambiance(etat.conn, compartiment, heures)}


@app.get("/api/vitals/{nom}")
def api_vitals(nom: str, heures: int = 24):
    session = db.session(etat.conn)

    # Le capitaine n'a pas accès aux données physiologiques
    if session["capitaine"]:
        return {
            "nom": nom,
            "points": [],
            "refuse": True,
            "motif": "donnees physiologiques reservees"
        }

    # Un membre ne peut voir que ses propres données
    if session["acteur"] != nom:
        return {
            "nom": nom,
            "points": [],
            "refuse": True,
            "motif": "acces refuse"
        }

    return {
        "nom": nom,
        "heures": heures,
        "points": db.serie_vitals(
            etat.conn,
            nom,
            heures
        ),
        "refuse": False
    }


@app.get("/api/membre/{nom}")
def api_membre(nom: str):
    """Fiche d'un membre. La partie operationnelle est ouverte, le medical ne l'est pas.

    Le classement de l'equipage affiche deja la capacite de chacun : refuser la fiche
    complete casserait la navigation sans rien proteger. Ce qui doit rester ferme, ce sont
    les donnees physiologiques, reservees au porteur du badge.
    """
    session = db.session(etat.conn)
    if not session["acteur"]:
        return {"erreur": "aucune identite badgee"}

    medical = (
        session["role"] == "equipage"
        and session["acteur"] == nom
    )
    etat.recharger()
    m = etat.membre(nom)
    if m is None:
        return {"erreur": "membre inconnu"}
    serie = db.releve_capacite(etat.conn, nom, 48)
    tendance = predict.ajuster(serie)
    return {
        "membre": membre_json(m, medical),
        "capacite": [{"ts": ts, "valeur": v} for ts, v in serie],
        "tendance": None if tendance is None else {
            "pente_h": round(tendance.pente_h, 4), "r2": round(tendance.r2, 3),
            "fiable": tendance.fiable, "projection_6h": round(tendance.projection(6), 3),
        },
        "conduite": round(db.conduite(etat.conn, nom), 3),
        "serie_conduite": db.serie_conduite(etat.conn, nom, 24),
        "incidents": db.incidents(etat.conn, nom, limite=12),
        "contacts": [{"crew": a, "minutes": round(s / 60)}
                     for a, s in db.contacts(etat.conn, nom, time.time() - 86400)][:8],
        "medical": medical,
    }


@app.get("/api/contacts/{nom}")
def api_contacts(nom: str, heures: int = 24):
    depuis = time.time() - heures * 3600
    return {"nom": nom, "heures": heures,
            "conduite": round(db.conduite(etat.conn, nom), 3),
        "serie_conduite": db.serie_conduite(etat.conn, nom, 24),
        "incidents": db.incidents(etat.conn, nom, limite=12),
        "contacts": [{"crew": a, "minutes": round(s / 60)}
                         for a, s in db.contacts(etat.conn, nom, depuis)]}


@app.get("/api/outils")
def api_outils():
    from . import chat
    return {"outils": chat.catalogue(), "ecriture": False}


@app.post("/api/chat")
async def api_chat(message: dict):
    from . import chat
    question = (message.get("texte") or "").strip()
    session = db.session(etat.conn)
    if not question:
        return {"reponse": "Pose une question.", "outils": [], "erreur": True}
    return await asyncio.to_thread(chat.repondre, etat, question,
                                   session["capitaine"], session["role"] == "equipage")


@app.websocket("/ws")
async def ws(socket: WebSocket):
    await socket.accept()
    try:
        while True:
            session = db.session(etat.conn)
            medical = session["role"] == "equipage"
            if medical:
                tracer_acces_medical(session)
            paquet = instantane(
                medical,
                session["acteur"]
		)
            paquet["session"] = session
            await socket.send_json(paquet)
            await asyncio.sleep(PERIODE_PUSH)
    except (WebSocketDisconnect, RuntimeError):
        pass


@app.get("/")
def index():
    return FileResponse(os.path.join(WEB, "index.html"))


if os.path.isdir(WEB):
    app.mount("/static", StaticFiles(directory=os.path.join(WEB, "static")), name="static")
