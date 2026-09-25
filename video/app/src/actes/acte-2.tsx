import type React from "react";
import { Questionnaire } from "./acte-2/questionnaire";
import { SansReleve } from "./acte-2/sans-releve";
import { SystemesVitaux } from "./acte-2/systemes-vitaux";
import { These } from "./acte-2/these";

export const scenesActe2: Record<string, React.FC> = {
  "2.1": SystemesVitaux,
  "2.2": Questionnaire,
  "2.3": SansReleve,
  "2.4": These,
};
