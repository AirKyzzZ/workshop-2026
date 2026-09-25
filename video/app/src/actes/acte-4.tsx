import type React from "react";
import { Controles } from "./acte-4/controles";
import { DernierMot } from "./acte-4/dernier-mot";
import { JournalDecisions } from "./acte-4/journal-decisions";
import { Refus } from "./acte-4/refus";

export const scenesActe4: Record<string, React.FC> = {
  "4.1": Controles,
  "4.2": Refus,
  "4.3": DernierMot,
  "4.4": JournalDecisions,
};
