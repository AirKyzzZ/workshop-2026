import { Audio } from "@remotion/media";
import { AbsoluteFill, Series, staticFile } from "remotion";
import { registre } from "./actes/registre";
import { AttentePolices } from "./attente-polices";
import { couleurs } from "./charte";
import { CartonProvisoire } from "./composants/carton-provisoire";
import { FPS, repliques, scenes } from "./donnees";
import { framesScene, type Scene } from "./timing";

export const SuiteDeScenes: React.FC<{ liste: Scene[] }> = ({ liste }) => (
  <AttentePolices>
    <AbsoluteFill style={{ backgroundColor: couleurs.fond }}>
      <Series>
        {liste.map((scene) => {
          const replique = repliques[scene.id];
          const Contenu = registre[scene.id];
          return (
            <Series.Sequence
              key={scene.id}
              name={`Scène ${scene.id}`}
              durationInFrames={framesScene(scene, replique, FPS)}
            >
              {Contenu ? (
                <Contenu />
              ) : (
                <CartonProvisoire id={scene.id} texte={replique?.texte} />
              )}
              {replique?.genere ? (
                <Audio src={staticFile(replique.fichier)} />
              ) : null}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  </AttentePolices>
);

export const VideoComplete: React.FC = () => <SuiteDeScenes liste={scenes} />;

export const Acte: React.FC<{ acte: number }> = ({ acte }) => (
  <SuiteDeScenes liste={scenes.filter((s) => s.acte === acte)} />
);
