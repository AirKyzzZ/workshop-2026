import { AbsoluteFill } from "remotion";
import { couleurs, polices, tailles } from "../charte";

export const CartonProvisoire: React.FC<{ id: string; texte?: string }> = ({ id, texte }) => (
  <AbsoluteFill
    style={{
      backgroundColor: couleurs.panneau,
      justifyContent: "center",
      alignItems: "center",
      gap: 32,
      padding: 160,
      textAlign: "center",
    }}
  >
    <div style={{ fontFamily: polices.donnees, fontSize: tailles.etiquette, color: couleurs.attention, letterSpacing: "0.2em" }}>
      SCÈNE {id} · PROVISOIRE
    </div>
    {texte ? (
      <div style={{ fontFamily: polices.interface, fontSize: tailles.texte, color: couleurs.texteDoux, maxWidth: 1400 }}>{texte}</div>
    ) : null}
  </AbsoluteFill>
);
