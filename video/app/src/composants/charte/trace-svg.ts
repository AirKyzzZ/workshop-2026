import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

export type TraceSvg = { largeur: number; hauteur: number; transform?: string; formes: string[] };

export const useTraceSvg = (fichier: string) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [attente] = useState(() => delayRender(`Tracé ${fichier}`));
  const [trace, setTrace] = useState<TraceSvg | null>(null);

  useEffect(() => {
    fetch(staticFile(fichier))
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`${fichier} introuvable (HTTP ${reponse.status})`);
        return reponse.text();
      })
      .then((source) => {
        const document = new DOMParser().parseFromString(source, "image/svg+xml");
        const [, , largeur, hauteur] = (document.documentElement.getAttribute("viewBox") ?? "").trim().split(/\s+/).map(Number);
        const d = document.querySelector("path")?.getAttribute("d");
        if (!d || !largeur || !hauteur) throw new Error(`${fichier} : viewBox ou tracé manquant`);
        setTrace({
          largeur,
          hauteur,
          transform: document.querySelector("g")?.getAttribute("transform") ?? undefined,
          formes: d
            .split(/(?=M)/)
            .map((forme) => forme.trim())
            .filter(Boolean),
        });
        continueRender(attente);
      })
      .catch((erreur: unknown) => cancelRender(erreur));
  }, [fichier, attente, continueRender, cancelRender]);

  return trace;
};
