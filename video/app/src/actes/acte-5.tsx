import type React from "react";
import { ChaqueEquipier } from "./acte-5/chaque-equipier";
import { Conflits } from "./acte-5/conflits";
import { Contagion } from "./acte-5/contagion";
import { Incendie } from "./acte-5/incendie";
import { OndeDeStress } from "./acte-5/onde-de-stress";
import { ToutLeVaisseau } from "./acte-5/tout-le-vaisseau";

export const scenesActe5: Record<string, React.FC> = {
  "5.1": ToutLeVaisseau,
  "5.2": ChaqueEquipier,
  "5.3": Incendie,
  "5.4": Contagion,
  "5.5": Conflits,
  "5.6": OndeDeStress,
};
