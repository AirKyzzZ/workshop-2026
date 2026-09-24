import { el, json } from "./ui.js";
import { vueBord } from "./vue-bord.js";
import { vueCompartiment, vueVaisseau } from "./vue-vaisseau.js";
import { vueEquipage, vueMembre } from "./vue-equipage.js";
import { vueJournal } from "./vue-journal.js";
import { vueSocial } from "./vue-social.js";
import { vueSurete } from "./vue-surete.js";
import { vuePerception } from "./vue-perception.js";
import { vuePrediction } from "./vue-prediction.js";
import { vueMesures } from "./vue-mesures.js";
import { vueConsole } from "./vue-console.js";
import { fluxCamera, libererFlux, vueVisage } from "./vue-visage.js";

const ONGLETS = [
  { route: "#/", libelle: "Bord" },
  { route: "#/vaisseau", libelle: "Vaisseau" },
  { route: "#/equipage", libelle: "Équipage" },
  { route: "#/social", libelle: "Social" },
  { route: "#/perception", libelle: "Perception" },
  { route: "#/mesures", libelle: "Mesures" },
  { route: "#/prediction", libelle: "Prédiction" },
  { route: "#/surete", libelle: "Sûreté" },
  { route: "#/journal", libelle: "Journal" },
  { route: "#/atria", libelle: "Console" },
  { route: "#/visage", libelle: "Visage" },
];

const vue = document.getElementById("vue");
const verrou = document.getElementById("verrou");
const application = document.getElementById("application");
const onglets = document.getElementById("onglets");

let etat = null;
let session = { acteur: null, role: "anonyme", capitaine: false };
let minuteur = null;

/* ---------- theme ---------- */

const boutonTheme = document.getElementById("theme");

function appliquerTheme(nom) {
  if (nom === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  boutonTheme.textContent = nom === "dark" ? "Clair" : "Sombre";
  try { localStorage.setItem("atria-theme", nom); } catch {}
}

boutonTheme.addEventListener("click", () =>
  appliquerTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
appliquerTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/* ---------- deconnexion ---------- */

document.getElementById("deconnexion").addEventListener("click", async () => {
  try {
    await fetch("/api/session/fermer", { method: "POST" });
  } catch {}
  session = { acteur: null, role: "anonyme", capitaine: false };
  etat = null;
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  location.hash = "#/";
  await verifierSession();
});

/* ---------- navigation ---------- */

for (const o of ONGLETS) {
  const a = el("a", "onglet", o.libelle);
  a.href = o.route;
  a.dataset.route = o.route;
  onglets.appendChild(a);
}

function marquerOnglet(route) {
  const racine = "#/" + (route.split("/")[1] ?? "");
  for (const a of onglets.children) {
    a.classList.toggle("actif", a.dataset.route === (racine === "#/" ? "#/" : racine));
  }
}

/* ---------- controle facial sur l'ecran de verrouillage ---------- */

const controle = document.getElementById("controle");
let fluxOuvert = false;
let derniereEtape = null;
let rafaleEnCours = false;

async function rafaleSession() {
  // Le verdict tombe avant que le terminal n'ouvre la session, d'ou cette rafale.
  if (rafaleEnCours) return;
  rafaleEnCours = true;
  for (let i = 0; i < 20 && !verrou.hidden; i++) {
    await verifierSession();
    if (verrou.hidden) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  rafaleEnCours = false;
}

function fermerControle() {
  if (!fluxOuvert) return;
  libererFlux(controle);
  controle.replaceChildren();
  controle.hidden = true;
  fluxOuvert = false;
  derniereEtape = null;
}

function peindreControle(v) {
  if (!fluxOuvert) {
    controle.replaceChildren();
    controle.hidden = false;
    const titre = el("p", "controle-titre", `Badge ${v.nom}`);
    controle.appendChild(titre);
    fluxCamera(controle);
    controle.appendChild(el("p", "verdict", ""));
    fluxOuvert = true;
  }
  const verdict = controle.querySelector(".verdict");
  verdict.textContent = v.motif;
  verdict.className = `verdict ${v.etat === "accorde" ? "accorde"
    : v.etat === "refuse" ? "refuse" : ""}`;
  if (v.etat !== derniereEtape) {
    derniereEtape = v.etat;
    controle.classList.toggle("accorde", v.etat === "accorde");
    controle.classList.toggle("refuse", v.etat === "refuse");
    if (v.etat === "accorde") rafaleSession();
  }
}

async function suivreControle() {
  if (verrou.hidden) return;
  try {
    const e = await json("/api/camera/etat");
    if (e.verification) peindreControle(e.verification);
    else fermerControle();
  } catch {
    fermerControle();
  }
}

/* ---------- session ---------- */

function peindreSession() {
  const identite = document.getElementById("identite");
  const role = document.getElementById("role");
  identite.textContent = session.acteur ? session.acteur.toUpperCase() : "—";
  identite.style.color = session.capitaine ? "var(--attention)" : "var(--nominal)";
  role.textContent = session.capitaine ? "commandement" : "équipage";
}

async function verifierSession() {
  const avant = session.acteur;
  try {
    session = await json("/api/session");
  } catch {
    return;
  }
  const ouvert = Boolean(session.acteur) && !session.expire;
  verrou.hidden = ouvert;
  application.hidden = !ouvert;
  if (!ouvert) {
    if (minuteur) { clearInterval(minuteur); minuteur = null; }
    suivreControle();
    return;
  }
  fermerControle();
  peindreSession();
  if (avant !== session.acteur) {
    etat = await json("/api/etat");
    router();
  }
}

/* ---------- routeur ---------- */

async function peindre() {
  if (!session.acteur) return;
  if (minuteur) { clearInterval(minuteur); minuteur = null; }

  const route = location.hash || "#/";
  marquerOnglet(route);
  libererFlux(vue);
  vue.replaceChildren();
  vue.scrollTop = 0;

  if (!etat) etat = await json("/api/etat");
  const [, section, argument] = route.split("/");
  vue.dataset.page = section || "bord";
  const cible = decodeURIComponent(argument ?? "");

  try {
    if (section === "vaisseau") await vueVaisseau(vue, etat);
    else if (section === "compartiment") await vueCompartiment(vue, etat, cible);
    else if (section === "equipage" && cible) await vueMembre(vue, cible);
    else if (section === "equipage") vueEquipage(vue, etat);
    else if (section === "social") await vueSocial(vue);
    else if (section === "perception") minuteur = await vuePerception(vue);
    else if (section === "prediction") minuteur = await vuePrediction(vue);
    else if (section === "mesures") minuteur = await vueMesures(vue);
    else if (section === "surete") minuteur = await vueSurete(vue, session);
    else if (section === "journal") minuteur = await vueJournal(vue);
    else if (section === "atria") await vueConsole(vue);
    else if (section === "visage") minuteur = await vueVisage(vue, session);
    else await vueBord(vue, etat, session);
  } catch (erreur) {
    vue.appendChild(el("div", "vide", `Impossible d'afficher cette vue : ${erreur.message}`));
  }
}

// Deux appels concurrents vident et remplissent la vue en meme temps, et la page se
// dessine en double. Le routeur se serialise donc sur le rendu precedent.
let rendu = Promise.resolve();
function router() {
  rendu = rendu.then(peindre, peindre);
  return rendu;
}

window.addEventListener("hashchange", router);

/* ---------- flux temps reel ---------- */

function connecter() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const paquet = JSON.parse(ev.data);
    etat = paquet;
    if (paquet.session) session = paquet.session;
    const route = location.hash || "#/";
    if (route === "#/" || route === "#/vaisseau" || route === "#/equipage") router();
  };
  ws.onclose = () => setTimeout(connecter, 2000);
}

verifierSession().then(() => { router(); connecter(); });
setInterval(verifierSession, 4000);
setInterval(() => { if (!verrou.hidden) suivreControle(); }, 700);
