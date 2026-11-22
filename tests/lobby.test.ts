import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GAMES } from '../src/games';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Armonía del menú: las descripciones y las líneas de jugadores tienen que
 * caber sin cortarse en la tarjeta más estrecha (vertical, ~125 px de ancho,
 * texto a 12 px: unas 16 letras por línea).
 */
describe('menú principal', () => {
  it('cada descripción cabe en 2 líneas en la tarjeta más estrecha', () => {
    for (const game of Object.values(GAMES)) {
      assert.ok(
        game.tagline.length <= 32,
        `${game.name}: la descripción tiene ${game.tagline.length} letras, más de 32 (2 líneas a 12 px en ~125 px)`,
      );
      assert.ok(!game.tagline.includes('…'), `${game.name}: la descripción no debe traer "…"`);
    }
  });

  it('la línea de jugadores es de una sola línea en los 4 modos', () => {
    for (const game of Object.values(GAMES)) {
      assert.ok(
        game.playerCountLabel.length <= 20,
        `${game.name}: "${game.playerCountLabel}" tiene ${game.playerCountLabel.length} letras, más de 20 (se partiría en 2 líneas)`,
      );
    }
  });

  it('la barra superior colapsa a iconos en horizontal corto y el título no se parte', () => {
    const lobby = read('src/components/Lobby.tsx');
    // Las etiquetas de texto se ocultan con poca altura o poco ancho.
    for (const label of ['Tienda', 'Misiones', 'Jugar rápido']) {
      assert.ok(
        lobby.includes(`[@media(max-height:500px)]:hidden">${label}</span>`),
        `Lobby: la etiqueta "${label}" debe ocultarse en pantallas bajas`,
      );
    }
    // El título no se parte en dos líneas y se recorta en vez de solaparse.
    assert.ok(lobby.includes('whitespace-nowrap'), 'Lobby: el título debe llevar whitespace-nowrap');
    assert.ok(lobby.includes('truncate">Cartas Dominicanas</span>'), 'Lobby: el título debe recortarse, no solaparse');
    // En vertical el título ocupa su propia fila.
    assert.ok(lobby.includes('order-first'), 'Lobby: el título debe ir primero en pantallas angostas');
  });

  it('la leyenda de Bots no se trunca y el pie tiene 3 secundarios iguales', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(!lobby.includes('max-w-[16rem] truncate'), 'Lobby: la leyenda de Bots no debe llevar truncate');
    assert.ok(lobby.includes('line-clamp-2'), 'Lobby: la leyenda de Bots debe poder ir en 2 líneas');
    const secondaryCaps = [...lobby.matchAll(/max-w-\[13rem\] flex-1 btn-/g)];
    assert.equal(secondaryCaps.length, 3, 'Lobby: los 3 botones secundarios deben tener el mismo tope (13rem)');
    // En vertical los secundarios van sin icono y a 12 px para que el texto
    // quepa entero ("Jugar online" no se puede cortar).
    assert.equal(
      [...lobby.matchAll(/truncate max-\[640px\]:text-\[12px\]">/g)].length,
      3,
      'Lobby: los 3 secundarios deben bajar a 12 px en vertical',
    );
  });

  it('las tarjetas son 2x2 en vertical y el arte llena su panel', () => {
    const cards = read('src/components/GameCards.tsx');
    assert.ok(cards.includes('grid-cols-2'), 'GameCards: en vertical las tarjetas van en 2 columnas');
    // Sin tope de altura: el arte ocupa todo lo que sobra de la tarjeta y
    // la imagen cubre el panel (antes, con tope y contain, quedaban bandas
    // oscuras y hueco marrón en el menú web).
    assert.ok(!cards.includes('max-h-[52%]'), 'GameCards: el arte no debe tener tope de altura');
    assert.ok(cards.includes('object-cover'), 'GameCards: la imagen debe cubrir su panel');
    assert.ok(cards.includes('whitespace-nowrap'), 'GameCards: la línea de jugadores no debe partirse');
    // En vertical el nombre no se parte ("Tres / y Dos") y la descripción
    // baja a 12 px para caber en la tarjeta angosta.
    assert.ok(cards.includes('max-[640px]:text-[15px]'), 'GameCards: el nombre debe achicarse en vertical');
    assert.ok(cards.includes('text-[12px]'), 'GameCards: la descripción debe ser 12 px en pantallas angostas');
  });

  it('el título y el relleno lateral miran el ancho en vertical', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(
      lobby.includes('max-[640px]:text-[20px]'),
      'Lobby: el título debe achicarse en vertical (si no, se recorta)',
    );
    assert.ok(
      lobby.includes('px-[clamp(8px,4vw,calc(var(--corner)*0.9))]'),
      'Lobby: el relleno lateral debe toparse por ancho en vertical',
    );
  });
});
