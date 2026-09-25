import { useEffect, useState } from "react";
import { useDelayRender } from "remotion";
import { policesChargees } from "./polices";

export const AttentePolices: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [attente] = useState(() => delayRender("polices de la charte"));
  useEffect(() => {
    policesChargees.then(() => continueRender(attente), cancelRender);
  }, [attente, continueRender, cancelRender]);
  return <>{children}</>;
};
