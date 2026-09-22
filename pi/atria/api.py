import asyncio
import os
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db, model, predict, regulator

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


def membre_json(c, medical=False):
    base = {
        "nom": c.nom,
        "role": c.role,
        "competences": sorted(c.competences),
        "cognitive": c.cognitive,
        "compartiment": c.compartiment,
        "poste": c.poste,
        "statut": c.statut,
        "apte": c.cognitive >= 0.60,
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
                   "consultation des donnees physiologiques",
                   acteur=session["acteur"], sujet="equipage")


def instantane(medical=False):
    etat.recharger()
    decouverts = etat.postes_decouverts()
    return {
        "ts": time.time(),
        "equipage": [membre_json(c, medical) for c in
                     sorted(etat.equipage, key=lambda c: c.cognitive)],
        "postes": [{"nom": p.nom, "compartiment": p.compartiment,
                    "competence": p.competence, "seuil": p.seuil,
                    "criticite": p.criticite, "titulaire": p.titulaire}
                   for p in etat.postes],
        "compartiments": [compartiment_json(c) for c in etat.compartiments],
        "alertes": [{"niveau": n, "texte": t} for n, t in etat.alertes()],
        "previsions": regulator.alertes_predictives(etat, limite=4),
        "resume": {
            "actifs": sum(1 for c in etat.equipage if c.statut == "actif"),
            "total": 200,
            "decouverts": len(decouverts),
            "aptes": sum(1 for c in etat.equipage if c.cognitive >= 0.70),
            "critiques": sum(1 for c in etat.equipage if c.cognitive < 0.45),
            "lien_terre": False,
        },
    }


@app.get("/api/session")
def api_session():
    return db.session(etat.conn)


@app.get("/api/etat")
def api_etat():
    session = db.session(etat.conn)
    medical = session["role"] == "equipage"
    if medical:
        tracer_acces_medical(session)
    return instantane(medical)


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


@app.get("/api/contacts/{nom}")
def api_contacts(nom: str, heures: int = 24):
    depuis = time.time() - heures * 3600
    return {"nom": nom, "heures": heures,
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
            paquet = instantane(medical)
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
