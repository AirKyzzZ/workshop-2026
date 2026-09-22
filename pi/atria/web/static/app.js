import { el, json } from "./ui.js";
import { vueBord } from "./vue-bord.js";
import { vueCompartiment, vueVaisseau } from "./vue-vaisseau.js";
import { vueEquipage, vueMembre } from "./vue-equipage.js";
import { vueJournal } from "./vue-journal.js";
import { vueConsole } from "./vue-console.js";

const ONGLETS = [
  { route: "#/", libelle: "Bord" },
  { route: "#/vaisseau", libelle: "Vaisseau" },
  { route: "#/equipage", libelle: "Équipage" },
  { route: "#/journal", libelle: "Journal" },
  { route: "#/atria", libelle: "Console" },
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
    return;
  }
  peindreSession();
  if (avant !== session.acteur) {
    etat = await json("/api/etat");
    router();
  }
}

/* ---------- routeur ---------- */

async function router() {
  if (!session.acteur) return;
  if (minuteur) { clearInterval(minuteur); minuteur = null; }

  const route = location.hash || "#/";
  marquerOnglet(route);
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
    else if (section === "journal") minuteur = await vueJournal(vue);
    else if (section === "atria") await vueConsole(vue);
    else await vueBord(vue, etat, session);
  } catch (erreur) {
    vue.appendChild(el("div", "vide", `Impossible d'afficher cette vue : ${erreur.message}`));
  }
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
