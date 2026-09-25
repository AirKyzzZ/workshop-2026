import "./index.css";
import { Composition, Folder } from "remotion";
import { AttentePolices } from "./attente-polices";
import { FPS, repliques, scenes } from "./donnees";
import { framesScene, framesTotal } from "./timing";
import { Acte, VideoComplete } from "./video";
import { demosCharte } from "./vitrine/charte";
import { demosMetier } from "./vitrine/metier";

const framesActe = (acte: number) =>
  scenes
    .filter((s) => s.acte === acte)
    .reduce((t, s) => t + framesScene(s, repliques[s.id], FPS), 0);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="AtriaNational"
      component={VideoComplete}
      durationInFrames={framesTotal(scenes, repliques, FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Folder name="Actes">
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <Composition
          key={n}
          id={`Acte${n}`}
          component={Acte}
          defaultProps={{ acte: n }}
          durationInFrames={framesActe(n)}
          fps={FPS}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
    <Folder name="Vitrine">
      {[...demosCharte, ...demosMetier].map((d) => (
        <Composition
          key={d.id}
          id={d.id}
          component={() => (
            <AttentePolices>
              <d.composant />
            </AttentePolices>
          )}
          durationInFrames={Math.round(d.dureeS * FPS)}
          fps={FPS}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
  </>
);
