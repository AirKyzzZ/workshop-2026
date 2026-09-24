import { bloc, el, heure, json } from "./ui.js";

const poster = (url, corps) =>
  fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).then((r) => r.json());

function bouton(libelle, classe, action) {
  const b = el("button", `action ${classe}`, libelle);
  b.type = "button";
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await action();
    } finally {
      b.disabled = false;
    }
  });
  return b;
}

function jauge(valeur, teinte) {
  const piste = el("span", "piste");
  const i = el("i");
  i.style.width = `${Math.max(0, Math.min(100, valeur * 100))}%`;
  i.style.background = teinte;
  piste.appendChild(i);
  return piste;
}

function paireGrande(libelle, valeur, teinte) {
  const d = el("div", "mesure-grande");
  const v = el("span", "chiffre", valeur);
  if (teinte) v.style.color = teinte;
  d.append(v, el("span", "etiquette", libelle));
  return d;
}

function panneauPouls(corps, d, rafraichir) {
  corps.replaceChildren();
  corps.appendChild(el("p", "intro",
    "Le seul relevé physiologique du bord qui ne soit pas simulé. Un doigt posé à plat "
    + "sur le capteur du nœud, la carte détecte chaque battement, et le relevé est écrit "
    + "au dossier de la personne que la caméra reconnaît au même moment : un capteur ne "
    + "sait pas qui le touche, seule l'identification le sait."));

  if (d.actif) {
    const avancement = 1 - d.reste_s / d.duree_s;
    corps.appendChild(jauge(avancement, "var(--critique)"));

    const chiffres = el("div", "grille-grande");
    chiffres.appendChild(paireGrande("battements", String(d.battements)));
    chiffres.appendChild(paireGrande("fréquence",
      d.hr_courant ? `${d.hr_courant}` : "—",
      d.hr_courant ? "var(--critique)" : null));
    chiffres.appendChild(paireGrande("secondes restantes", String(Math.ceil(d.reste_s))));
    corps.appendChild(chiffres);

    corps.appendChild(el("p", "note", d.crew
      ? `Relevé attribué à ${d.crew}, reconnu par la caméra.`
      : "Aucun visage reconnu : le relevé ne sera rattaché à personne."));
    corps.appendChild(bouton("Arrêter", "", async () => {
      await poster("/api/pouls", { actif: false });
      rafraichir();
    }));
    return;
  }

  const r = d.resultat;
  if (r && r.erreur) {
    corps.appendChild(el("div", "vide", r.erreur));
  } else if (r) {
    const chiffres = el("div", "grille-grande");
    chiffres.appendChild(paireGrande("battements par minute", String(r.hr),
      "var(--critique)"));
    chiffres.appendChild(paireGrande("RMSSD",
      `${r.rmssd} ms`,
      r.rmssd < 20 ? "var(--critique)" : r.rmssd < 40 ? "var(--attention)"
        : "var(--nominal)"));
    chiffres.appendChild(paireGrande("stress déduit", r.stress.toFixed(2)));
    corps.appendChild(chiffres);
    corps.appendChild(el("p", "verdict-detail",
      `${r.battements} battements en ${r.secondes} s`
      + (r.crew ? ` · écrit au dossier de ${r.crew}` : " · non attribué")
      + ` · ${heure(r.ts)}`));
    corps.appendChild(el("p", "note", r.fiable
      ? "La variabilité se lit dans le RMSSD : élevé, le système nerveux est détendu ; "
        + "effondré, il est sous tension. C'est cette valeur que le régulateur utilise."
      : "Moins de douze battements : la fréquence tient, la variabilité est indicative."));
  }

  const commandes = el("div", "rangee-actions");
  for (const secondes of [20, 30, 45]) {
    commandes.appendChild(bouton(`Audit ${secondes} s`,
      secondes === 30 ? "danger" : "", async () => {
        await poster("/api/pouls", { secondes });
        rafraichir();
      }));
  }
  corps.appendChild(commandes);
  if (!d.noeud && d.arme === false) {
    corps.appendChild(el("p", "note",
      "Le capteur se câble sur A0 du nœud de compartiment."));
  }
}

function panneauEcoute(corps, d, rafraichir) {
  corps.replaceChildren();
  corps.appendChild(el("p", "intro",
    "Deux modèles se partagent le même flux audio. YAMNet reconnaît des types de sons, "
    + "jamais des mots : une toux, un cri, un bris de verre. Vosk transcrit le français "
    + "en local et entend les mots du lexique. Les deux font tomber la conduite, mais "
    + "pas pour la même raison."));

  const e = d.ecoute || {};
  const arme = (d.modules || []).some((m) => m.actif);
  const reste = Math.max(...(d.modules || []).map((m) => m.reste_s || 0), 0);

  if (arme) {
    corps.appendChild(el("p", "verdict-titre",
      `ÉCOUTE ACTIVE · ${Math.ceil(reste / 60)} MIN RESTANTES`));

    const chiffres = el("div", "grille-grande");
    chiffres.appendChild(paireGrande("niveau", String(e.niveau ?? 0)));
    chiffres.appendChild(paireGrande("latence",
      e.latence_ms ? `${e.latence_ms} ms` : "—"));
    chiffres.appendChild(paireGrande("événements", String(e.evenements ?? 0)));
    corps.appendChild(chiffres);

    if (e.classes && e.classes.length) {
      const liste = el("div", "classes-audio");
      for (const c of e.classes.slice(0, 5)) {
        const ligne = el("div", "classe");
        ligne.appendChild(el("span", "etiquette", c.nom));
        ligne.appendChild(jauge(c.score, "var(--trait-fort)"));
        ligne.appendChild(el("span", "mesure", c.score.toFixed(2)));
        liste.appendChild(ligne);
      }
      corps.appendChild(liste);
    }

    if (e.transcription) {
      const t = el("p", "transcription");
      t.append("« ", e.transcription, " »");
      corps.appendChild(t);
    }
  }

  const commandes = el("div", "rangee-actions");
  commandes.appendChild(bouton(arme ? "Couper l'écoute" : "Écoute active · 3 min",
    arme ? "" : "danger", async () => {
      await poster("/api/ecoute", { actif: !arme, minutes: 3 });
      rafraichir();
    }));
  corps.appendChild(commandes);

  if (d.incidents && d.incidents.length) {
    corps.appendChild(el("p", "verdict-titre", "CE QUI A ÉTÉ RETENU"));
    for (const i of d.incidents) {
      const ligne = el("div", "rang");
      const nom = el("span", "nom", i.type.replace("_", " "));
      nom.appendChild(el("small", null,
        `${i.detail || ""} · ${i.crew || "non attribué"} · ${heure(i.ts)}`));
      const v = el("span", "val", i.gravite.toFixed(2));
      v.style.color = i.gravite >= 0.5 ? "var(--critique)" : "var(--attention)";
      ligne.append(nom, v);
      corps.appendChild(ligne);
    }
  }

  if (d.lexique) {
    corps.appendChild(el("p", "note",
      `Les mots les plus lourds du lexique : ${d.lexique.slice(0, 5).join(", ")}. `
      + "La gravité suit l'intention et non la vulgarité : un juron d'exaspération "
      + "coûte dix fois moins qu'une menace."));
  }
}

export async function vueMesures(hote) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Mesures"));
  entete.appendChild(el("span", "sous-titre",
    "Les deux capteurs qu'on déclenche à la demande, pendant que le reste tourne seul."));
  hote.appendChild(entete);

  const cardiaque = bloc("Audit cardiaque", "capteur de pouls du nœud");
  hote.appendChild(cardiaque.section);
  const audio = bloc("Écoute active", "YAMNet et Vosk, en local");
  hote.appendChild(audio.section);

  async function peindre() {
    const [p, e] = await Promise.all([
      json("/api/pouls").catch(() => null),
      json("/api/ecoute").catch(() => null),
    ]);
    if (p) panneauPouls(cardiaque.corps, p, peindre);
    if (e) panneauEcoute(audio.corps, e, peindre);
  }

  await peindre();
  return setInterval(peindre, 1000);
}
