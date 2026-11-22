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

  it('el arte se ve entero fuera del escritorio (contain) y llena el panel en escritorio (cover)', () => {
    // En horizontal corto el panel es ancho y bajo (163×37 px a 819x378) y
    // con cover solo se veía la franja central del arte cuadrado (un 23% de
    // su altura): Alexis pedía ver las imágenes completas. Con contain la
    // imagen entra entera; en escritorio la tarjeta tiene aspect 3/4 y el
    // panel es casi cuadrado, así que ahí sigue el cover.
    assert.ok(gameCards.includes('object-contain'), 'fuera del escritorio el arte se contiene entero');
    assert.ok(
      gameCards.includes('[@media(min-width:640px)_and_(min-height:600px)]:object-cover'),
      'en escritorio el arte vuelve a cubrir el panel',
    );
    assert.ok(!gameCards.includes('rounded-lg object-cover '), 'el cover sin cualificar ya no existe');
  });

  it('el panel de arte no tiene tope de altura que deje hueco marrón', () => {
    assert.ok(!gameCards.includes('max-h-[52%]'), 'el arte ocupa todo lo que sobra');
  });
});
