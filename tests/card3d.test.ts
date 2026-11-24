import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  CARD_3D_CLASS,
  CARD_DEAL_CLASS,
  CARD_DEAL_MS,
  CARD_PICKED_CLASS,
  CARD_PLAYABLE_CLASS,
  CARD_PRESS_CLASS,
  cardBackClass,
  cardFaceClass,
  cardStateClass,
} from '../src/lib/card3d';

// Los componentes no se pueden renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el helper puro y el
// marcado y el CSS en el código fuente, como hacen lobbyWeb.test.ts y
// desktopWeb.test.ts.
const css = readFileSync('src/index.css', 'utf8');
const cagaoCard = readFileSync('src/components/cagao/PlayingCard.tsx', 'utf8');
const cartaUI = readFileSync('src/components/CartaUI.tsx', 'utf8');
const playingCard = readFileSync('src/components/PlayingCard.tsx', 'utf8');
const fans = readFileSync('src/components/cagao/Fans.tsx', 'utf8');

const SECTION_START = '/* Cartas 3D:';
const SECTION_END = '/* Fin Cartas 3D */';
const sectionStart = css.indexOf(SECTION_START);
const sectionEnd = css.indexOf(SECTION_END);
const section = sectionStart === -1 || sectionEnd === -1 ? '' : css.slice(sectionStart, sectionEnd);

describe('card3d: helper puro de clases', () => {
  it('la cara lleva sombra 3D y giro de reparto por defecto', () => {
    assert.equal(cardFaceClass(), 'card-3d card-deal');
    assert.equal(cardFaceClass(true), 'card-3d card-deal');
    assert.equal(cardFaceClass(false), 'card-3d');
  });

  it('el dorso lleva sombra 3D sin giro de reparto', () => {
    // El mazo del barajado se remonta a cada tick (80 ms): un giro de 280 ms se
    // reiniciaría sin parar.
    assert.equal(cardBackClass(), 'card-3d');
  });

  it('elegida manda sobre jugable; sin estado no hay clase', () => {
    assert.equal(cardStateClass(true, true), 'card-picked');
    assert.equal(cardStateClass(true, false), 'card-picked');
    assert.equal(cardStateClass(false, true), 'card-playable');
    assert.equal(cardStateClass(false, false), '');
  });

  it('el giro de reparto es corto (200-350 ms)', () => {
    assert.ok(CARD_DEAL_MS >= 200 && CARD_DEAL_MS <= 350, `CARD_DEAL_MS es ${CARD_DEAL_MS} ms`);
  });

  it('las constantes nombran las clases que define el CSS', () => {
    for (const name of [CARD_3D_CLASS, CARD_DEAL_CLASS, CARD_PRESS_CLASS, CARD_PICKED_CLASS, CARD_PLAYABLE_CLASS]) {
      assert.ok(css.includes(`.${name}`), `index.css define .${name}`);
    }
  });
});

describe('card3d: sección «Cartas 3D» en index.css', () => {
  it('la sección existe, delimitada, junto a .card-picked/.card-playable', () => {
    assert.ok(sectionStart !== -1, 'index.css tiene la sección /* Cartas 3D */');
    assert.ok(sectionEnd > sectionStart, 'la sección tiene su cierre /* Fin Cartas 3D */');
    assert.ok(sectionStart > css.indexOf('.card-picked {'), 'la sección va después de .card-picked');
  });

  it('el giro de reparto es un rotateY con perspectiva y dura lo que dice el helper', () => {
    assert.ok(section.includes('@keyframes card-deal-flip'), 'existe el keyframe card-deal-flip');
    assert.ok(section.includes('rotateY(75deg)'), 'el giro arranca de canto (75deg)');
    assert.ok(section.includes('rotateY(0deg)'), 'el giro termina de cara (0deg)');
    assert.ok(section.includes('perspective(650px)'), 'el giro lleva perspectiva para que se note el 3D');
    const match = section.match(/\.card-deal\s*\{[^}]*animation:\s*card-deal-flip\s+(\d+)ms/);
    assert.ok(match, '.card-deal anima card-deal-flip con duración en ms');
    assert.equal(Number(match[1]), CARD_DEAL_MS, 'la duración del CSS coincide con CARD_DEAL_MS');
  });

  it('la sombra de la carta es en capas, no una sola', () => {
    const rule = section.match(/\.card-3d\s*\{([^}]*)\}/);
    assert.ok(rule, 'existe la regla .card-3d');
    assert.ok(rule[1].includes('box-shadow'), '.card-3d define box-shadow');
    assert.ok(rule[1].includes('0 10px 24px'), '.card-3d tiene la sombra de caída (0 10px 24px)');
    assert.ok((rule[1].match(/rgb\(0 0 0/g) ?? []).length >= 2, '.card-3d tiene al menos dos capas de sombra');
  });

  it('la carta elegida conserva elevación y aro dorado, con inclinación 3D y más sombra', () => {
    assert.ok(css.includes('transform: translateY(-0.75rem);'), 'la regla original de .card-picked sigue ahí');
    assert.ok(
      section.includes('transform: perspective(700px) translateY(-0.75rem) rotateX(-6deg)'),
      '.card-picked mantiene la elevación y añade inclinación 3D',
    );
    assert.ok(section.includes('0 0 0 2px #facc15'), '.card-picked mantiene el aro dorado');
    assert.ok(section.includes('0 16px 32px'), '.card-picked tiene sombra con más profundidad');
  });

  it('la carta jugable conserva el aro verde y se marca más al pasar el dedo o el ratón', () => {
    assert.ok(section.includes('0 0 0 2px rgb(190 242 100 / 0.8)'), '.card-playable mantiene el aro verde');
    assert.ok(section.includes('.card-playable:hover'), '.card-playable tiene regla de hover');
    assert.ok(section.includes('0 14px 28px'), 'en hover la sombra es más marcada');
  });

  it('al presionar hay una leve inclinación que compone con active:scale-95', () => {
    // `rotate` es una propiedad independiente: no pisa el `transform` de Tailwind.
    assert.ok(section.includes('.card-press:active'), 'existe la regla .card-press:active');
    assert.ok(section.includes('rotate: -2deg'), 'la inclinación al presionar es leve (-2deg)');
    assert.ok(
      section.includes('transition-property: transform, rotate, box-shadow, opacity'),
      '.card-press transiciona rotate junto a transform',
    );
  });

  it('las transiciones y animaciones son cortas (150-300 ms)', () => {
    const durations = [...section.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
    assert.ok(durations.length > 0, 'la sección declara duraciones en ms');
    for (const ms of durations) {
      assert.ok(ms >= 150 && ms <= 350, `duración ${ms} ms fuera de 150-350 ms`);
    }
  });

  it('la sección no toca tamaños ni layout', () => {
    assert.ok(!/\b(width|height|margin|padding)\s*:/.test(section), 'sin width/height/margin/padding en la sección');
  });

  it('respeta prefers-reduced-motion: sin giros ni inclinaciones animadas', () => {
    const reducedAt = section.indexOf('@media (prefers-reduced-motion: reduce)');
    assert.ok(reducedAt !== -1, 'la sección tiene su bloque prefers-reduced-motion');
    const reduced = section.slice(reducedAt);
    assert.ok(reduced.includes('.card-deal') && reduced.includes('animation: none'), 'sin giro de reparto');
    assert.ok(reduced.includes('.card-press:active') && reduced.includes('rotate: none'), 'sin inclinación al presionar');
    assert.ok(reduced.includes('transform: translateY(-0.75rem)'), 'la carta elegida vuelve a la elevación plana');
  });
});

describe('card3d: cableado en los componentes', () => {
  it('la carta de El Cagao gira al repartir y tiene sombra 3D (con escape deal={false})', () => {
    assert.ok(cagaoCard.includes('cardFaceClass(deal)'), 'la cara usa cardFaceClass(deal)');
    assert.ok(cagaoCard.includes('cardBackClass()'), 'el dorso usa cardBackClass()');
    assert.ok(cagaoCard.includes('deal?: boolean'), 'hay prop deal?: boolean para desactivar el giro');
    assert.ok(!cagaoCard.includes('shadow-[0_2px_5px_rgba(0,0,0,0.45)]'), 'la sombra ya no es la de Tailwind: la lleva .card-3d');
  });

  it('CartaUI (Casino y Tres y Dos) usa el estado centralizado y la inclinación al presionar', () => {
    assert.ok(cartaUI.includes('cardStateClass(isSelected, isPlayable)'), 'el estado sale de cardStateClass');
    assert.ok(cartaUI.includes('CARD_PRESS_CLASS'), 'la raíz lleva .card-press');
    assert.ok(cartaUI.includes('CARD_3D_CLASS'), 'el dorso lleva .card-3d');
  });

  it('el wrapper genérico usa el estado centralizado y la inclinación al presionar', () => {
    assert.ok(playingCard.includes('cardStateClass(selected, highlighted)'), 'el estado sale de cardStateClass');
    assert.ok(playingCard.includes('CARD_PRESS_CLASS'), 'la raíz lleva .card-press');
    assert.ok(playingCard.includes('CARD_3D_CLASS'), 'el dorso lleva .card-3d');
  });

  it('no se añaden handlers de puntero: el tacto de El Cagao no se toca', () => {
    for (const [name, src] of [
      ['cagao/PlayingCard', cagaoCard],
      ['CartaUI', cartaUI],
      ['PlayingCard', playingCard],
    ] as const) {
      assert.ok(!src.includes('onPointer'), `${name} no añade handlers de puntero`);
    }
    // El abanico (HandFan) queda fuera de alcance: sus giros y su precisión táctil
    // viven en Fans.tsx y no se tocan en esta vía.
    assert.ok(!fans.includes('card-deal'), 'HandFan no lleva el giro de reparto');
    assert.ok(!fans.includes('card-3d'), 'HandFan no lleva la sombra 3D');
  });
});
