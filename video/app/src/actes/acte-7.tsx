import type React from "react";
import { CartonFinal } from "./acte-7/carton-final";
import { Installation } from "./acte-7/installation";
import { Memoire } from "./acte-7/memoire";
import { UneSeuleSolution } from "./acte-7/une-seule-solution";

export const scenesActe7: Record<string, React.FC> = {
  "7.1": Installation,
  "7.2": Memoire,
  "7.3": UneSeuleSolution,
  "7.4": CartonFinal,
};
