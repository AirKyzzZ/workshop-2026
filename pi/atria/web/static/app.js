const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const couleur = (v) =>
  v >= 0.70 ? "var(--nominal)" : v >= 0.45 ? "var(--attention)" : "var(--critique)";

const heure = (ts) =>
  new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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

/* ---------- rendu ---------- */

function entete(data) {
  const r = data.resume;
  document.getElementById("h-equipage").textContent = `${r.actifs} / ${r.total}`;
  document.getElementById("h-aptes").textContent = r.aptes;
  document.getElementById("h-vacants").textContent = r.decouverts;

  const s = data.session;
  const identite = document.getElementById("h-session");
  identite.textContent = s?.acteur ? s.acteur.toUpperCase() : "AUCUNE";
  identite.style.color = s?.capitaine ? "var(--attention)"
    : s?.acteur ? "var(--nominal)" : "var(--faible)";
  document.getElementById("mention").textContent =
    s?.role === "equipage" ? "accès équipage · lecture seule"
      : s?.capitaine ? "commandement · lecture seule" : "lecture seule";

  const badge = document.getElementById("h-etat");
  if (r.decouverts) {
    badge.textContent = "Intervention requise";
    badge.style.color = "var(--critique)";
  } else if (data.alertes.length) {
    badge.textContent = "Surveillance";
    badge.style.color = "var(--attention)";
  } else {
    badge.textContent = "Systèmes nominaux";
    badge.style.color = "var(--nominal)";
  }
}

function equipage(data) {
  document.getElementById("e-nb").textContent = `${data.equipage.length} membres`;
  document.getElementById("equipage").innerHTML = data.equipage.map((m) => `
    <div class="rang">
      <span class="nom">${esc(m.nom)}${m.poste ? `<small>${esc(m.poste)}</small>` : ""}</span>
      <span class="jauge"><i style="width:${m.cognitive * 100}%;background:${couleur(m.cognitive)}"></i></span>
      <span class="val" style="color:${couleur(m.cognitive)}">${m.cognitive.toFixed(2)}</span>
    </div>`).join("");
}

function alertes(data) {
  document.getElementById("a-nb").textContent = data.alertes.length || "";
  document.getElementById("alertes").innerHTML = data.alertes.length
    ? data.alertes.map((a) => `<div class="signal">
        <span class="point" style="background:${a.niveau === "critique" ? "var(--critique)" : "var(--attention)"}"></span>
        <span>${esc(a.texte)}</span></div>`).join("")
    : `<div class="vide">Aucune alerte active.</div>`;
}

function previsions(data) {
  document.getElementById("previsions").innerHTML = data.previsions.length
    ? data.previsions.map((p) => `<div class="prevision ${esc(p.niveau)}">
        <strong>${esc(p.crew)}</strong> passera sous le seuil
        <strong>${esc(p.poste)}</strong> (${p.seuil.toFixed(2)}) dans
        <strong>${p.heures} h</strong>.
        <div class="detail">actuel ${p.actuel.toFixed(2)} · pente ${p.pente}/h · R² ${p.r2}</div>
      </div>`).join("")
    : `<div class="vide">Aucune dérive détectée sur l'équipage.</div>`;
}

function rendre(data) {
  entete(data);
  dessinerPlan(data);
  equipage(data);
  alertes(data);
  previsions(data);
}

async function chargerJournal() {
  const { entrees } = await (await fetch("/api/journal?limite=24")).json();
  document.getElementById("journal").innerHTML = entrees.map((e) => `
    <div class="entree">
      <time>${heure(e.ts)}</time>
      <span class="genre ${esc(e.type)}">${esc(e.type)}</span>
      <span class="motif">${e.sujet ? `<b>${esc(e.sujet)}</b> · ` : ""}${esc(e.motif)}</span>
    </div>`).join("");
}

/* ---------- console ---------- */

const formulaire = document.getElementById("console");
const champ = document.getElementById("question");
const historique = document.getElementById("historique");

formulaire.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const texte = champ.value.trim();
  if (!texte) return;
  champ.value = "";

  const bloc = document.createElement("div");
  bloc.className = "echange";
  const demande = document.createElement("div");
  demande.className = "demande";
  demande.textContent = texte;
  const reponse = document.createElement("div");
  reponse.className = "reponse";
  reponse.textContent = "…";
  bloc.append(demande, reponse);
  historique.prepend(bloc);

  try {
    const rep = await (await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte }),
    })).json();
    reponse.textContent = rep.reponse;
    if (rep.outils?.length) {
      const trace = document.createElement("div");
      trace.className = "trace";
      trace.textContent = `outil ${rep.outils[0].nom} · lecture seule`;
      bloc.appendChild(trace);
    }
  } catch {
    reponse.textContent = "La console ne répond pas.";
  }
  chargerJournal();
});

/* ---------- flux ---------- */

function connecter() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => rendre(JSON.parse(ev.data));
  ws.onclose = () => setTimeout(connecter, 2000);
}

Promise.all([
  fetch("/api/etat").then((r) => r.json()),
  fetch("/api/session").then((r) => r.json()),
]).then(([etat, session]) => rendre({ ...etat, session }));

chargerJournal();
setInterval(chargerJournal, 8000);
connecter();
