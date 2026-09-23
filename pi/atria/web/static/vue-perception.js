import { bloc, el, heure, json } from "./ui.js";
import { fluxCamera } from "./vue-visage.js";

const DOIGTS = ["pouce", "index", "majeur", "annulaire", "auriculaire"];

function barre(libelle, valeur, teinte, echelle = 1) {
  const ligne = el("div", "mesure-barre");
  ligne.appendChild(el("span", "etiquette", libelle));
  const piste = el("span", "piste");
  const remplissage = el("i");
  remplissage.style.width = `${Math.max(0, Math.min(100, (valeur / echelle) * 100))}%`;
  remplissage.style.background = teinte;
  piste.appendChild(remplissage);
  const val = el("span", "mesure", valeur.toFixed(2));
  ligne.append(piste, val);
  return ligne;
}

function carteModele(nom, role, etat) {
  const carte = el("div", "carte-modele");
  const entete = el("div", "carte-entete");
  entete.appendChild(el("strong", null, nom));
  const pastille = el("span", "pastille " + (etat.actif ? "vive" : "morte"),
    etat.detail || (etat.actif ? "actif" : "inactif"));
  entete.appendChild(pastille);
  carte.appendChild(entete);
  carte.appendChild(el("p", "role-modele", role));
  return carte;
}

export async function vuePerception(hote) {
  const entete = el("div", "entete-page");
  entete.appendChild(el("h1", null, "Perception"));
  entete.appendChild(el("span", "sous-titre",
    "Cinq modèles tournent sur la carte, sans réseau. Voici ce qu'ils lisent, à l'instant."));
  hote.appendChild(entete);

  const duo = el("div", "duo-perception");
  const flux = bloc("Caméra de la passerelle", "détections incrustées");
  fluxCamera(flux.corps);
  duo.appendChild(flux.section);

  const zone = el("div", "grille-modeles");
  duo.appendChild(zone);
  hote.appendChild(duo);

  const bas = el("div", "pile-perception");
  hote.appendChild(bas);

  async function peindre() {
    let d;
    try {
      d = await json("/api/perception");
    } catch {
      return;
    }
    const c = d.camera || {};
    const s = c.surveillance || {};
    const o = s.observation || {};
    const e = d.ecoute || {};
    zone.replaceChildren();

    const yunet = carteModele("YuNet", "détection de visage, ONNX",
      { actif: c.visage, detail: c.visage ? "1 visage" : "aucun visage" });
    yunet.appendChild(barre("surface cadrée", Math.min(1, (c.surface || 0) / 60000),
      "var(--nominal)"));
    zone.appendChild(yunet);

    const sface = carteModele("SFace", "empreinte 128 réels, identification",
      { actif: Boolean(c.auteur), detail: c.auteur || "non attribué" });
    sface.appendChild(el("p", "verdict-detail",
      `seuil cosinus ${d.seuils.cosinus} · au-dessus, même personne`));
    zone.appendChild(sface);

    const visageMp = carteModele("Face Landmarker", "52 coefficients d'expression",
      { actif: Boolean(o.visages), detail: o.visages ? `${o.visages} visage` : "aucun" });
    visageMp.appendChild(barre("hostilité", o.hostilite || 0,
      (o.hostilite || 0) >= d.seuils.hostilite ? "var(--critique)" : "var(--attention)"));
    if (o.paupieres) {
      visageMp.appendChild(barre("paupières closes", o.paupieres[0], "var(--attention)"));
      visageMp.appendChild(barre("mâchoire ouverte", o.paupieres[1], "var(--attention)"));
    }
    for (const x of (o.expressions || []).slice(0, 4)) {
      visageMp.appendChild(barre(x.nom, x.score, "var(--trait-fort)"));
    }
    zone.appendChild(visageMp);

    const mains = carteModele("Hand Landmarker", "21 points, géométrie 3D",
      { actif: Boolean(o.mains),
        detail: (o.gestes || []).find((g) => g !== "aucun") || (o.mains ? "main" : "aucune") });
    for (const ratios of o.ratios || []) {
      for (const nom of DOIGTS) {
        const r = ratios[nom] ?? 0;
        mains.appendChild(barre(nom, r,
          r >= d.seuils.ratio_doigt ? "var(--nominal)" : "var(--trait-fort)", 2.2));
      }
    }
    if (!o.mains) {
      mains.appendChild(el("p", "note", "Levez une main devant l'objectif."));
    } else {
      mains.appendChild(el("p", "verdict-detail",
        `tendu au-delà de ${d.seuils.ratio_doigt} fois la longueur de la phalange`));
    }
    zone.appendChild(mains);

    const audio = carteModele("YAMNet", "521 classes sonores, TFLite",
      { actif: e.actif, detail: e.latence_ms ? `${e.latence_ms} ms / 3 s` : "hors ligne" });
    if (e.classes && e.classes.length) {
      for (const x of e.classes.slice(0, 5)) {
        const critique = ["Shout", "Screaming", "Yell", "Cough", "Sneeze", "Glass"]
          .includes(x.nom);
        audio.appendChild(barre(x.nom, x.score,
          critique ? "var(--critique)" : "var(--trait-fort)"));
      }
    } else {
      audio.appendChild(el("p", "note", "Aucun son classé pour le moment."));
    }
    audio.appendChild(el("p", "verdict-detail",
      `micro ${e.compartiment || "—"} · niveau ${e.niveau ?? 0} · ${e.evenements || 0} événements`));
    zone.appendChild(audio);

    const soc = carteModele("Garde thermique", "le SoC avant la fonctionnalité",
      { actif: !s.en_pause, detail: s.en_pause ? "suspendu" : "en service" });
    soc.appendChild(barre("température", (d.temperature_c || 0) / 100,
      d.temperature_c >= d.seuils.temp_max_c ? "var(--critique)"
        : d.temperature_c >= d.seuils.temp_reprise_c ? "var(--attention)" : "var(--nominal)"));
    soc.appendChild(el("p", "verdict-detail",
      `${(d.temperature_c || 0).toFixed(1)} °C · coupure ${d.seuils.temp_max_c} °C, `
      + `reprise ${d.seuils.temp_reprise_c} °C`));
    if (s.motif_pause) soc.appendChild(el("p", "note", s.motif_pause));
    zone.appendChild(soc);

    bas.replaceChildren();

    const fatigue = bloc("Somnolence observée", "PERCLOS sur fenêtre glissante");
    fatigue.corps.appendChild(el("p", "intro",
      "La part du temps où les paupières restent closes, plus les bâillements. "
      + "À une image par seconde un clignement de 150 ms passe entre deux mesures : "
      + "ce qui se mesure ici, ce sont les fermetures qui durent. "
      + "Chaque relevé écrit un point de capacité, et le régulateur s'en sert sans "
      + "rien savoir de la caméra."));
    if (!d.fatigues.length) {
      fatigue.corps.appendChild(el("div", "vide", "Aucune observation depuis 6 heures."));
    } else {
      for (const f of d.fatigues) {
        const ligne = el("div", "rang");
        const nom = el("span", "nom", f.crew);
        nom.appendChild(el("small", null,
          `PERCLOS ${f.perclos.toFixed(2)} · ${f.baillements} bâillement(s) `
          + `· ${f.echantillons} images · ${heure(f.ts)}`));
        const val = el("span", "val", f.indice.toFixed(2));
        val.style.color = f.indice >= 0.5 ? "var(--critique)" : "var(--attention)";
        ligne.append(nom, val);
        fatigue.corps.appendChild(ligne);
      }
    }
    bas.appendChild(fatigue.section);

    const contagion = bloc("Contagion physique", "entendue, puis tracée");
    contagion.corps.appendChild(el("p", "intro",
      "Une toux est rattachée au compartiment et non à quelqu'un : un micro ne sait pas "
      + "qui a toussé, et le graphe de co-présence sait déjà qui s'y trouvait. "
      + "Le second rang est celui qu'on ne voit pas venir."));
    if (!d.contagion.length) {
      contagion.corps.appendChild(el("div", "vide", "Aucun symptôme entendu."));
    } else {
      for (const x of d.contagion) {
        const carte = el("div", "carte-menace");
        const tete = el("div", "carte-entete");
        tete.appendChild(el("strong", null, `${x.type} · ${x.compartiment}`));
        tete.appendChild(el("span", "mono", heure(x.ts)));
        carte.appendChild(tete);
        carte.appendChild(el("p", null,
          `Foyer : ${x.foyer.join(", ") || "compartiment vide"}.`));
        if (x.rang2.length) {
          carte.appendChild(el("p", "verdict-detail",
            "Second rang : "
            + x.rang2.map((v) => `${v.nom} (${v.minutes} min)`).join(", ")));
        }
        contagion.corps.appendChild(carte);
      }
    }
    bas.appendChild(contagion.section);
  }

  await peindre();
  return setInterval(peindre, 1200);
}
