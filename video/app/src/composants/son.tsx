import { Audio } from "@remotion/media";
import { staticFile, type VolumeProp } from "remotion";

export type NomSfx =
  | "telemetrie-bip"
  | "grondement-vaisseau"
  | "clic-validation"
  | "balayage-scan"
  | "verrouillage"
  | "tic-point"
  | "buzzer-refus"
  | "alarme"
  | "porte-etanche"
  | "rembobinage"
  | "impact-titre"
  | "whoosh"
  | "pulsation";

export type SfxProps = {
  nom: NomSfx;
  a: number;
  volume?: VolumeProp;
  decoupe?: number;
  duree?: number;
};

export const Sfx: React.FC<SfxProps> = ({ nom, a, volume = 0.4, decoupe, duree }) => (
  <Audio
    name={`sfx ${nom}`}
    src={staticFile(`audio/sfx/${nom}.wav`)}
    from={Math.round(a)}
    durationInFrames={duree}
    trimBefore={decoupe}
    volume={volume}
  />
);
