import type React from "react";
import { AvantLaFlamme } from "./acte-6/avant-la-flamme";
import { Infection } from "./acte-6/infection";
import { PlaisanterieOuMenace } from "./acte-6/plaisanterie-ou-menace";
import { Schemas } from "./acte-6/schemas";
import { Ton } from "./acte-6/ton";
import { VoitVenir } from "./acte-6/voit-venir";

export const scenesActe6: Record<string, React.FC> = {
  "6.1": VoitVenir,
  "6.2": Ton,
  "6.3": PlaisanterieOuMenace,
  "6.4": Schemas,
  "6.5": Infection,
  "6.6": AvantLaFlamme,
};
