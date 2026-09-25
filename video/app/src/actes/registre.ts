import type React from "react";
import { scenesActe1 } from "./acte-1";
import { scenesActe2 } from "./acte-2";
import { scenesActe3 } from "./acte-3";
import { scenesActe4 } from "./acte-4";
import { scenesActe5 } from "./acte-5";
import { scenesActe6 } from "./acte-6";
import { scenesActe7 } from "./acte-7";

export const registre: Partial<Record<string, React.FC>> = {
  ...scenesActe1,
  ...scenesActe2,
  ...scenesActe3,
  ...scenesActe4,
  ...scenesActe5,
  ...scenesActe6,
  ...scenesActe7,
};
