import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Las tarjetas no se pueden renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado en el
// código fuente, como hace waitingRoom.test.ts.
const gameCards = readFileSync('src/components/GameCards.tsx', 'utf8');

/**
 * Menú web (navegador de escritorio): las tarjetas de juego no se estiran
 * a lo alto de la ventana. En la captura de Alexis las tarjetas medían
 * ~700 px de alto con el arte pequeño y mucho marrón vacío debajo: la fila
 * era flex-1 y la imagen, contenida en un panel más alto que ancho, dejaba
 * bandas oscuras. La altura de la tarjeta la manda ahora su ancho.
 */
describe('menú web: proporción de las tarjetas', () => {
  it('en pantallas anchas y altas la tarjeta tiene proporción fija (aspect 3/4)', () => {
    assert.ok(
      gameCards.includes('[@media(min-width:640px)_and_(min-height:600px)]:aspect-[3/4]'),
      'la tarjeta fija su proporción en escritorio',
    );
  });

  it('la proporción exige altura mínima: en horizontal corto de teléfono no se aplica', () => {
    // Un teléfono en horizontal mide ~360 px de alto: si el aspect se
    // aplicara solo por ancho, las tarjetas se cortarían (el menú no tiene
    // scroll). La condición de altura protege el APK.
    assert.ok(gameCards.includes('min-height:600px'), 'hay condición de altura mínima');
    assert.ok(!gameCards.includes('min-[640px]:aspect-'), 'el aspect no depende solo del ancho');
  });

  it('la fila centra las tarjetas en vertical cuando tienen proporción fija', () => {
    assert.ok(
      gameCards.includes('[@media(min-width:640px)_and_(min-height:600px)]:items-center'),
      'las tarjetas quedan centradas en la fila alta',
    );
  });

  it('el arte llena su panel: cover a tamaño completo, sin contain', () => {
    assert.ok(gameCards.includes('h-full w-full rounded-lg object-cover'), 'la imagen cubre el panel');
    assert.ok(!gameCards.includes('object-contain'), 'ninguna imagen usa contain');
  });

  it('el panel de arte no tiene tope de altura que deje hueco marrón', () => {
    assert.ok(!gameCards.includes('max-h-[52%]'), 'el arte ocupa todo lo que sobra');
  });
});
