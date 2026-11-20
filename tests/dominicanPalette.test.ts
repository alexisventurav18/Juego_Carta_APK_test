import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  CONFETTI_COLORS,
  DOMINICAN_PALETTE,
  hexToRgbChannels,
  isValidHex,
  WHEEL_COLORS,
} from '../src/lib/dominicanPalette';
import {
  CARD_BACK_THEMES,
  DARK_CROSS_MENU_THEMES,
  GAME_ENVIRONMENTS,
  MENU_THEMES,
  TABLE_THEMES,
} from '../src/lib/visualPrefs';
import { shopPrice } from '../src/lib/economy';

// La cruz no se puede renderizar en Node: RoomView y Lobby usan el alias
// `@/` en su cadena de imports y el runner tsx no lo resuelve. Se comprueba
// el marcado en el código fuente, como hace seatPlaque.test.ts.
const css = readFileSync('src/index.css', 'utf8');
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
const tableLayout = readFileSync('src/components/table/TableLayout.tsx', 'utf8');

/**
 * Pruebas de la identidad visual dominicana: la paleta canónica, los colores
 * por modo, los temas nuevos de la tienda y que los guardados viejos sigan
 * siendo válidos (los ids antiguos no se tocaron, solo se añadieron nuevos).
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('paleta dominicana', () => {
  it('todos los colores de la paleta son hex válidos', () => {
    for (const [name, color] of Object.entries(DOMINICAN_PALETTE)) {
      assert.match(color, HEX, name);
      assert.equal(isValidHex(color), true);
    }
    assert.equal(isValidHex('rojo'), false);
    assert.equal(isValidHex('#12345'), false);
  });

  it('los valores exactos son los de la bandera y la cultura dominicana', () => {
    assert.equal(DOMINICAN_PALETTE.azulBandera, '#002D62');
    assert.equal(DOMINICAN_PALETTE.rojoBandera, '#CE1126');
    assert.equal(DOMINICAN_PALETTE.blanco, '#FFFFFF');
    assert.equal(DOMINICAN_PALETTE.verdePalma, '#1B7A3D');
    assert.equal(DOMINICAN_PALETTE.turquesaCaribe, '#0EA5B7');
    assert.equal(DOMINICAN_PALETTE.ambar, '#E8A020');
    assert.equal(DOMINICAN_PALETTE.azulLarimar, '#7FB5D5');
    assert.equal(DOMINICAN_PALETTE.rosaBayahibe, '#E75480');
    assert.equal(DOMINICAN_PALETTE.cacao, '#6B4020');
  });

  it('cada modo tiene un acento distinto, tomado de la paleta', () => {
    const accents = Object.values(GAME_ENVIRONMENTS).map((env) => env.accent);
    assert.equal(new Set(accents).size, accents.length);
    const palette = new Set(Object.values(DOMINICAN_PALETTE));
    for (const accent of accents) assert.ok(palette.has(accent), accent);
    assert.equal(GAME_ENVIRONMENTS.casino.accent, DOMINICAN_PALETTE.ambar);
    assert.equal(GAME_ENVIRONMENTS.tresydos.accent, DOMINICAN_PALETTE.azulLarimar);
    assert.equal(GAME_ENVIRONMENTS.cagao.accent, DOMINICAN_PALETTE.rojoBandera);
    assert.equal(GAME_ENVIRONMENTS.robaito.accent, DOMINICAN_PALETTE.turquesaCaribe);
  });

  it('el confeti y la rueda usan solo azul, rojo, blanco y ámbar de la bandera', () => {
    const expected = new Set([
      DOMINICAN_PALETTE.azulBandera,
      DOMINICAN_PALETTE.rojoBandera,
      DOMINICAN_PALETTE.blanco,
      DOMINICAN_PALETTE.ambar,
    ]);
    assert.deepEqual(new Set(CONFETTI_COLORS), expected);
    assert.deepEqual(new Set(WHEEL_COLORS), expected);
    for (const color of [...CONFETTI_COLORS, ...WHEEL_COLORS]) assert.match(color, HEX);
  });
});

describe('temas nuevos de la tienda', () => {
  it('los catálogos incluyen los temas dominicanos nuevos', () => {
    assert.ok(CARD_BACK_THEMES.some((t) => t.id === 'larimar'));
    assert.ok(CARD_BACK_THEMES.some((t) => t.id === 'ambar'));
    assert.ok(TABLE_THEMES.some((t) => t.id === 'mar-caribe'));
    assert.ok(TABLE_THEMES.some((t) => t.id === 'cana'));
    assert.ok(MENU_THEMES.some((t) => t.id === 'palmeras'));
    // Los nuevos temas de mesa y menú son gradientes CSS, no imágenes.
    for (const theme of TABLE_THEMES.filter((t) => t.id === 'mar-caribe' || t.id === 'cana')) {
      assert.match(theme.image, /gradient/);
    }
    const palmeras = MENU_THEMES.find((t) => t.id === 'palmeras');
    assert.match(palmeras!.image, /gradient/);
    assert.doesNotMatch(palmeras!.image, /url\(/);
  });

  it('los temas nuevos tienen precio en rango y los viejos no cambiaron', () => {
    for (const [category, id] of [
      ['cardBack', 'larimar'],
      ['cardBack', 'ambar'],
      ['table', 'mar-caribe'],
      ['table', 'cana'],
      ['menu', 'palmeras'],
    ] as const) {
      const price = shopPrice(category, id);
      assert.notEqual(price, null, `${category}/${id}`);
      assert.ok(price! >= 100 && price! <= 400, `${category}/${id} = ${price}`);
    }
    assert.equal(shopPrice('cardBack', 'larimar'), 150);
    assert.equal(shopPrice('cardBack', 'ambar'), 250);
    assert.equal(shopPrice('table', 'mar-caribe'), 150);
    assert.equal(shopPrice('table', 'cana'), 250);
    assert.equal(shopPrice('menu', 'palmeras'), 250);
    // Precios viejos intactos.
    assert.equal(shopPrice('cardBack', 'cacao'), 0);
    assert.equal(shopPrice('cardBack', 'dominicano-bandera'), 400);
    assert.equal(shopPrice('table', 'tropical'), 350);
    assert.equal(shopPrice('menu', 'playa-ilustrada'), 350);
  });

  it('los ids antiguos siguen siendo válidos (sin migración de guardados)', () => {
    const oldCardBacks = ['cacao', 'azul', 'rojo', 'madera-turquesa', 'dominicano-azul', 'dominicano-bandera'];
    const oldTables = ['madera', 'verde', 'azul', 'rojo', 'bandera', 'tropical'];
    const oldMenus = ['madera', 'verde', 'azul', 'playa-ilustrada', 'atardecer-tropical'];
    for (const id of oldCardBacks) {
      assert.ok(CARD_BACK_THEMES.some((t) => t.id === id), id);
      assert.notEqual(shopPrice('cardBack', id), null, id);
    }
    for (const id of oldTables) {
      assert.ok(TABLE_THEMES.some((t) => t.id === id), id);
      assert.notEqual(shopPrice('table', id), null, id);
    }
    for (const id of oldMenus) {
      assert.ok(MENU_THEMES.some((t) => t.id === id), id);
      assert.notEqual(shopPrice('menu', id), null, id);
    }
  });
});

describe('cruz dominicana (marca de agua)', () => {
  it('hexToRgbChannels convierte cada color de la paleta a "r g b"', () => {
    assert.equal(hexToRgbChannels('#002D62'), '0 45 98');
    assert.equal(hexToRgbChannels('#CE1126'), '206 17 38');
    assert.equal(hexToRgbChannels('#FFFFFF'), '255 255 255');
    assert.equal(hexToRgbChannels('#E8A020'), '232 160 32');
    assert.equal(hexToRgbChannels('#0EA5B7'), '14 165 183');
    for (const color of Object.values(DOMINICAN_PALETTE)) {
      assert.match(hexToRgbChannels(color), /^\d{1,3} \d{1,3} \d{1,3}$/, color);
    }
  });

  it('la cruz es visible a simple vista: opacidad 0.09 en un solo valor', () => {
    const cross = css.slice(css.indexOf('.dominican-cross'), css.indexOf('.wood-panel'));
    assert.ok(cross.length > 0, 'se encontró la clase .dominican-cross');
    assert.ok(cross.includes('/ 0.09'), 'la opacidad es 0.09');
    assert.ok(!cross.includes('/ 0.05'), 'no queda la opacidad vieja 0.05');
    assert.ok(cross.includes('--dominican-cross-rgb'), 'el color se puede teñir con la variable');
    assert.ok(cross.includes('pointer-events: none'), 'la cruz nunca intercepta toques');
  });

  it('la cruz vive en el menú, en la mesa y en la sala de espera (una por pantalla)', () => {
    assert.ok(
      lobby.includes("className={darkCross ? 'dominican-cross dominican-cross--dark' : 'dominican-cross'}"),
      'el menú lleva la cruz (blanca u oscura según el fondo)',
    );
    assert.ok(tableLayout.includes('className="dominican-cross"'), 'la mesa lleva la cruz');
    assert.ok(roomView.includes('className="dominican-cross"'), 'la sala de espera lleva la cruz');
    // Una sola por pantalla: WaitingRoom se monta dentro de la pantalla de
    // RoomView, así que no lleva su propia cruz (duplicaría la marca).
    const waitingRoom = readFileSync('src/components/WaitingRoom.tsx', 'utf8');
    assert.ok(!waitingRoom.includes('dominican-cross'), 'WaitingRoom no duplica la cruz');
  });

  it('la cruz de la sala de espera se tiñe con el acento del modo', () => {
    assert.ok(
      roomView.includes("'--dominican-cross-rgb': hexToRgbChannels(GAME_ENVIRONMENTS[room.game].accent)"),
      'la sala tiñe la cruz con el acento del modo',
    );
    assert.ok(roomView.includes("from '@/lib/dominicanPalette'"), 'RoomView importa el ayudante de la paleta');
  });
});

describe('cruz oscura en fondos claros del menú', () => {
  it('la lista oscura son exactamente las dos fotos claras, y solo esas', () => {
    assert.deepEqual([...DARK_CROSS_MENU_THEMES], ['playa-ilustrada', 'atardecer-tropical']);
    for (const id of DARK_CROSS_MENU_THEMES) {
      const theme = MENU_THEMES.find((t) => t.id === id);
      assert.ok(theme, id);
      // Son fotos, no gradientes: ahí es donde el blanco se pierde.
      assert.match(theme!.image, /url\(/, id);
    }
    assert.ok(!DARK_CROSS_MENU_THEMES.includes('madera'), 'la madera sigue con cruz blanca');
    assert.ok(!DARK_CROSS_MENU_THEMES.includes('palmeras'), 'palmeras sigue con cruz blanca');
  });

  it('el menú usa la variante oscura solo con esos fondos, teñida de azul bandera', () => {
    assert.ok(lobby.includes('DARK_CROSS_MENU_THEMES.includes(prefs.menu)'), 'el menú decide por el fondo equipado');
    assert.ok(lobby.includes('dominican-cross--dark'), 'el menú aplica la clase oscura');
    assert.ok(
      lobby.includes('hexToRgbChannels(DOMINICAN_PALETTE.azulBandera)'),
      'la cruz oscura se tiñe de azul bandera',
    );
    assert.ok(lobby.includes("from '@/lib/dominicanPalette'"), 'Lobby importa el ayudante de la paleta');
    assert.ok(lobby.includes("from '@/lib/visualPrefs'"), 'Lobby importa las preferencias visuales');
  });

  it('la variante oscura existe en CSS y es más marcada que la blanca (0.14 frente a 0.09)', () => {
    // Con la llave: el nombre también aparece en el comentario de la cruz base.
    const start = css.indexOf('.dominican-cross--dark {');
    assert.ok(start >= 0, 'existe la clase .dominican-cross--dark');
    const dark = css.slice(start, css.indexOf('.dominican-glow', start));
    assert.ok(dark.includes('/ 0.14'), 'la variante oscura usa 0.14');
    assert.ok(dark.includes('--dominican-cross-rgb'), 'la variante oscura se tiñe con la variable');
    // La variante solo cambia la opacidad: el trazo (tamaño y posición) lo
    // hereda de .dominican-cross, que se aplica junto a ella.
    assert.ok(!dark.includes('background-size'), 'la variante no redefine el trazo');
    assert.ok(!dark.includes('background-position'), 'la variante no redefine la posición');
    // La base sigue en 0.09: la variante no tocó la cruz de los fondos oscuros.
    const cross = css.slice(css.indexOf('.dominican-cross'), css.indexOf('.wood-panel'));
    assert.ok(cross.includes('/ 0.09'), 'la cruz base sigue en 0.09');
  });
});

describe('fondos animados (identidad dominicana)', () => {
  it('la cruz respira despacio y el resplandor flota: solo transform/opacity, ciclos lentos', () => {
    assert.ok(css.includes('@keyframes dominican-cross-breathe'), 'existe la respiración de la cruz');
    assert.ok(css.includes('@keyframes dominican-glow-drift'), 'existe la deriva del resplandor');
    assert.ok(css.includes('@keyframes table-halo-breathe'), 'existe la respiración del halo de la mesa');
    assert.ok(css.includes('animation: dominican-cross-breathe 7s'), 'la cruz respira en 7 s');
    assert.ok(css.includes('animation: dominican-glow-drift 26s'), 'el resplandor flota en 26 s');
    assert.ok(css.includes('animation: table-halo-breathe 8s'), 'el halo respira en 8 s');
    // Solo transform y opacity en los keyframes: nada que mueva el layout.
    for (const name of ['dominican-cross-breathe', 'dominican-glow-drift', 'table-halo-breathe']) {
      const start = css.indexOf(`@keyframes ${name}`);
      assert.ok(start >= 0, `se encontró ${name}`);
      const block = css.slice(start, css.indexOf('@media (prefers-reduced-motion', start));
      const declarations = block.replace(/@keyframes \w+|from|to|[0-9]+%|[{}]/g, '');
      assert.ok(!/\b(width|height|top|left|margin|padding|background-position)\b/.test(declarations), `${name} no toca el layout`);
    }
    const drift = css.slice(css.indexOf('@keyframes dominican-glow-drift'));
    assert.ok(drift.includes('translate3d'), 'el resplandor se mueve con transform');
  });

  it('el resplandor vive en el menú y en la sala de espera, y el halo respira en la mesa', () => {
    assert.ok(lobby.includes('className="dominican-glow"'), 'el menú lleva el resplandor');
    assert.ok(roomView.includes('className="dominican-glow"'), 'la sala de espera lleva el resplandor');
    assert.ok(tableLayout.includes('table-halo-breathe'), 'el halo de la mesa respira');
    assert.ok(!tableLayout.includes('dominican-glow'), 'la mesa no duplica el resplandor del menú');
  });

  it('prefers-reduced-motion apaga las tres animaciones', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.ok(reduced.length > 0, 'existe el bloque de movimiento reducido');
    assert.ok(reduced.includes('.dominican-cross'), 'apaga la cruz');
    assert.ok(reduced.includes('.dominican-glow'), 'apaga el resplandor');
    assert.ok(reduced.includes('.table-halo-breathe'), 'apaga el halo');
    assert.ok(reduced.includes('animation: none'), 'las deja sin animación');
  });
});
