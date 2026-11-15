import { useId, type ReactNode } from 'react';
import {
  type AvatarConfig,
  EYE_COLORS,
  HAIR_COLORS,
  MOUTH_COLORS,
  MUSTACHE_COLORS,
  SKIN_TONES,
} from '@/games/avatar';

/** Oscurece (amount < 0) o aclara (amount > 0) un color #RRGGBB. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(Math.min(255, Math.max(0, channel + (amount < 0 ? channel : 255 - channel) * amount)));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface Hair {
  back?: ReactNode;
  front?: ReactNode;
}

/** Cabello: `back` va detrás de la cabeza (volumen, melena) y `front` encima (flequillo, copete). */
function hairShapes(style: number, color: string): Hair {
  const dark = shade(color, -0.28);
  const light = shade(color, 0.22);
  const strand = (d: string) => <path d={d} fill="none" stroke={light} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />;
  switch (style) {
    case 0: // rapado
      return { front: <path d="M27 46 C25 28 37 21 50 21 C63 21 75 28 73 46 C70 37 62 32 50 32 C38 32 30 37 27 46Z" fill={color} opacity={0.92} /> };
    case 1: // corto
      return {
        front: (
          <>
            <path d="M25.5 49 C20 24 40 14 52 15 C68 16 80 28 74.5 49 C72 39 66 33 58 30.5 C50 35 37 33 30 38 C28 41 27 45 25.5 49Z" fill={color} />
            {strand('M40 21 C46 19 54 19 62 22')}
          </>
        ),
      };
    case 2: // raya al lado
      return {
        front: (
          <>
            <path d="M25.5 50 C19 22 42 12 57 15 C73 18 81 31 74.5 50 C72 41 68 34 60 30 C52 33 38 30 29 40 C27 43 26 46 25.5 50Z" fill={color} />
            <path d="M36 22 C40 28 46 31 52 31" fill="none" stroke={dark} strokeWidth={1.2} strokeLinecap="round" />
            {strand('M44 17 C54 15 64 19 70 25')}
          </>
        ),
      };
    case 3: // ondulado
      return {
        front: (
          <>
            <path d="M25 50 C19 31 24 17 38 14 C42 10 49 11 52 14 C58 10 68 12 71 18 C79 22 81 36 75 50 C73 41 68 34 61 31 C55 36 47 33 41 31 C34 34 29 41 25 50Z" fill={color} />
            {strand('M33 21 C40 16 48 18 53 21')}
          </>
        ),
      };
    case 4: // copete
      return {
        front: (
          <>
            <path d="M26 50 C20 28 26 10 46 8 C62 6 76 14 76 34 C77 40 75 45 74 50 C72 41 67 35 60 31 C52 28 40 28 31 37 C28 41 27 45 26 50Z" fill={color} />
            {strand('M34 16 C44 10 58 11 67 18')}
          </>
        ),
      };
    case 5: // calvo
      return { front: <path d="M38 27 C44 23 53 23 60 27" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.28} /> };
    case 6: // afro
      return {
        back: <circle cx={50} cy={38} r={35} fill={color} />,
        front: <path d="M27 47 C26 33 36 26 50 26 C64 26 74 33 73 47 C70 38 62 34 50 34 C38 34 30 38 27 47Z" fill={color} />,
      };
    case 7: // rizado
      return {
        back: <circle cx={50} cy={36} r={28} fill={color} />,
        front: (
          <>
            {[
              [30, 36],
              [38, 27],
              [50, 24],
              [62, 27],
              [70, 36],
              [34, 31],
              [66, 31],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={8} fill={color} />
            ))}
            <path d="M28 44 C32 36 42 33 50 33 C58 33 68 36 72 44 C68 40 60 38 50 38 C40 38 32 40 28 44Z" fill={color} />
          </>
        ),
      };
    case 8: // largo liso
      return {
        back: <path d="M23 50 C16 18 38 10 50 10 C62 10 84 18 77 50 L82 92 L66 92 L65 58 L35 58 L34 92 L18 92Z" fill={color} />,
        front: (
          <>
            <path d="M26 48 C27 28 40 20 50 21 C60 20 73 28 74 48 C67 35 58 28 50 26 C42 28 33 35 26 48Z" fill={color} />
            {strand('M50 26 C44 28 36 34 31 42')}
          </>
        ),
      };
    case 9: // largo ondulado
      return {
        back: <path d="M23 50 C16 18 38 10 50 10 C62 10 84 18 77 50 C84 62 78 70 82 80 C84 88 76 94 70 90 C64 84 70 74 64 64 L36 64 C30 74 36 84 30 90 C24 94 16 88 18 80 C22 70 16 62 23 50Z" fill={color} />,
        front: (
          <>
            <path d="M26 48 C27 28 40 20 50 21 C60 20 73 28 74 48 C67 35 58 28 50 26 C42 28 33 35 26 48Z" fill={color} />
            {strand('M50 26 C58 28 66 34 71 42')}
          </>
        ),
      };
    case 10: // melena corta
      return {
        back: <path d="M22.5 54 C16 19 38 11 50 11 C62 11 84 19 77.5 54 L78 66 C74 70 68 67 66 62 L34 62 C32 67 26 70 22 66Z" fill={color} />,
        front: (
          <>
            <path d="M25 48 C26 28 40 19 50 20 C60 19 74 28 75 48 C66 33 58 28 50 27 C42 28 34 33 25 48Z" fill={color} />
            {strand('M50 27 C44 28 36 32 30 40')}
          </>
        ),
      };
    case 11: // cola de caballo
      return {
        back: <path d="M68 30 C90 24 96 54 84 76 C82 66 80 54 72 46Z" fill={color} />,
        front: (
          <>
            <path d="M25.5 49 C20 24 40 14 52 15 C68 16 80 28 74.5 49 C72 39 66 33 58 30.5 C50 35 37 33 30 38 C28 41 27 45 25.5 49Z" fill={color} />
            <circle cx={73} cy={36} r={2.6} fill="#C9504F" />
          </>
        ),
      };
    case 12: // moño
      return {
        back: <circle cx={50} cy={13} r={10} fill={color} />,
        front: (
          <>
            <path d="M26 48 C26 28 38 17 50 17 C62 17 74 28 74 48 C68 36 58 28 50 26 C42 28 32 36 26 48Z" fill={color} />
            <path d="M42 11 C46 8 54 8 58 11" fill="none" stroke={light} strokeWidth={1.1} strokeLinecap="round" opacity={0.6} />
          </>
        ),
      };
    case 13: // rizos largos
      return {
        back: (
          <>
            <circle cx={50} cy={34} r={30} fill={color} />
            {[
              [20, 56],
              [17, 70],
              [22, 84],
              [80, 56],
              [83, 70],
              [78, 84],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={9} fill={color} />
            ))}
          </>
        ),
        front: (
          <>
            {[
              [31, 33],
              [41, 26],
              [52, 24],
              [63, 28],
              [70, 36],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={7.5} fill={color} />
            ))}
            <path d="M28 46 C32 36 42 33 50 33 C58 33 68 36 72 46 C68 41 60 38 50 38 C40 38 32 41 28 46Z" fill={color} />
          </>
        ),
      };
    case 14: // pixie
      return {
        front: (
          <>
            <path d="M25 50 C18 26 36 13 52 14 C70 15 82 28 75 50 C73 41 69 35 61 32 C54 38 42 36 33 35 C29 40 27 45 25 50Z" fill={color} />
            {strand('M40 19 C50 16 62 19 69 26')}
          </>
        ),
      };
    default:
      return {};
  }
}

function Eye({ type, cx, color, flip }: { type: number; cx: number; color: string; flip: boolean }) {
  const white = '#FFFFFF';
  const ink = '#1A1A1A';
  const outline = shade(color, -0.5);
  const hl = (x: number, y: number, r = 0.75) => <circle cx={x} cy={y} r={r} fill="#fff" opacity={0.95} />;
  switch (type) {
    case 1: // grandes
      return (
        <g>
          <ellipse cx={cx} cy={50} rx={5.2} ry={4.8} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.2} r={3.5} fill={color} />
          <circle cx={cx} cy={50.2} r={1.7} fill={ink} />
          {hl(cx + 1.2, 48.8, 1)}
        </g>
      );
    case 2: // almendrados
      return (
        <g>
          <path d={`M${cx - 5.4} 50.4 Q${cx} 45.4 ${cx + 5.4} 50.4 Q${cx} 54.6 ${cx - 5.4} 50.4Z`} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.2} r={2.4} fill={color} />
          <circle cx={cx} cy={50.2} r={1.1} fill={ink} />
          {hl(cx + 0.8, 49.4, 0.6)}
        </g>
      );
    case 3: // cansados
      return (
        <g>
          <ellipse cx={cx} cy={50.4} rx={4.4} ry={3.4} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.6} r={2.6} fill={color} />
          <circle cx={cx} cy={50.6} r={1.2} fill={ink} />
          <path d={`M${cx - 5} 50.6 A5 4 0 0 1 ${cx + 5} 50.6Z`} fill="var(--lid)" />
          <path d={`M${cx - 5} 50.6 L${cx + 5} 50.6`} stroke={outline} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case 4: // serios
      return (
        <g>
          <ellipse cx={cx} cy={50.4} rx={4.6} ry={2.6} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.4} r={2.1} fill={color} />
          <circle cx={cx} cy={50.4} r={1} fill={ink} />
          <path d={`M${cx - 5} 48.2 Q${cx} 46.8 ${cx + 5} 48.2`} fill="none" stroke={outline} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case 5: // sonrientes (cerrados)
      return <path d={`M${cx - 4.4} 51.6 Q${cx} 46 ${cx + 4.4} 51.6`} fill="none" stroke={outline === color ? ink : color} strokeWidth={1.9} strokeLinecap="round" />;
    case 6: {
      // con pestañas
      const s = flip ? -1 : 1;
      return (
        <g>
          <ellipse cx={cx} cy={50.2} rx={4.4} ry={3.7} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.4} r={2.8} fill={color} />
          <circle cx={cx} cy={50.4} r={1.3} fill={ink} />
          {hl(cx + 0.9, 49.2)}
          <path d={`M${cx - 4.8} 49.6 Q${cx} 45.4 ${cx + 4.8} 49.6`} fill="none" stroke={ink} strokeWidth={1.1} strokeLinecap="round" />
          <path d={`M${cx + 4.4 * s} 48.8 L${cx + 6.6 * s} 46.6 M${cx + 3.2 * s} 47.2 L${cx + 4.6 * s} 44.6`} stroke={ink} strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    }
    default: // redondos
      return (
        <g>
          <ellipse cx={cx} cy={50.2} rx={4.2} ry={3.5} fill={white} stroke={outline} strokeWidth={0.5} />
          <circle cx={cx} cy={50.3} r={2.7} fill={color} />
          <circle cx={cx} cy={50.3} r={1.2} fill={ink} />
          {hl(cx + 0.9, 49.2)}
        </g>
      );
  }
}

function Mouth({ type, color }: { type: number; color: string }) {
  const dark = shade(color, -0.4);
  switch (type) {
    case 1: // sonrisa abierta
      return (
        <g>
          <path d="M41 63 Q50 77 59 63 Z" fill="#5A1F1F" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M43.2 64.2 Q50 66.6 56.8 64.2 L56 66 Q50 68.2 44 66Z" fill="#fff" />
        </g>
      );
    case 2: // neutra
      return <path d="M43 66.5 L57 66.5" stroke={color} strokeWidth={2.1} strokeLinecap="round" />;
    case 3: // pícara
      return <path d="M43 66.5 Q51 68 58.5 62.5" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" />;
    case 4: // sorpresa
      return <ellipse cx={50} cy={67.5} rx={3.1} ry={3.8} fill={dark} stroke={color} strokeWidth={1.3} />;
    case 5: // labios carnosos
      return (
        <g>
          <path d="M40.5 65 Q45 61 50 63.4 Q55 61 59.5 65 Q50 74 40.5 65Z" fill={color} />
          <path d="M40.5 65 Q50 67.6 59.5 65" fill="none" stroke={dark} strokeWidth={0.8} strokeLinecap="round" />
          <path d="M45 64 Q50 62.6 55 64" fill="none" stroke="#fff" strokeWidth={0.8} strokeLinecap="round" opacity={0.35} />
        </g>
      );
    case 6: // firme
      return <rect x={43} y={64.8} width={14} height={3.4} rx={1.7} fill={color} />;
    default: // sonrisa
      return <path d="M42 64 Q50 72.5 58 64" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />;
  }
}

function Mustache({ type, color }: { type: number; color: string }) {
  switch (type) {
    case 1: // clásico
      return <path d="M50 60.6 C46 57.4 40 58.6 38.4 63.4 C42 61.6 46 62 50 63.2 C54 62 58 61.6 61.6 63.4 C60 58.6 54 57.4 50 60.6Z" fill={color} />;
    case 2: // fino
      return <path d="M39.5 61.4 Q45 58.8 50 60.6 Q55 58.8 60.5 61.4 Q55 61 50 62.4 Q45 61 39.5 61.4Z" fill={color} />;
    case 3: // grueso
      return <path d="M50 59.2 C44 56.4 37.4 58 36.6 64.2 C41 62 46 62.6 50 63.8 C54 62.6 59 62 63.4 64.2 C62.6 58 56 56.4 50 59.2Z" fill={color} />;
    case 4: // cepillo
      return <path d="M43.5 59.4 H56.5 V63 Q50 61.8 43.5 63Z" fill={color} />;
    case 5: // manubrio
      return (
        <g fill="none" stroke={color} strokeLinecap="round">
          <path d="M38.5 63.4 Q44 58.8 50 61 Q56 58.8 61.5 63.4" strokeWidth={2.8} />
          <path d="M38.5 63.4 Q35 64.4 35 60.6 M61.5 63.4 Q65 64.4 65 60.6" strokeWidth={1.6} />
        </g>
      );
    default:
      return null;
  }
}

interface AvatarSvgProps {
  config: AvatarConfig;
  className?: string;
  title?: string;
}

/** Dibuja un avatar en un cuadrado de 100×100 (el recorte circular lo pone quien lo usa). */
export default function AvatarSvg({ config, className, title }: AvatarSvgProps) {
  const uid = useId().replace(/:/g, '');
  const skin = SKIN_TONES[config.skin];
  const skinDark = shade(skin, -0.16);
  const hairColor = HAIR_COLORS[config.hairColor];
  const hair = hairShapes(config.hairStyle, hairColor);
  const female = config.gender === 'f';
  const browColor = shade(hairColor, -0.2);
  const eyeColor = EYE_COLORS[config.eyeColor];
  const mouthColor = MOUTH_COLORS[config.mouthColor];

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ '--lid': skin } as React.CSSProperties}
    >
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FEF3C7" />
          <stop offset="1" stopColor="#FCD34D" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${uid})`} />

      {hair.back}

      {/* Hombros y cuello */}
      <path d="M8 100 C10 83 28 77 50 77 C72 77 90 83 92 100Z" fill="#6B4020" />
      <path d="M38 77 C42 83 58 83 62 77 C58 80 42 80 38 77Z" fill="#4A2A12" opacity={0.7} />
      <rect x={42} y={62} width={16} height={19} rx={5} fill={skinDark} />
      <path d="M40 78 Q50 90 60 78 L60 82 Q50 92 40 82Z" fill={skin} opacity={0} />

      {/* Orejas y cabeza */}
      <ellipse cx={26.5} cy={52} rx={4.2} ry={5.6} fill={skin} />
      <ellipse cx={73.5} cy={52} rx={4.2} ry={5.6} fill={skin} />
      <ellipse cx={26.8} cy={52.4} rx={1.8} ry={3} fill={skinDark} opacity={0.5} />
      <ellipse cx={73.2} cy={52.4} rx={1.8} ry={3} fill={skinDark} opacity={0.5} />
      <path
        d={female ? 'M26 46 C26 28 36 22 50 22 C64 22 74 28 74 46 C74 62 64 77 50 77 C36 77 26 62 26 46Z' : 'M25.5 46 C25.5 27 36 21 50 21 C64 21 74.5 27 74.5 46 C74.5 63 64 78 50 78 C36 78 25.5 63 25.5 46Z'}
        fill={skin}
      />
      {female && (
        <>
          <ellipse cx={34} cy={60} rx={4.4} ry={2.6} fill="#E0708C" opacity={0.2} />
          <ellipse cx={66} cy={60} rx={4.4} ry={2.6} fill="#E0708C" opacity={0.2} />
        </>
      )}

      {/* Cejas, ojos, nariz, boca y bigote */}
      <path d={female ? 'M33.5 43.4 Q40 39.8 46.5 43' : 'M33.5 43.6 Q40 41.2 46.5 43.2'} fill="none" stroke={browColor} strokeWidth={female ? 1.5 : 2.1} strokeLinecap="round" />
      <path d={female ? 'M53.5 43 Q60 39.8 66.5 43.4' : 'M53.5 43.2 Q60 41.2 66.5 43.6'} fill="none" stroke={browColor} strokeWidth={female ? 1.5 : 2.1} strokeLinecap="round" />
      <Eye type={config.eyeType} cx={40} color={eyeColor} flip={false} />
      <Eye type={config.eyeType} cx={60} color={eyeColor} flip />
      <path d="M48 55.4 Q50 58.6 52.2 55.4" fill="none" stroke={skinDark} strokeWidth={1.4} strokeLinecap="round" />
      <Mouth type={config.mouthType} color={mouthColor} />
      <Mustache type={config.mustache} color={MUSTACHE_COLORS[config.mustacheColor]} />

      {hair.front}
    </svg>
  );
}
