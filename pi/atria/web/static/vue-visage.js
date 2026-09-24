import { bloc, el, json } from "./ui.js";

const poster = (url, corps) =>
  fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).then((r) => r.json());

export function libererFlux(racine) {
  // Un flux MJPEG ne se termine jamais tout seul. Sans cette liberation, Chrome garde
  // la connexion ouverte, sature ses six creneaux par hote, et toutes les requetes
  // suivantes du dashboard restent en attente indefiniment.
  for (const img of racine.querySelectorAll(".camera img")) {
    img.src = "";
    img.removeAttribute("src");
  }
}

export function fluxCamera(hote) {
  const cadre = el("div", "camera");
  const image = el("img");
  image.src = `/api/camera/flux?t=${Date.now()}`;
  image.alt = "flux de la caméra de la passerelle";
  const secours = el("div", "camera-vide", "Flux indisponible.");
  secours.hidden = true;
  image.addEventListener("error", () => { image.hidden = true; secours.hidden = false; });
  cadre.append(image, secours);
  hote.appendChild(cadre);
  return image;
}

export async function vueVisage(hote, session) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Reconnaissance faciale"));
  entete.appendChild(el("span", "sous-titre",
    "Second facteur après le badge. Seule l'empreinte est conservée, jamais l'image."));
  hote.appendChild(entete);

  const vue = bloc("Caméra de la passerelle", "flux en direct");
  fluxCamera(vue.corps);
  const mesure = el("p", "note", "");
  vue.corps.appendChild(mesure);
  hote.appendChild(vue.section);

  const enrolement = bloc("Enrôlement", "");
  const cible = el("p", "intro",
    "Cadrez le visage, variez légèrement l'angle entre chaque prise.");
  enrolement.corps.appendChild(cible);

  const choix = el("select", "champ");
  choix.id = "membre-a-enroler";
  const commandes = el("div", "commandes");
  const capturer = el("button", "action", "Capturer un gabarit");
  capturer.type = "button";
  const tester = el("button", "action secondaire", "Tester la reconnaissance");
  tester.type = "button";
  commandes.append(choix, capturer, tester);
  enrolement.corps.appendChild(commandes);

  const retour = el("p", "verdict", "");
  enrolement.corps.appendChild(retour);
  hote.appendChild(enrolement.section);

  const listeBloc = bloc("Membres enrôlés", "");
  const liste = el("div", "liste-visage");
  listeBloc.corps.appendChild(liste);
  hote.appendChild(listeBloc.section);

  const etatMembres = await json("/api/etat");
  const noms = [...etatMembres.equipage.map((m) => m.nom)];
  if (session?.acteur && !noms.includes(session.acteur)) noms.unshift(session.acteur);
  for (const nom of noms) {
    const o = el("option", null, nom);
    o.value = nom;
    choix.appendChild(o);
  }
  if (session?.acteur) choix.value = session.acteur;

  async function peindreListe() {
    const d = await json("/api/visage/enroles");
    liste.replaceChildren();
    // Les routes biometriques sont reservees au capitaine : sans cette garde, la vue
    // lisait une liste absente et se cassait au lieu d'expliquer le refus.
    if (d.erreur || !d.membres) {
      liste.appendChild(el("div", "vide",
        d.erreur === "reserve au capitaine identifie"
          ? "L'enrôlement facial est réservé au capitaine identifié. "
            + "Un gabarit vaut une clé : qui peut en déposer un peut se faire passer "
            + "pour n'importe qui."
          : d.erreur || "Liste indisponible."));
      return;
    }
    if (!d.membres.length) {
      liste.appendChild(el("div", "vide", "Personne n'est enrôlé. Le badge suffit encore."));
      return;
    }
    for (const m of d.membres) {
      const ligne = el("div", "rang");
      const nom = el("span", "nom", m.nom);
      nom.appendChild(el("small", null, `${m.gabarits} gabarits sur ${d.cible}`));
      const jauge = el("span", "jauge");
      const barre = el("i");
      barre.style.width = `${Math.min(100, (m.gabarits / d.cible) * 100)}%`;
      barre.style.background = m.gabarits >= d.cible ? "var(--nominal)" : "var(--attention)";
      jauge.appendChild(barre);
      const oublier = el("button", "lien-danger", "oublier");
      oublier.type = "button";
      oublier.addEventListener("click", async () => {
        await fetch(`/api/visage/${encodeURIComponent(m.nom)}`, { method: "DELETE" });
        peindreListe();
      });
      ligne.append(nom, jauge, oublier);
      liste.appendChild(ligne);
    }
  }

  capturer.addEventListener("click", async () => {
    capturer.disabled = true;
    retour.textContent = "Capture…";
    retour.className = "verdict";
    const d = await poster("/api/visage/enroler", { nom: choix.value });
    if (d.erreur) {
      retour.textContent = d.erreur;
      retour.className = "verdict refuse";
    } else {
      retour.textContent = `${d.nom} : ${d.gabarits} gabarits sur ${d.cible}, `
        + `surface ${d.surface} px.`;
      retour.className = d.gabarits >= d.cible ? "verdict accorde" : "verdict";
    }
    capturer.disabled = false;
    peindreListe();
  });

  tester.addEventListener("click", async () => {
    tester.disabled = true;
    retour.textContent = `Contrôle de ${choix.value}, présentez votre visage…`;
    retour.className = "verdict";
    const d = await poster("/api/visage/verifier", { nom: choix.value });
    retour.textContent = `${d.nom} : ${d.motif}`;
    retour.className = `verdict ${d.accorde ? "accorde" : "refuse"}`;
    tester.disabled = false;
  });

  const minuteur = setInterval(async () => {
    const e = await json("/api/camera/etat").catch(() => null);
    if (!e) return;
    mesure.textContent = e.erreur
      ? `Caméra : ${e.erreur}`
      : e.visage
        ? `Visage détecté, surface ${e.surface} px. Seuil de reconnaissance ${e.seuil}.`
        : `Aucun visage cadré. Seuil de reconnaissance ${e.seuil}.`;
  }, 1000);

  await peindreListe();
  return minuteur;
}
