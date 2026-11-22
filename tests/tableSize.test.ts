import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Las mesas no se pueden renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado y el
// CSS en el código fuente, como hacen desktopWeb.test.ts y lobbyWeb.test.ts.
const css = readFileSync('src/index.css', 'utf8');
const layout = readFileSync('src/components/table/TableLayout.tsx', 'utf8');
const casino = readFileSync('src/components/CasinoTable.tsx', 'utf8');
const playerSeat = readFileSync('src/components/cagao/PlayerSeat.tsx', 'utf8');

// La mesa de El Robaíto es la referencia de tamaño: su fieltro se veía
// proporcionado y lleno, mientras el de Casino era 15 px más estrecho (sus
// columnas laterales eran del 17%), el de El Cagao con 6 jugadores quedaba
// aplastado (~30 px menos de alto por las placas apiladas de arriba) y el de
// Casino y Tres y Dos crecía 24 px a mitad de partida cuando se escondía la
// pista. El tablero es la fila flexible de la rejilla, así que su alto es lo
// que sobra: para que sobre lo mismo en los 4 modos, las filas que cambian
// de un modo a otro tienen altura mínima.
describe('mesa igual en los 4 modos (referencia: El Robaíto)', () => {
  it('la fila superior tiene altura mínima en pantallas cortas', () => {
    assert.ok(layout.includes('table-top-row'), 'la fila de rivales de arriba lleva la clase .table-top-row');
    assert.ok(css.includes('@media (max-height: 599px)'), 'index.css tiene la media query de pantallas cortas');
    const block = css.slice(css.indexOf('@media (max-height: 599px)'));
    assert.ok(block.includes('.table-top-row'), 'la regla de la fila superior vive en la media query de pantallas cortas');
    assert.ok(
      block.includes('min-height: calc(var(--oh) + 28px)'),
      'la fila superior reserva la altura del contenido más alto (el paquete de El Robaíto)',
    );
    // La regla no está dentro del bloque de escritorio grande: allí la fila
    // ya mide lo mismo en los 3 modos sin apilar y la mínima la encogería.
    assert.ok(
      css.indexOf('@media (max-height: 599px)') < css.indexOf('@media (min-width: 640px) and (min-height: 600px)'),
      'la regla de pantallas cortas va antes del bloque de escritorio, no dentro de él',
    );
  });

  it('el carril de la pista reserva el hueco de una píldora aunque esté vacío', () => {
    assert.ok(layout.includes('table-hint-row'), 'las dos ramas del carril de la pista llevan la clase .table-hint-row');
    assert.ok(css.includes('.table-hint-row'), 'index.css tiene la regla del carril de la pista');
    const block = css.slice(css.indexOf('.table-hint-row'));
    assert.ok(block.includes('min-height: 24px'), 'el carril reserva ~24 px, lo que mide una píldora');
  });

  it('Casino usa las mismas columnas laterales que los demás modos', () => {
    assert.ok(casino.includes('sideCols="16%"'), 'Casino usa sideCols 16% como Tres y Dos, El Cagao y El Robaíto');
    assert.ok(!casino.includes('sideCols="17%"'), 'Casino ya no usa el 17% que le quitaba 15 px de tablero');
  });

  it('el abanico apilado de El Cagao con 6 jugadores cabe en la fila superior', () => {
    // A tamaño completo la unidad apilada (placa compacta + abanico) mide
    // ~88 px y se come ~30 px del tablero. Con --oh-s al 70% mide ~75 px,
    // dentro del mínimo de la fila superior. La variable tiene nombre propio
    // (--oh-s) porque redefinir --oh desde sí misma invalida la propiedad y
    // las cartas de arriba colapsaban a 0 px en escritorio.
    assert.ok(playerSeat.includes("'--oh-s': 'calc(var(--oh) * 0.7)'"), 'el asiento apilado define --oh-s al 70% de --oh');
    assert.ok(playerSeat.includes("heightVar={fanHeightVar}"), 'el abanico apilado usa la variable de altura apilada');
    assert.ok(playerSeat.includes('stacked-fan-wrap'), 'el hueco del abanico apilado usa la clase .stacked-fan-wrap');
    assert.ok(css.includes('.stacked-fan-wrap'), 'index.css tiene la regla del hueco del abanico apilado');
    assert.ok(css.includes('height: calc(var(--oh-s) + 14px)'), 'en escritorio el hueco apilado tiene 14 px de holgura');
    assert.ok(css.includes('height: calc(var(--oh-s) + 10px)'), 'en pantallas cortas el hueco apilado tiene 10 px de holgura');
    assert.ok(!playerSeat.includes("'--oh': 'calc(var(--oh)"), 'ninguna variable se redefine desde sí misma');
    assert.ok(playerSeat.includes('stacked'), 'la rama apilada sigue existiendo para 6 jugadores');
  });

  it('el bloque de escritorio grande sigue intacto', () => {
    const desktop = css.slice(css.indexOf('@media (min-width: 640px) and (min-height: 600px)'));
    assert.ok(desktop.includes('--ch-max: 208px'), 'en escritorio la mano sigue subiendo a 208px');
    assert.ok(desktop.includes('grid-template-columns: 12% minmax(0, 1fr) 12% !important'), 'en escritorio las columnas laterales siguen en 12%');
  });

  it('los botones de acción caben en la columna estrecha de horizontal corto', () => {
    // Al igualar las columnas laterales de Casino al 16%, el botón "Capturar"
    // pedía 49 px y solo tenía 46 px: la 'r' se cortaba a 800x360 y a 819x378
    // (medido en el navegador: scrollWidth 49 > clientWidth 46). En pantallas
    // cortas el texto baja a 9 px y el padding a 2 px; en escritorio sigue a 10 px.
    const styles = readFileSync('src/components/table/styles.ts', 'utf8');
    assert.ok(
      styles.includes('[@media(max-height:599px)]:text-[9px]'),
      'en pantallas cortas los botones de acción usan 9 px',
    );
    assert.ok(
      styles.includes('[@media(max-height:599px)]:px-[2px]'),
      'en pantallas cortas los botones de acción usan padding de 2 px',
    );
    assert.ok(styles.includes('text-[10px]'), 'en escritorio los botones siguen a 10 px');
  });
});
