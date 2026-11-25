import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  CONFETTI_COLORS,
  DOMINICAN_PALETTE,
  isValidHex,
} from '../src/lib/dominicanPalette';
import {
  CARD_BACK_THEMES,
  DEFAULT_VISUAL_PREFS,
  GAME_ENVIRONMENTS,
  MENU_THEMES,
  TABLE_THEMES,
} from '../src/lib/visualPrefs';
import { shopPrice } from '../src/lib/economy';

// Los componentes no se pueden renderizar en Node: RoomView y Lobby usan el
// alias `@/` en su cadena de imports y el runner tsx no lo resuelve. Se
// comprueba el marcado en el código fuente, como hace seatPlaque.test.ts.
const css = readFileSync('src/index.css', 'utf8');
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
const tableLayout = readFileSync('src/components/table/TableLayout.tsx', 'utf8');
const visualPrefs = readFileSync('src/lib/visualPrefs.ts', 'utf8');
const paletteSrc = readFileSync('src/lib/dominicanPalette.ts', 'utf8');

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

  it('el confeti usa solo azul, rojo, blanco y ámbar de la bandera', () => {
    const expected = new Set([
      DOMINICAN_PALETTE.azulBandera,
      DOMINICAN_PALETTE.rojoBandera,
      DOMINICAN_PALETTE.blanco,
      DOMINICAN_PALETTE.ambar,
    ]);
    assert.deepEqual(new Set(CONFETTI_COLORS), expected);
    for (const color of CONFETTI_COLORS) assert.match(color, HEX);
  });
});

describe('temas nuevos de la tienda', () => {
  it('los catálogos incluyen los temas dominicanos nuevos', () => {
    assert.ok(CARD_BACK_THEMES.some((t) => t.id === 'larimar'));
    assert.ok(CARD_BACK_THEMES.some((t) => t.id === 'ambar'));
    assert.ok(TABLE_THEMES.some((t) => t.id === 'mar-caribe'));
    assert.ok(TABLE_THEMES.some((t) => t.id === 'cana'));
    assert.ok(MENU_THEMES.some((t) => t.id === 'palmeras'));
    assert.ok(MENU_THEMES.some((t) => t.id === 'fiesta-tropical'));
    // Los nuevos temas de mesa y menú son gradientes CSS, no imágenes.
    for (const theme of TABLE_THEMES.filter((t) => t.id === 'mar-caribe' || t.id === 'cana')) {
      assert.match(theme.image, /gradient/);
    }
    const palmeras = MENU_THEMES.find((t) => t.id === 'palmeras');
    assert.match(palmeras!.image, /gradient/);
    assert.doesNotMatch(palmeras!.image, /url\(/);
    // La Fiesta tropical sí es una imagen (ilustración), como las otras dos
    // fotos del menú.
    const fiesta = MENU_THEMES.find((t) => t.id === 'fiesta-tropical');
    assert.match(fiesta!.image, /url\(".*fiesta-tropical\.webp"\)/);
    assert.equal(fiesta!.label, 'Fiesta tropical');
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
    // La Fiesta tropical es el fondo por defecto: gratis, como la madera.
    assert.equal(shopPrice('menu', 'fiesta-tropical'), 0);
    assert.equal(shopPrice('menu', 'madera'), 0);
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

describe('sin cruz dominicana', () => {
  it('no queda ningún rastro de la cruz en el CSS ni en las pantallas', () => {
    for (const [name, source] of [
      ['index.css', css],
      ['Lobby.tsx', lobby],
      ['RoomView.tsx', roomView],
      ['TableLayout.tsx', tableLayout],
    ] as const) {
      assert.ok(!source.includes('dominican-cross'), `${name} ya no menciona la cruz`);
    }
    assert.ok(!css.includes('dominican-cross-breathe'), 'el keyframe de la cruz tampoco queda');
    assert.ok(!visualPrefs.includes('DARK_CROSS_MENU_THEMES'), 'la lista oscura de la cruz no existe');
    assert.ok(!paletteSrc.includes('hexToRgbChannels'), 'el ayudante de la cruz no existe');
  });

  it('la identidad sigue sin la cruz: brillo, halo y colores por modo intactos', () => {
    assert.ok(css.includes('.dominican-glow'), 'el resplandor sigue en el CSS');
    assert.ok(css.includes('.table-halo-breathe'), 'el halo de la mesa sigue en el CSS');
    assert.ok(lobby.includes('className="dominican-glow"'), 'el menú sigue con su resplandor');
    assert.ok(roomView.includes('className="dominican-glow"'), 'la sala sigue con su resplandor');
  });
});

describe('fondos animados (identidad dominicana)', () => {
  it('el resplandor flota y el halo respira: solo transform/opacity, ciclos lentos', () => {
    assert.ok(css.includes('@keyframes dominican-glow-drift'), 'existe la deriva del resplandor');
    assert.ok(css.includes('@keyframes table-halo-breathe'), 'existe la respiración del halo de la mesa');
    assert.ok(css.includes('animation: dominican-glow-drift 26s'), 'el resplandor flota en 26 s');
    assert.ok(css.includes('animation: table-halo-breathe 8s'), 'el halo respira en 8 s');
    // Solo transform y opacity en los keyframes: nada que mueva el layout.
    for (const name of ['dominican-glow-drift', 'table-halo-breathe']) {
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

  it('prefers-reduced-motion apaga las dos animaciones', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.ok(reduced.length > 0, 'existe el bloque de movimiento reducido');
    assert.ok(reduced.includes('.dominican-glow'), 'apaga el resplandor');
    assert.ok(reduced.includes('.table-halo-breathe'), 'apaga el halo');
    assert.ok(reduced.includes('animation: none'), 'las deja sin animación');
  });
});

describe('fondo Fiesta tropical por default', () => {
  it('el fondo por defecto al instalar es la Fiesta tropical, no la madera', () => {
    assert.equal(DEFAULT_VISUAL_PREFS.menu, 'fiesta-tropical');
    assert.equal(DEFAULT_VISUAL_PREFS.table, 'madera');
    assert.equal(DEFAULT_VISUAL_PREFS.cardBack, 'cacao');
  });

  it('la sala de espera muestra el fondo de menú equipado con el tinte del modo', () => {
    // RoomView ya no impone su degradado marrón: usa las variables que
    // App.tsx define en la raíz con el tema de menú equipado.
    assert.ok(roomView.includes('var(--menu-bg-image'), 'la sala usa la imagen del fondo de menú');
    assert.ok(roomView.includes('var(--menu-bg-color'), 'la sala usa el color del fondo de menú');
    assert.ok(
      roomView.includes("GAME_ENVIRONMENTS[room.game].accent}40"),
      'el tinte del acento del modo sigue por encima',
    );
    assert.ok(roomView.includes('className="dominican-glow"'), 'el resplandor sigue en la sala');
    // Con 'madera' equipada las variables valen su degradado: la sala se ve
    // como antes (el degradado marrón era el fondo de ese tema).
    assert.ok(
      roomView.includes("radial-gradient(ellipse at 50% 35%, #4a2a12, #1e0e05 75%)"),
      'el respaldo con madera es el degradado de antes',
    );
  });
});
