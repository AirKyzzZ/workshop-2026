import type React from "react";
import { CeQuElleSait } from "./acte-3/ce-qu-elle-sait";
import { CeQueCaChange } from "./acte-3/ce-que-ca-change";
import { CeQuiSEntend } from "./acte-3/ce-qui-s-entend";
import { CeQuiSeVoit } from "./acte-3/ce-qui-se-voit";
import { Ou } from "./acte-3/ou";
import { Ouverture } from "./acte-3/ouverture";
import { Qui } from "./acte-3/qui";
import { QuiLAFait } from "./acte-3/qui-l-a-fait";

export const scenesActe3: Record<string, React.FC> = {
  "3.1": Ouverture,
  "3.2": Qui,
  "3.3": Ou,
  "3.4": CeQuiSEntend,
  "3.5": CeQuiSeVoit,
  "3.6": QuiLAFait,
  "3.7": CeQueCaChange,
  "3.8": CeQuElleSait,
};
