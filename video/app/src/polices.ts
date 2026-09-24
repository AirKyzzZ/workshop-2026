import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const fichiers = [
  { family: "Teko", url: "fonts/Teko-Medium.ttf", weight: "500" },
  { family: "Teko", url: "fonts/Teko-SemiBold.ttf", weight: "600" },
  { family: "Inter", url: "fonts/Inter-Regular.ttf", weight: "400" },
  { family: "Inter", url: "fonts/Inter-SemiBold.ttf", weight: "600" },
  { family: "Martian Mono", url: "fonts/MartianMono-Regular.ttf", weight: "400" },
  { family: "Martian Mono", url: "fonts/MartianMono-SemiBold.ttf", weight: "600" },
];

export const policesChargees = Promise.all(
  fichiers.map((f) => loadFont({ family: f.family, url: staticFile(f.url), weight: f.weight })),
);
