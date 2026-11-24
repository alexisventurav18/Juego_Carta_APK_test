import { useId } from 'react';
import { publicAsset } from '@/lib/publicAsset';
import type { CardBackTheme } from '@/lib/visualPrefs';
import type { Suit } from './types';

/* ------------------------------------------------------------------ */
/* Palos                                                               */
/* ------------------------------------------------------------------ */

const SUIT_PATH: Record<string, string> = {
  corazones:
    'M50 90C8 60 4 34 22 21C37 11 50 23 50 32C50 23 63 11 78 21C96 34 92 60 50 90Z',
  diamantes: 'M50 6L88 50L50 94L12 50Z',
  picas:
    'M50 6C82 36 94 52 81 69C70 82 56 76 54 66C56 80 60 88 68 94H32C40 88 44 80 46 66C44 76 30 82 19 69C6 52 18 36 50 6Z',
  treboles:
    'M50 8C61 8 69 17 69 27C69 33 66 38 61 42C64 41 67 40 71 40C82 40 90 48 90 58C90 68 82 76 71 76C63 76 57 72 53 66C53 78 56 87 63 94H37C44 87 47 78 47 66C43 72 37 76 29 76C18 76 10 68 10 58C10 48 18 40 29 40C33 40 36 41 39 42C34 38 31 33 31 27C31 17 39 8 50 8Z',
};

export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  const path = SUIT_PATH[suit];
  if (!path) return null;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      <path d={path} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Mazorca de cacao                                                    */
/* ------------------------------------------------------------------ */

export function CacaoPod({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 60 112" className={className} aria-hidden>
      <defs>
        <linearGradient id={`pod${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#f0a846" />
          <stop offset="0.5" stopColor="#bd6a20" />
          <stop offset="1" stopColor="#7a3a10" />
        </linearGradient>
      </defs>
      <path d="M30 14C48 28 57 64 30 106C3 64 12 28 30 14Z" fill={`url(#pod${id})`} stroke="#4a210a" strokeWidth="2" />
      <g fill="none" stroke="#5a2b0c" strokeWidth="1.7" strokeLinecap="round">
        <path d="M30 17C37 42 37 78 30 103" />
        <path d="M30 17C23 42 23 78 30 103" />
        <path d="M30 22C45 42 47 72 31 101" opacity="0.6" />
        <path d="M30 22C15 42 13 72 29 101" opacity="0.6" />
      </g>
      <path d="M21 44C23 33 27 26 30 21" stroke="#f6cd86" strokeWidth="2.2" opacity="0.6" fill="none" strokeLinecap="round" />
      <path d="M30 14C30 8 33 4 39 2" stroke="#456a1f" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M36 6C44 0 54 2 56 8C48 12 40 11 36 6Z" fill="#5f8f35" stroke="#2f4d14" strokeWidth="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Máscara de carnaval dominicano (diablo cojuelo)                     */
/* ------------------------------------------------------------------ */

export function CarnivalMask({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 120 132" className={className} aria-hidden>
      <defs>
        <linearGradient id={`face${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8452c" />
          <stop offset="1" stopColor="#9c1d1d" />
        </linearGradient>
        <linearGradient id={`horn${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f3c13a" />
          <stop offset="1" stopColor="#b9801a" />
        </linearGradient>
      </defs>
      <path d="M36 46C24 24 12 14 3 14C6 36 18 56 38 68Z" fill={`url(#horn${id})`} stroke="#5a3a07" strokeWidth="2" />
      <path d="M84 46C96 24 108 14 117 14C114 36 102 56 82 68Z" fill={`url(#horn${id})`} stroke="#5a3a07" strokeWidth="2" />
      <path
        d="M60 10C88 10 101 40 99 70C97 101 81 122 60 126C39 122 23 101 21 70C19 40 32 10 60 10Z"
        fill={`url(#face${id})`}
        stroke="#4a0d0d"
        strokeWidth="2.4"
      />
      <path d="M60 18L69 30L60 42L51 30Z" fill="#19a7a1" stroke="#0b5d5a" strokeWidth="1.4" />
      <path d="M28 50C37 38 52 38 58 48M92 50C83 38 68 38 62 48" fill="none" stroke="#f3c13a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 62C39 51 52 51 57 62C51 70 39 70 32 62Z" fill="#161616" />
      <path d="M88 62C81 51 68 51 63 62C69 70 81 70 88 62Z" fill="#161616" />
      <circle cx="42" cy="60" r="3" fill="#fff" opacity="0.85" />
      <circle cx="78" cy="60" r="3" fill="#fff" opacity="0.85" />
      <path d="M60 64L51 87C55 92 65 92 69 87Z" fill="#a31f1f" stroke="#4a0d0d" strokeWidth="1.6" />
      <path d="M36 99C47 112 73 112 84 99C73 104 47 104 36 99Z" fill="#2a0707" />
      <path d="M39 100L44 108L49 102L54 110L60 103L66 110L71 102L76 108L81 100" fill="none" stroke="#fff6dc" strokeWidth="2.4" strokeLinejoin="round" />
      <g fill="#f3c13a">
        <circle cx="32" cy="82" r="3.2" />
        <circle cx="88" cy="82" r="3.2" />
        <circle cx="38" cy="92" r="2.4" />
        <circle cx="82" cy="92" r="2.4" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Marco de madera tallada                                             */
/* ------------------------------------------------------------------ */

function CornerOrnament({ className }: { className?: string }) {
  return (
    <div className={`absolute z-30 h-[var(--corner)] w-[var(--corner)] ${className ?? ''}`}>
      <div className="wood-block absolute inset-0 rounded-br-[40%]" />
      <CacaoPod className="absolute left-[14%] top-[10%] h-[78%] -rotate-[28deg]" />
      <CacaoPod className="absolute left-[40%] top-[6%] h-[62%] rotate-[22deg] opacity-95" />
    </div>
  );
}

function MaskMedallion({ className }: { className?: string }) {
  return (
    <div className={`absolute z-30 h-[var(--medal)] w-[var(--medal)] ${className ?? ''}`}>
      <div className="wood-block absolute inset-0 rounded-full" />
      <CarnivalMask className="absolute inset-[10%] h-[80%] w-[80%]" />
    </div>
  );
}

/**
 * Marco exterior: cuatro rieles de madera, mazorcas de cacao en las esquinas y máscaras de carnaval
 * en el centro de los lados largos. Es decoración pura (no recibe toques).
 */
export function WoodFrame() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
    >
      <div className="wood-rail absolute inset-x-0 top-0 h-[var(--frame)]" />
      <div className="wood-rail absolute inset-x-0 bottom-0 h-[var(--frame)]" />
      <div className="wood-rail absolute inset-y-0 left-0 w-[var(--frame)]" />
      <div className="wood-rail absolute inset-y-0 right-0 w-[var(--frame)]" />
      <div className="absolute inset-[var(--frame)] rounded-[10px] shadow-[inset_0_0_0_2px_rgba(255,214,140,0.35),inset_0_6px_18px_rgba(0,0,0,0.55)]" />
      <CornerOrnament className="left-0 top-0" />
      <CornerOrnament className="right-0 top-0 -scale-x-100" />
      <CornerOrnament className="bottom-0 left-0 -scale-y-100" />
      <CornerOrnament className="bottom-0 right-0 -scale-100" />
      <MaskMedallion className="left-1/2 top-[calc(var(--frame)*-0.35)] -translate-x-1/2" />
      <MaskMedallion className="bottom-[calc(var(--frame)*-0.35)] left-1/2 -translate-x-1/2" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reverso de las cartas: cacao sobre fondo crema                      */
/* ------------------------------------------------------------------ */

const LEAF = (x: number, y: number, rot: number, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-14 38-14 52 0C38 14 14 14 0 0Z" fill="#5f8f35" stroke="#2f4d14" stroke-width="1.6"/><path d="M2 0H50" stroke="#2f4d14" stroke-width="1.4"/></g>`;

const POD = (x: number, y: number, rot: number, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C18 14 27 50 0 92C-27 50 -18 14 0 0Z" fill="#bd6a20" stroke="#4a210a" stroke-width="2"/><path d="M0 4C7 30 7 64 0 88M0 4C-7 30 -7 64 0 88" fill="none" stroke="#5a2b0c" stroke-width="1.6"/><path d="M-9 28C-7 18 -3 11 0 6" stroke="#f6cd86" stroke-width="2" fill="none" opacity=".6"/></g>`;

const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350">
<rect width="250" height="350" rx="16" fill="#f4e8c8"/>
<rect x="9" y="9" width="232" height="332" rx="11" fill="none" stroke="#a8742a" stroke-width="3"/>
<rect x="17" y="17" width="216" height="316" rx="7" fill="none" stroke="#c9962b" stroke-width="1.4" stroke-dasharray="2 5"/>
<path d="M125 36C108 90 142 140 125 196C108 246 140 296 125 318" fill="none" stroke="#4d7326" stroke-width="5" stroke-linecap="round"/>
${LEAF(122, 82, -148, 0.95)}${LEAF(128, 100, -32, 0.95)}${LEAF(122, 232, -148, 0.95)}${LEAF(128, 250, -32, 0.95)}
${LEAF(124, 150, -158, 0.8)}${LEAF(126, 168, -22, 0.8)}
${POD(88, 168, 14, 0.95)}${POD(162, 168, -14, 0.95)}
<g fill="#e9a3ab" stroke="#b9626d" stroke-width="1"><circle cx="112" cy="130" r="4.5"/><circle cx="139" cy="214" r="4.5"/><circle cx="114" cy="276" r="4"/><circle cx="137" cy="70" r="4"/></g>
<g fill="#5f8f35" stroke="#2f4d14" stroke-width="1">
<path d="M28 28c14 0 22 8 22 22c-14 0-22-8-22-22Z"/><path d="M222 28c-14 0-22 8-22 22c14 0 22-8 22-22Z"/>
<path d="M28 322c14 0 22-8 22-22c-14 0-22 8-22 22Z"/><path d="M222 322c-14 0-22-8-22-22c14 0 22 8 22 22Z"/></g>
</svg>`;

/** Fondos locales para el reverso, compartidos por todas las cartas boca abajo. */
export const CARD_BACK_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_SVG)}")`;

const recolorBack = (colors: { leaf: string; pod: string; flower: string }) =>
  BACK_SVG.split('#5f8f35').join(colors.leaf)
    .split('#2f4d14').join(colors.leaf)
    .split('#4d7326').join(colors.leaf)
    .split('#bd6a20').join(colors.pod)
    .split('#4a210a').join(colors.pod)
    .split('#5a2b0c').join(colors.pod)
    .split('#e9a3ab').join(colors.flower)
    .split('#b9626d').join(colors.flower);

/* ------------------------------------------------------------------ */
/* Dorsos nuevos: temas de baraja dibujados en SVG (van por GitHub)   */
/* ------------------------------------------------------------------ */

/** Marco común de los dorsos nuevos: fondo, doble filete y el motivo propio. */
const themedBack = (bg: string, frame: string, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350">
<rect width="250" height="350" rx="16" fill="${bg}"/>
<rect x="9" y="9" width="232" height="332" rx="11" fill="none" stroke="${frame}" stroke-width="3"/>
<rect x="17" y="17" width="216" height="316" rx="7" fill="none" stroke="${frame}" stroke-width="1.4" stroke-dasharray="2 5" opacity="0.7"/>
${inner}
</svg>`;

const BEAN = (x: number, y: number, rot: number, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="16" ry="24" fill="#6b4020" stroke="#3d2210" stroke-width="2"/><path d="M0 -21 C8 -8 8 8 0 21" stroke="#c9962b" stroke-width="2.5" fill="none"/></g>`;

const STAR = (x: number, y: number, s = 1, fill = '#e8703a') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -22 L6 -7 L22 -7 L10 3 L15 19 L0 10 L-15 19 L-10 3 L-22 -7 L-6 -7 Z" fill="${fill}" stroke="#b84a1f" stroke-width="2" stroke-linejoin="round"/>`;

const SHELL = (x: number, y: number, rot: number, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-20 6 A20 20 0 0 1 20 6 Z" fill="#fff6dc" stroke="#c9962b" stroke-width="2"/><path d="M-14 6 L-8 -8 M-5 6 L-3 -12 M5 6 L3 -12 M14 6 L8 -8" stroke="#c9962b" stroke-width="1.5" fill="none"/></g>`;

const BIG_LEAF = (x: number, y: number, rot: number, s: number, fill: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-14 38-14 52 0C38 14 14 14 0 0Z" fill="${fill}" stroke="#0b3d20" stroke-width="1.6"/><path d="M2 0H50" stroke="#0b3d20" stroke-width="1.4"/></g>`;

const BACK_CARNAVAL = themedBack(
  '#173a70',
  '#f3c13a',
  `<path d="M-10 90 L260 30" stroke="#ce1126" stroke-width="12" opacity="0.22"/>
<path d="M-10 320 L260 260" stroke="#e8a020" stroke-width="12" opacity="0.22"/>
<g fill="#e8a020"><circle cx="45" cy="60" r="5"/><circle cx="125" cy="300" r="4"/></g>
<g fill="#e8452c"><circle cx="205" cy="70" r="5"/><circle cx="125" cy="55" r="4"/></g>
<g fill="#19a7a1"><circle cx="55" cy="280" r="5"/><circle cx="210" cy="175" r="4"/></g>
<g fill="#ffffff"><circle cx="200" cy="290" r="5"/><circle cx="40" cy="175" r="4"/></g>
<path d="M95 130 L78 96 L108 118 Z" fill="#f3c13a" stroke="#5a3a07" stroke-width="2"/>
<path d="M155 130 L172 96 L142 118 Z" fill="#f3c13a" stroke="#5a3a07" stroke-width="2"/>
<path d="M125 108 C152 108 166 138 164 168 C162 200 146 224 125 226 C104 224 88 200 86 168 C84 138 98 108 125 108Z" fill="#e8452c" stroke="#4a0d0d" stroke-width="3"/>
<ellipse cx="104" cy="164" rx="9" ry="5" fill="#161616" transform="rotate(-12 104 164)"/>
<ellipse cx="146" cy="164" rx="9" ry="5" fill="#161616" transform="rotate(12 146 164)"/>
<path d="M125 118 L133 130 L125 142 L117 130 Z" fill="#19a7a1" stroke="#0b5d5a" stroke-width="1.4"/>
<path d="M108 200 Q125 212 142 200" stroke="#fff6dc" stroke-width="3" fill="none" stroke-linecap="round"/>`,
);

const BACK_CAFETAL = themedBack(
  'url(#g)',
  '#e8c97a',
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e7a4c"/><stop offset="1" stop-color="#0e3a22"/></linearGradient></defs>
${BEAN(62, 84, -20)}${BEAN(190, 96, 18)}${BEAN(56, 268, 30)}${BEAN(196, 264, -25)}
${BEAN(125, 175, 0, 1.5)}
${LEAF(122, 52, -148, 0.9)}${LEAF(128, 296, -32, 0.9)}${LEAF(30, 175, -90, 0.8)}${LEAF(220, 175, 90, 0.8)}`,
);

const BACK_AMANECER_CARIBE = themedBack(
  'url(#g)',
  '#f2a541',
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0ea5b7"/><stop offset="0.38" stop-color="#2ec4d4"/><stop offset="0.62" stop-color="#f2a541"/><stop offset="1" stop-color="#fdf6e3"/></linearGradient></defs>
<path d="M60 70 Q68 62 76 70 Q84 62 92 70" stroke="#143b5a" stroke-width="2.5" fill="none"/>
<path d="M158 52 Q165 45 172 52 Q179 45 186 52" stroke="#143b5a" stroke-width="2.5" fill="none"/>
<g stroke="#e8a020" stroke-width="4" stroke-linecap="round"><path d="M125 96 V84"/><path d="M125 216 V204"/><path d="M71 150 H59"/><path d="M191 150 H179"/><path d="M87 112 L78 103"/><path d="M163 112 L172 103"/><path d="M87 188 L78 197"/><path d="M163 188 L172 197"/></g>
<circle cx="125" cy="150" r="32" fill="#f6c453" stroke="#e8a020" stroke-width="2"/>
<path d="M17 280 Q50 268 83 280 T149 280 T215 280" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.7"/>
<path d="M17 306 Q50 294 83 306 T149 306 T215 306" stroke="#0e7a8a" stroke-width="4" fill="none" opacity="0.8"/>`,
);

const BACK_ARENA_PLAYA = themedBack(
  'url(#g)',
  '#c9962b',
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e3ac"/><stop offset="1" stop-color="#e0b96a"/></linearGradient></defs>
${SHELL(62, 92, -18)}${SHELL(190, 100, 22)}${SHELL(66, 262, 14)}${SHELL(186, 268, -20)}
${STAR(125, 175, 1.6)}
<path d="M17 296 Q50 286 83 296 T149 296 T215 296" stroke="#0ea5b7" stroke-width="4" fill="none" opacity="0.8"/>
<path d="M17 318 Q50 308 83 318 T149 318 T215 318" stroke="#0ea5b7" stroke-width="3" fill="none" opacity="0.5"/>
<g fill="#c9962b"><circle cx="45" cy="170" r="3"/><circle cx="205" cy="180" r="3"/><circle cx="125" cy="48" r="3"/><circle cx="125" cy="252" r="3"/></g>`,
);

const BACK_SELVA = themedBack(
  '#14532d',
  '#cfe08a',
  `<path d="M125 20 C100 100 150 180 125 260 C110 300 130 320 125 332" stroke="#2e7a4c" stroke-width="4" fill="none"/>
${BIG_LEAF(36, 56, -30, 1.7, '#2e7a4c')}${BIG_LEAF(214, 66, 150, 1.7, '#2e7a4c')}
${BIG_LEAF(30, 260, -140, 1.5, '#5f8f35')}${BIG_LEAF(220, 250, 30, 1.5, '#5f8f35')}
${BIG_LEAF(96, 150, -60, 1.4, '#2e7a4c')}${BIG_LEAF(154, 150, 120, 1.4, '#5f8f35')}
<g fill="#e75480"><circle cx="72" cy="122" r="5"/><circle cx="182" cy="228" r="5"/><circle cx="125" cy="298" r="5"/></g>
<g fill="#f6d77a"><circle cx="72" cy="122" r="2"/><circle cx="182" cy="228" r="2"/><circle cx="125" cy="298" r="2"/></g>`,
);

const BACK_ATARDECER = themedBack(
  'url(#g)',
  '#f6c453',
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a2a6d"/><stop offset="0.45" stop-color="#e75480"/><stop offset="0.75" stop-color="#f08a3c"/><stop offset="1" stop-color="#f6c453"/></linearGradient></defs>
<path d="M52 62 Q59 55 66 62 Q73 55 80 62" stroke="#2e1a2e" stroke-width="2.5" fill="none"/>
<path d="M168 46 Q174 40 180 46 Q186 40 192 46" stroke="#2e1a2e" stroke-width="2.5" fill="none"/>
<circle cx="125" cy="140" r="44" fill="#ffe9a8" opacity="0.3"/>
<circle cx="125" cy="140" r="30" fill="#ffe9a8"/>
<path d="M185 332 C180 285 190 250 208 222" stroke="#2e1a2e" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M208 222 C190 205 168 202 152 210" stroke="#2e1a2e" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M208 222 C226 206 246 204 258 212" stroke="#2e1a2e" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M208 222 C200 200 186 188 170 186" stroke="#2e1a2e" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M208 222 C216 200 230 188 246 186" stroke="#2e1a2e" stroke-width="4" fill="none" stroke-linecap="round"/>`,
);

/* ------------------------------------------------------------------ */
/* Dorsos de carros: siluetas genéricas dibujadas en SVG              */
/*                                                                     */
/* Sin marcas, sin logotipos, sin nombres de modelos reales y sin      */
/* copiar el diseño distintivo de ningún carro real: carrocerías de    */
/* formas simples (techo, ventanas, ruedas, parachoques) con detalles  */
/* genéricos. Cada carro mira hacia la derecha.                        */
/* ------------------------------------------------------------------ */

/** Rueda genérica: neumático, aro claro y centro dorado. */
const WHEEL = (cx: number, cy: number, r: number) =>
  `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1d1b2e"/><circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="#e8e8e8" stroke="#6b470b" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#8a5f12"/></g>`;

/** Una fila de cuadros blancos para la banda de bandera a cuadros. */
const CHECKER = (y: number, offset: number) =>
  Array.from({ length: 8 }, (_, i) => `<rect x="${17 + offset + i * 28}" y="${y}" width="14" height="14" fill="#ffffff"/>`).join('');

/** Concho clásico: sedán antiguo genérico, rojo vino sobre crema, con carretera. */
const BACK_CONCHO_CLASICO = themedBack(
  '#f3e2c2',
  '#8a5f12',
  `<path d="M17 232 H233" stroke="#8a5f12" stroke-width="3" stroke-dasharray="14 10"/>
<g fill="#e8a020"><circle cx="48" cy="70" r="5"/><circle cx="205" cy="80" r="4"/></g>
<g fill="#a8323e"><circle cx="125" cy="52" r="4"/><circle cx="60" cy="290" r="4"/><circle cx="196" cy="292" r="4"/></g>
<path d="M42 196 C44 178 60 170 84 168 L100 132 C106 122 116 118 128 118 L158 118 C170 118 178 124 184 134 L192 152 C210 156 222 164 224 178 L224 192 C224 200 218 204 210 204 L56 204 C48 204 42 202 42 196 Z" fill="#a8323e" stroke="#4a0d12" stroke-width="2.5"/>
<path d="M104 132 L126 124 L126 150 L102 150 Z" fill="#bfe3ea" stroke="#4a0d12" stroke-width="1.5"/>
<path d="M132 124 L156 124 C164 124 170 130 174 138 L178 150 L132 150 Z" fill="#bfe3ea" stroke="#4a0d12" stroke-width="1.5"/>
<path d="M128 158 L128 200" stroke="#4a0d12" stroke-width="2"/>
<rect x="140" y="176" width="12" height="5" rx="2.5" fill="#c9962b" stroke="#4a0d12" stroke-width="1"/>
<circle cx="219" cy="172" r="5" fill="#ffe9a8" stroke="#6b470b" stroke-width="1.5"/>
<rect x="34" y="184" width="12" height="10" rx="4" fill="#c9962b" stroke="#6b470b" stroke-width="1.5"/>
${WHEEL(82, 204, 21)}${WHEEL(188, 204, 21)}`,
);

/** Velocidad nocturna: deportivo genérico y bajo, azul eléctrico sobre cielo de noche con banda a cuadros y líneas de velocidad. */
const BACK_VELOCIDAD_NOCTURNA = themedBack(
  '#141c33',
  '#f3c13a',
  `<rect x="17" y="17" width="216" height="28" fill="#0b1020"/>
${CHECKER(17, 0)}${CHECKER(31, 14)}
<g fill="#ffffff"><circle cx="60" cy="80" r="2.5"/><circle cx="200" cy="70" r="2"/><circle cx="125" cy="95" r="2"/><circle cx="40" cy="290" r="2.5"/><circle cx="210" cy="300" r="2"/></g>
<g stroke="#f3c13a" stroke-width="3" stroke-linecap="round" opacity="0.85"><path d="M24 168 H50"/><path d="M20 188 H46"/><path d="M26 208 H52"/></g>
<path d="M58 200 L82 184 L118 178 L140 156 L178 152 L206 172 L228 180 L230 196 C230 202 224 206 216 206 L74 206 C64 206 58 204 58 200 Z" fill="#3a6fd8" stroke="#0b1020" stroke-width="2.5"/>
<path d="M146 158 L174 156 L196 170 L146 170 Z" fill="#bfe3ea" stroke="#0b1020" stroke-width="1.5"/>
<rect x="222" y="182" width="7" height="7" rx="2" fill="#ffe9a8" stroke="#6b470b" stroke-width="1"/>
${WHEEL(104, 206, 19)}${WHEEL(196, 206, 19)}`,
);

/** 4x4 Aventura: todoterreno genérico y cuadrado, con montañas, camino de tierra y rueda de repuesto en la parte trasera. */
const BACK_AVENTURA_4X4 = themedBack(
  'url(#g)',
  '#e8c97a',
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e7a4c"/><stop offset="1" stop-color="#14532d"/></linearGradient></defs>
<path d="M17 252 L80 150 L140 252 Z" fill="#0e3a22"/>
<path d="M80 150 L92 176 L70 176 Z" fill="#ffffff"/>
<path d="M110 252 L172 128 L232 252 Z" fill="#14532d"/>
<path d="M172 128 L184 154 L162 154 Z" fill="#ffffff"/>
<rect x="17" y="252" width="216" height="81" fill="#8a5a2b"/>
<path d="M17 292 H233" stroke="#f7ecce" stroke-width="3" stroke-dasharray="16 12"/>
<rect x="92" y="122" width="88" height="50" rx="6" fill="#c96a1e" stroke="#4a210a" stroke-width="2.5"/>
<path d="M100 116 H172" stroke="#4a210a" stroke-width="3" stroke-linecap="round"/>
<path d="M112 116 V110 M160 116 V110" stroke="#4a210a" stroke-width="2.5"/>
<rect x="100" y="130" width="30" height="26" rx="3" fill="#bfe3ea" stroke="#4a210a" stroke-width="1.5"/>
<rect x="138" y="130" width="34" height="26" rx="3" fill="#bfe3ea" stroke="#4a210a" stroke-width="1.5"/>
<rect x="48" y="168" width="156" height="44" rx="8" fill="#c96a1e" stroke="#4a210a" stroke-width="2.5"/>
<circle cx="52" cy="192" r="11" fill="#1d1b2e" stroke="#e8e8e8" stroke-width="2"/>
<rect x="196" y="182" width="8" height="8" rx="2" fill="#ffe9a8" stroke="#6b470b" stroke-width="1"/>
<rect x="198" y="200" width="10" height="10" rx="3" fill="#c9962b" stroke="#6b470b" stroke-width="1.5"/>
${WHEEL(84, 228, 24)}${WHEEL(176, 228, 24)}`,
);

export const CARD_BACK_IMAGES: Record<CardBackTheme, string> = {
  cacao: CARD_BACK_URL,
  azul: `url("data:image/svg+xml;utf8,${encodeURIComponent(recolorBack({ leaf: '#2563a6', pod: '#17416f', flower: '#83c5e8' }))}")`,
  rojo: `url("data:image/svg+xml;utf8,${encodeURIComponent(recolorBack({ leaf: '#a8323e', pod: '#6f1d2a', flower: '#f0a3a6' }))}")`,
  'madera-turquesa': `url("${publicAsset('images/temas/cartas/dorso-madera-turquesa.webp')}")`,
  'dominicano-azul': `url("${publicAsset('images/temas/cartas/dorso-dominicano-azul.webp')}")`,
  'dominicano-bandera': `url("${publicAsset('images/temas/cartas/dorso-dominicano-bandera.webp')}")`,
  larimar: `url("data:image/svg+xml;utf8,${encodeURIComponent(recolorBack({ leaf: '#7fb5d5', pod: '#2e6da4', flower: '#ffffff' }))}")`,
  ambar: `url("data:image/svg+xml;utf8,${encodeURIComponent(recolorBack({ leaf: '#e8a020', pod: '#8a5f12', flower: '#fff6d6' }))}")`,
  'palma-real': `url("${publicAsset('images/temas/cartas/dorso-palma-real.webp')}")`,
  'larimar-mar': `url("${publicAsset('images/temas/cartas/dorso-larimar-mar.webp')}")`,
  carnaval: `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_CARNAVAL)}")`,
  cafetal: `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_CAFETAL)}")`,
  'amanecer-caribe': `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_AMANECER_CARIBE)}")`,
  'arena-playa': `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_ARENA_PLAYA)}")`,
  selva: `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_SELVA)}")`,
  atardecer: `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_ATARDECER)}")`,
  'concho-clasico': `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_CONCHO_CLASICO)}")`,
  'velocidad-nocturna': `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_VELOCIDAD_NOCTURNA)}")`,
  'aventura-4x4': `url("data:image/svg+xml;utf8,${encodeURIComponent(BACK_AVENTURA_4X4)}")`,
};

/* ------------------------------------------------------------------ */
/* El Cagao (A♠) y figuras con detalles dorados                        */
/* ------------------------------------------------------------------ */

/** Cara especial del A♠: la carta sin pareja. */
export function CagaoFaceArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 250 350" className={className} aria-hidden>
      <defs>
        <linearGradient id={`gold${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d77a" />
          <stop offset="0.5" stopColor="#c9962b" />
          <stop offset="1" stopColor="#8a5f12" />
        </linearGradient>
        <radialGradient id={`glow${id}`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="1" stopColor="#f1e0b3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="250" height="350" rx="16" fill="#f7ecce" />
      <rect width="250" height="350" rx="16" fill={`url(#glow${id})`} />
      <rect x="9" y="9" width="232" height="332" rx="11" fill="none" stroke={`url(#gold${id})`} strokeWidth="4" />
      <rect x="18" y="18" width="214" height="314" rx="7" fill="none" stroke="#7a1d1d" strokeWidth="1.5" />
      <path
        d="M125 62C185 118 208 150 184 184C163 210 135 198 131 178C135 206 143 224 157 236H93C107 224 115 206 119 178C115 198 87 210 66 184C42 150 65 118 125 62Z"
        fill="#1d1b2e"
        stroke={`url(#gold${id})`}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M125 96C150 124 160 140 150 154" fill="none" stroke="#f6d77a" strokeWidth="3" opacity="0.5" strokeLinecap="round" />
      <path d="M26 306C70 292 180 292 224 306L214 330H36Z" fill="#a31f2b" stroke="#4a0d12" strokeWidth="2.4" />
      <text x="125" y="318" textAnchor="middle" fontSize="23" fontWeight="800" fill="#ffe9a8" fontFamily="Georgia, serif" letterSpacing="2">
        EL CAGAO
      </text>
      <g transform="translate(28 38) rotate(-14)" opacity="0.95">
        <path d="M0 0C12 10 17 30 0 56C-17 30 -12 10 0 0Z" fill="#bd6a20" stroke="#4a210a" strokeWidth="1.6" />
      </g>
      <g transform="translate(222 38) rotate(14)" opacity="0.95">
        <path d="M0 0C12 10 17 30 0 56C-17 30 -12 10 0 0Z" fill="#bd6a20" stroke="#4a210a" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** Adorno dorado para las figuras (J, Q y K). */
export function FaceCrest({ rank, className }: { rank: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 130" className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--card-face-crest-a, #f8dc84)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--card-face-crest-a, #c9962b)' }} />
          <stop offset="1" style={{ stopColor: 'var(--card-face-crest-b, #8a5f12)' }} />
        </linearGradient>
      </defs>
      <g fill={`url(#g${id})`} stroke="#6b470b" strokeWidth="2" strokeLinejoin="round">
        {rank === 13 && (
          <>
            <path d="M14 58L22 24L38 44L50 14L62 44L78 24L86 58Z" />
            <rect x="14" y="58" width="72" height="12" rx="3" />
            <circle cx="50" cy="14" r="5" />
            <circle cx="22" cy="24" r="4" />
            <circle cx="78" cy="24" r="4" />
          </>
        )}
        {rank === 12 && (
          <>
            <path d="M18 60C18 40 30 28 50 28C70 28 82 40 82 60Z" />
            <path d="M30 30L38 12L50 28L62 12L70 30" />
            <circle cx="38" cy="12" r="4" />
            <circle cx="62" cy="12" r="4" />
            <circle cx="50" cy="44" r="6" fill="#a31f2b" stroke="#4a0d12" />
            <rect x="16" y="60" width="68" height="10" rx="3" />
          </>
        )}
        {rank === 11 && (
          <>
            <path d="M18 62C18 38 34 26 52 26C66 26 78 34 82 46L96 22C98 40 92 56 84 62Z" />
            <rect x="16" y="62" width="68" height="10" rx="3" />
            <path d="M50 76L50 118M42 86H58" stroke="#6b470b" strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        )}
      </g>
      <path d="M22 96C34 108 66 108 78 96" fill="none" stroke={`url(#g${id})`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
