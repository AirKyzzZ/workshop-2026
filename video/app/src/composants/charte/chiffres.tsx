import type React from "react";
import { Fragment } from "react";

export const PONCTUATION_RESSERREE = 0.36;

export const Chiffres: React.FC<{ texte: string }> = ({ texte }) => (
  <>
    {texte.split(/([,:])/).map((morceau, i) =>
      morceau === "," || morceau === ":" ? (
        <span key={i} style={{ marginInline: `-${PONCTUATION_RESSERREE / 2}em` }}>
          {morceau}
        </span>
      ) : (
        <Fragment key={i}>{morceau}</Fragment>
      ),
    )}
  </>
);
