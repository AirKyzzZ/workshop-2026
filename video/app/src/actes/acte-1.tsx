import type React from "react";
import { Embrouille } from "./acte-1/embrouille";
import { Ordre } from "./acte-1/ordre";
import { OrdreEnAttente } from "./acte-1/ordre-en-attente";
import { Telemetrie } from "./acte-1/telemetrie";

export const scenesActe1: Record<string, React.FC> = {
  "1.1": Telemetrie,
  "1.2": Embrouille,
  "1.3": Ordre,
  "1.4": OrdreEnAttente,
};
