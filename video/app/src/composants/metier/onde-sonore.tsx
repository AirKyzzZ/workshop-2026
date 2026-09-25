import { interpolate, random, useCurrentFrame } from "remotion";
import { couleurs, polices } from "../../charte";
import { alpha, couleurNiveau, progression, type Niveau } from "./commun";

export type EvenementSonore = { frame: number; duree: number; niveau: number; ton?: Niveau; libelle?: string };

export type OndeSonoreProps = {
  largeur: number;
  hauteur: number;
  graine: string;
  evenements: EvenementSonore[];
  fond?: number;
  pas?: number;
  framesParBarre?: number;
  debut?: number;
};

const ATTAQUE = 5;

const enveloppe = (e: EvenementSonore, f: number): number =>
  e.niveau *
  interpolate(f, [e.frame - ATTAQUE, e.frame, e.frame + e.duree, e.frame + e.duree + ATTAQUE * 2], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const OndeSonore: React.FC<OndeSonoreProps> = ({
  largeur,
  hauteur,
  graine,
  evenements,
  fond = 0.06,
  pas = 12,
  framesParBarre = 2,
  debut = 0,
}) => {
  const frame = useCurrentFrame();
  const t = frame / framesParBarre;
  const k0 = Math.floor(t);
  const nombre = Math.ceil(largeur / pas) + 1;
  const milieu = hauteur / 2;
  const largeurBarre = pas * 0.42;
  const phase = random(`${graine}-phase`) * Math.PI * 2;
  const pApparition = progression(frame, debut, 20);

  const barres = Array.from({ length: nombre }, (_, i) => {
    const k = k0 - i;
    const x = largeur - (t - k) * pas;
    const f = k * framesParBarre;
    const niveau = fond + evenements.reduce((s, e) => s + enveloppe(e, f), 0);
    const grain = 0.3 + 0.7 * random(`${graine}-${k}`);
    const syllabe = 0.55 + 0.45 * Math.abs(Math.sin(k * 0.55 + phase));
    const amplitude = Math.min(1, niveau * grain * syllabe);
    const ton = evenements.find((e) => e.ton && f >= e.frame && f <= e.frame + e.duree)?.ton;
    return { k, x, amplitude, ton };
  }).filter((b) => b.x > -pas && b.x <= largeur + 0.5);

  const etiquettes = evenements
    .filter((e) => e.libelle && e.ton)
    .map((e) => {
      const xDebut = largeur - (t - e.frame / framesParBarre) * pas;
      const xFin = largeur - (t - (e.frame + e.duree) / framesParBarre) * pas;
      const x = Math.min(largeur - 8, Math.max(xDebut, 8));
      const visible = frame >= e.frame && xFin > -pas;
      return { e, x, xDebut, xFin: Math.min(xFin, largeur), visible };
    })
    .filter((l) => l.visible);

  return (
    <svg width={largeur} height={hauteur + 70} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`onde-fondu-${graine}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`onde-masque-${graine}`}>
          <rect x={-pas} y={0} width={largeur + pas * 2} height={hauteur + 70} fill={`url(#onde-fondu-${graine})`} />
        </mask>
      </defs>

      <g transform="translate(0 70)">
        <line x1={0} y1={milieu} x2={largeur} y2={milieu} stroke={alpha(couleurs.texte, 0.12)} strokeWidth={1} />
        <g
          mask={`url(#onde-masque-${graine})`}
          style={{ scale: `1 ${pApparition}`, transformOrigin: `0px ${milieu}px`, opacity: pApparition }}
        >
          {barres.map((b) => {
            const h = Math.max(3, b.amplitude * hauteur * 0.92);
            return (
              <rect
                key={b.k}
                x={b.x - largeurBarre / 2}
                y={milieu - h / 2}
                width={largeurBarre}
                height={h}
                rx={largeurBarre / 2}
                fill={b.ton ? couleurNiveau(b.ton) : couleurs.texte}
                opacity={b.ton ? 1 : 0.82}
              />
            );
          })}
        </g>
        <line x1={largeur} y1={0} x2={largeur} y2={hauteur} stroke={couleurs.texteDoux} strokeWidth={1.5} opacity={pApparition} />
        <circle cx={largeur} cy={milieu} r={5} fill={couleurs.blanc} opacity={pApparition} />
      </g>

      {etiquettes.map(({ e, x, xDebut, xFin }) => {
        const couleur = couleurNiveau(e.ton ?? "attention");
        const p = progression(frame, e.frame, 12);
        const gauche = Math.max(0, xDebut);
        return (
          <g key={`${e.frame}-${e.libelle}`} opacity={p}>
            <line x1={gauche} y1={52} x2={xFin} y2={52} stroke={couleur} strokeWidth={2} />
            <line x1={gauche} y1={46} x2={gauche} y2={58} stroke={couleur} strokeWidth={2} />
            <text
              x={x}
              y={30}
              fill={couleur}
              fontFamily={polices.donnees}
              fontSize={24}
              letterSpacing="0.06em"
              textAnchor={x > largeur - 260 ? "end" : "start"}
            >
              {e.libelle}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
