import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Las mesas no se pueden renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado en el
// código fuente, como hace waitingRoom.test.ts.
const chips = readFileSync('src/components/table/chips.tsx', 'utf8');
const plaque = readFileSync('src/components/cagao/PlayerSeat.tsx', 'utf8');
const casino = readFileSync('src/components/CasinoTable.tsx', 'utf8');
const cagao = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
const tresydos = readFileSync('src/components/TresYDosTable.tsx', 'utf8');
const robaito = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');
const tableBuild = readFileSync('src/components/TableBuild.tsx', 'utf8');
const pilePad = readFileSync('src/components/robaito/PilePad.tsx', 'utf8');

describe('píldora de turno fija en la barra superior', () => {
  it('la píldora tiene ancho fijo y el texto se recorta', () => {
    const pill = chips.slice(chips.indexOf('aria-live="polite"'), chips.indexOf('aria-live="polite"') + 500);
    assert.ok(pill.includes('w-[7.5rem]'), 'la píldora mide 7.5rem siempre');
    assert.ok(pill.includes('truncate'), 'el texto se recorta con puntos suspensivos');
    assert.ok(pill.includes('text-center'), 'el texto va centrado');
    assert.ok(!pill.includes('whitespace-nowrap'), 'la píldora ya no crece con el texto');
  });
});

describe('placas de jugador de tamaño fijo', () => {
  it('el nombre ocupa siempre 10 caracteres', () => {
    assert.ok(plaque.includes('w-[10ch]'), 'el nombre tiene ancho fijo de 10ch');
  });

  it('la insignia de nivel tiene ancho fijo para dos cifras', () => {
    assert.ok(plaque.includes('w-[2ch]'), 'el número de nivel tiene ancho fijo de 2ch');
    assert.ok(plaque.includes('tabular-nums'), 'el número de nivel usa cifras tabulares');
  });

  it('la sub-línea siempre ocupa su fila, sin partirse', () => {
    assert.ok(!plaque.includes('{hasSubLine && ('), 'la sub-línea ya no aparece y desaparece');
    assert.ok(plaque.includes('invisible">Salvó'), 'sin contenido, un hueco invisible reserva la altura');
    assert.ok(!plaque.includes('flex-wrap'), 'la sub-línea ya no se parte en dos líneas');
    assert.ok(plaque.includes('max-w-[9ch] truncate'), 'la etiqueta se recorta a 9 caracteres');
  });

  it('el abanico del asiento de arriba tiene ancho fijo, dimensionado a lo que mide el abanico', () => {
    // El tope ya no es 28dvw/300px: reservaba más del doble de lo que mide el abanico (unas 110 px con
    // la mano llena) y ese hueco vacío empujaba la placa contra la ficha de mazo. El ancho sigue
    // siendo fijo para que la placa y los paneles no se muevan cuando se juegan cartas.
    assert.ok(
      plaque.includes('w-[min(var(--top-avail,14dvw),110px)]'),
      'el abanico de arriba ocupa siempre su tope (14dvw, máx. 110 px)',
    );
    assert.ok(!plaque.includes('28dvw'), 'el abanico de arriba ya no reserva 28dvw');
    assert.ok(!plaque.includes('300px'), 'el abanico de arriba ya no reserva 300 px');
  });

  it('el abanico de los costados cabe en la fila del tablero', () => {
    // El asiento lateral (placa + abanico girado) era más alto que la fila del tablero en horizontal
    // corto y la placa se montaba sobre la fila de arriba. El largo del abanico es ahora 16dvh.
    assert.ok(plaque.includes("height: 'min(16dvh, 120px)'"), 'el abanico lateral mide 16dvh, máx. 120 px');
    assert.ok(!plaque.includes("height: 'min(24dvh, 175px)'"), 'el abanico lateral ya no mide 24dvh');
  });
});

describe('fichas de la barra superior con ancho fijo', () => {
  it('las fichas de contador tienen ancho fijo y contenido centrado', () => {
    for (const [name, src] of [
      ['Casino', casino],
      ['El Cagao', cagao],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(src.includes('w-[4.5rem]'), `${name}: la ficha mide 4.5rem`);
      assert.ok(src.includes('justify-center'), `${name}: la ficha centra el contenido`);
    }
    assert.ok(tresydos.includes('w-[6.75rem]'), 'Tres y Dos: la ficha de ronda mide 6.75rem');
    assert.ok(tresydos.includes('justify-center'), 'Tres y Dos: la ficha centra el contenido');
  });

  it('la ficha de puntaje de Casino reserva el hueco del candado y usa cifras tabulares en viraos', () => {
    assert.ok(casino.includes("invisible'"), 'el candado tiene su hueco invisible cuando no hay cierre');
    const viraos = casino.slice(casino.indexOf('state.viraos[team]') - 200, casino.indexOf('state.viraos[team]'));
    assert.ok(viraos.includes('tabular-nums'), 'los viraos usan cifras tabulares');
  });
});

describe('insignia de combinación y paquetes fijos', () => {
  it('la insignia "Suma/Par" va anclada a la izquierda del grupo', () => {
    const badge = tableBuild.slice(tableBuild.indexOf('animate-combo-label'), tableBuild.indexOf('animate-combo-label') + 400);
    assert.ok(badge.includes('-left-2'), 'la insignia va a la izquierda');
    assert.ok(!badge.includes('-right-2'), 'la insignia ya no va a la derecha');
  });

  it('la etiqueta del paquete de El Robaíto tiene tope y el contador ancho mínimo', () => {
    assert.ok(pilePad.includes('max-w-24 truncate'), 'la etiqueta se recorta a 6rem');
    assert.ok(pilePad.includes('min-w-[1.25rem]'), 'el contador tiene ancho mínimo');
  });
});
