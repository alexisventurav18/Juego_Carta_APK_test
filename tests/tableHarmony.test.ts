import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Armonía de la mesa (2026-11-21): las capturas de Alexis mostraban la fila superior saturada — el
// panel "Nosotros" se comía la ficha de capturadas, "Tu turno" tapaba el panel "Ellos", las placas de
// arriba perdían el nombre y la pista se dibujaba sobre el tablero. La rejilla pasó a tener un carril
// por cosa: barra de controles | rivales de arriba | tablero | pista | tu zona. Como las mesas no se
// pueden renderizar en Node (el alias `@/`), se comprueba el marcado en el código fuente.
const layout = readFileSync('src/components/table/TableLayout.tsx', 'utf8');
const chips = readFileSync('src/components/table/chips.tsx', 'utf8');
const plaque = readFileSync('src/components/cagao/PlayerSeat.tsx', 'utf8');
const casino = readFileSync('src/components/CasinoTable.tsx', 'utf8');
const cagao = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
const tresydos = readFileSync('src/components/TresYDosTable.tsx', 'utf8');
const robaito = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');
const pilePad = readFileSync('src/components/robaito/PilePad.tsx', 'utf8');

/** Sin comentarios: las aserciones "ya no usa X" no deben tropezar con los comentarios que explican el cambio. */
const stripComments = (src: string) =>
  src
    .replace(/\{[ \t]*\/\*[\s\S]*?\*\/[ \t]*\}/g, '')
    .replace(/\/\/[^\n]*/g, '');
const plaqueCode = stripComments(plaque);
const tresydosCode = stripComments(tresydos);
const robaitoCode = stripComments(robaito);
const pilePadCode = stripComments(pilePad);

const tables = [
  ['Casino', casino],
  ['El Cagao', cagao],
  ['Tres y Dos', tresydos],
  ['El Robaíto', robaito],
] as const;

/** Recorta el bloque de una prop JSX (`prop={` ... hasta su cierre `}` a mismo nivel). */
function propBlock(src: string, prop: string): string {
  const start = src.indexOf(`${prop}={`);
  assert.ok(start >= 0, `existe la prop ${prop}`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`no se cerró la prop ${prop}`);
}

describe('un carril por cosa: la fila superior ya no es una sola fila de tres celdas', () => {
  it('TableLayout tiene cuatro filas: controles | arriba | tablero | tu zona', () => {
    assert.ok(
      layout.includes("gridTemplateRows: 'auto auto minmax(0,1fr) 30%'"),
      'la rejilla tiene cuatro filas; la pista flota sobre el tablero y ya no tiene carril',
    );
    assert.ok(!layout.includes('21%'), 'la fila superior ya no es un 21% compartido');
  });

  it('la barra de controles y la fila de arriba van a todo lo ancho', () => {
    assert.ok(layout.includes('controlsLeft'), 'TableLayout recibe controlsLeft');
    assert.ok(layout.includes('controlsCenter'), 'TableLayout recibe controlsCenter');
    assert.ok(layout.includes('controlsRight'), 'TableLayout recibe controlsRight');
    assert.ok(layout.includes('topSeats'), 'TableLayout recibe topSeats');
    assert.ok(!layout.includes('topLeft'), 'ya no existe topLeft');
    assert.ok(!layout.includes('topCenter'), 'ya no existe topCenter');
    assert.ok(!layout.includes('topRight'), 'ya no existe topRight');
  });

  it('las cuatro mesas usan las props nuevas', () => {
    for (const [name, src] of tables) {
      for (const prop of ['controlsLeft', 'controlsCenter', 'controlsRight', 'topSeats']) {
        assert.ok(src.includes(`${prop}=`), `${name}: pasa ${prop}`);
      }
      assert.ok(!src.includes('topLeft='), `${name}: ya no pasa topLeft`);
      assert.ok(!src.includes('topCenter='), `${name}: ya no pasa topCenter`);
      assert.ok(!src.includes('topRight='), `${name}: ya no pasa topRight`);
    }
  });
});

describe('la píldora de turno no comparte contenedor con los paneles de puntos', () => {
  it('en Casino los paneles van en topSeats y la píldora en controlsCenter', () => {
    const seats = propBlock(casino, 'topSeats');
    assert.ok(seats.includes('scoreChip'), 'topSeats lleva los paneles Nosotros/Ellos');
    assert.ok(seats.includes('renderSeat'), 'topSeats lleva el asiento de arriba entre los paneles');
    assert.ok(!seats.includes('TurnSound'), 'topSeats no lleva la píldora de turno');
    const center = propBlock(casino, 'controlsCenter');
    assert.ok(center.includes('TurnSound'), 'controlsCenter lleva la píldora de turno');
    assert.ok(!center.includes('scoreChip'), 'controlsCenter no lleva los paneles de puntos');
  });

  it('el engranaje vive en su propia esquina, fuera de la píldora', () => {
    const turnSound = chips.slice(chips.indexOf('export function TurnSound'), chips.indexOf('export function TurnSound') + 1600);
    assert.ok(!turnSound.includes('OptionsButton'), 'TurnSound ya no dibuja el engranaje');
    for (const [name, src] of tables) {
      assert.ok(src.includes('controlsRight={<OptionsButton />}'), `${name}: el engranaje va en controlsRight`);
    }
  });
});

describe('la pista flota sobre la franja inferior del tablero', () => {
  it('TableLayout dibuja la pista como overlay dentro de la celda del tablero', () => {
    assert.ok(layout.includes('hint?: ReactNode'), 'TableLayout recibe la pista como prop');
    assert.ok(!layout.includes('table-hint-row'), 'ya no existe el carril de la pista');
    assert.ok(
      layout.includes('pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center'),
      'la pista flota a 16 px del borde inferior del tablero, sin bloquear toques',
    );
  });

  it('ninguna mesa dibuja la pista por su cuenta', () => {
    for (const [name, src] of tables) {
      assert.ok(src.includes('hint={'), `${name}: la pista va en la prop hint`);
      assert.ok(!src.includes('absolute bottom-0'), `${name}: sin pista absoluta dibujada por la mesa`);
    }
  });

  it('el aviso de la última jugada tampoco lo dibuja la mesa (vive en la prop hint)', () => {
    for (const [name, src] of [
      ['El Cagao', cagao],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(!src.includes('absolute inset-x-0 top-1'), `${name}: sin aviso absoluto sobre el tablero`);
      const hint = propBlock(src, 'hint');
      assert.ok(hint.includes('role="status"'), `${name}: el aviso va en la prop hint`);
      assert.ok(hint.includes('animate-combo-label'), `${name}: el aviso conserva su animación`);
    }
    assert.ok(propBlock(robaito, 'hint').includes('describeEvent(event, seat, names)'), 'El Robaíto: el aviso describe la jugada');
    assert.ok(propBlock(cagao, 'hint').includes('event.pair'), 'El Cagao: el aviso describe el par robado');
    assert.ok(propBlock(cagao, 'hint').includes('!event && showStartHint'), 'El Cagao: la pista inicial se esconde si hay aviso');
    assert.ok(propBlock(robaito, 'hint').includes('!event && showStartHint'), 'El Robaíto: la pista inicial se esconde si hay aviso');
  });

  it('las cartas no entran en la franja de la pista (Casino y El Robaíto)', () => {
    // La franja inferior del tablero mide ~36 px (píldora de 20 px a 16 px del borde): las
    // cartas de Casino y los paquetes de El Robaíto no bajan del 24% inferior, así que
    // nunca se montan sobre la pista. En Tres y Dos el contenido va centrado con el 22%
    // libre abajo y en El Cagao la pila va centrada.
    assert.ok(casino.includes('bottom-[24%]'), 'Casino: las cartas no bajan del 24% inferior');
    assert.ok(robaito.includes('bottom-[24%]'), 'El Robaíto: los paquetes no bajan del 24% inferior');
  });
});

describe('abanicos de arriba: escalan por número de rivales', () => {
  it('el abanico tiene ancho fijo dimensionado a lo que mide (no 28dvw)', () => {
    assert.ok(plaqueCode.includes('w-[min(var(--top-avail,14dvw),110px)]'), 'el hueco del abanico es 14dvw, máx. 110 px');
    assert.ok(!plaqueCode.includes('28dvw'), 'el abanico ya no reserva 28dvw');
  });

  it('con tres rivales arriba la placa va encima del abanico (El Cagao, 6 jugadores)', () => {
    assert.ok(
      cagao.includes("stacked={side === 'top' && game.layout.top.length >= 3}"),
      'El Cagao apila el asiento cuando hay 3 rivales arriba',
    );
    assert.ok(plaque.includes('stacked'), 'PlayerSeat conoce el modo apilado');
    assert.ok(plaque.includes('flex min-w-0 flex-col items-center'), 'el asiento apilado es una columna');
    assert.ok(cagao.includes("'--top-avail': game.layout.top.length >= 3 ? '13dvw' : '16dvw'"), 'El Cagao cede ancho con 3 arriba');
  });
});

describe('paquetes y mazos: contador dentro, etiqueta en su propia línea', () => {
  it('PilePad lleva el contador dentro de la carta y la etiqueta en su línea', () => {
    assert.ok(pilePadCode.includes('absolute right-1 top-1'), 'el contador va dentro de la carta');
    assert.ok(!pilePadCode.includes('-right-2 -top-2'), 'el contador ya no cuelga fuera de la carta');
    assert.ok(!pilePadCode.includes('-mt-2'), 'la etiqueta ya no va pegada bajo la carta');
    assert.ok(pilePadCode.includes('max-w-24 truncate'), 'la etiqueta se recorta limpia dentro de su línea');
  });

  it('Monte, Pozo y Mazo llevan el contador dentro y la etiqueta en su línea', () => {
    assert.ok(!tresydosCode.includes('-right-2 -top-2'), 'Tres y Dos: el contador del Monte ya no cuelga fuera');
    assert.ok(!tresydosCode.includes('-mt-2'), 'Tres y Dos: Monte/Pozo ya no pegan la etiqueta a la carta');
    assert.ok(tresydosCode.includes('mt-1 rounded-full'), 'Tres y Dos: la etiqueta tiene su línea con margen');
    assert.ok(!robaitoCode.includes('-right-2 -top-2'), 'El Robaíto: el contador del Mazo ya no cuelga fuera');
    assert.ok(!robaitoCode.includes('-mt-2'), 'El Robaíto: la etiqueta del Mazo ya no va pegada a la carta');
  });

  it('el mazo de Casino ya no lleva el contador pintado sobre el dorso', () => {
    assert.ok(!casino.includes('[text-shadow:0_1px_3px_rgb(0_0_0/0.9)]'), 'el número ya no se pinta sobre la carta');
    const center = propBlock(casino, 'controlsCenter');
    assert.ok(center.includes('deckDisplayCount'), 'el contador del mazo vive en su ficha de la barra');
  });
});

describe('placas: el distintivo va dentro, sin colgar fuera', () => {
  it('el icono del paquete cabe dentro de la sub-línea', () => {
    assert.ok(!plaqueCode.includes('h-[21px]'), 'el icono del paquete ya no mide 21 px');
    assert.ok(plaqueCode.includes('h-[16px] w-[13px]'), 'el icono del paquete cabe en la línea');
    assert.ok(!plaqueCode.includes('-translate-y-[2px]'), 'las capas del icono ya no asoman 2 px');
  });

  it('ninguna placa usa posicionamiento que saque un distintivo fuera', () => {
    assert.ok(!plaqueCode.includes('-right-2 -top-2'), 'la placa no cuelga distintivos fuera');
    assert.ok(!plaqueCode.includes('-bottom-'), 'la placa no cuelga nada por debajo');
  });
});

describe('pantallas estrechas (<480 px): la barra de controles sigue cabiendo', () => {
  it('el icono de flujo se oculta: con chip de ronda + píldora + flujo no cabía y se montaba', () => {
    // El flujo es decorativo (el sentido del turno lo dicen la píldora y el brillo del asiento).
    const flowBlock = chips.slice(chips.indexOf('showFlow && ('));
    assert.ok(flowBlock.includes('max-[480px]:hidden'), 'el flujo se oculta por debajo de 480 px');
  });

  it('el chip de capturadas de Casino se oculta: se montaba sobre el chip del mazo', () => {
    const left = propBlock(casino, 'controlsLeft');
    assert.ok(left.includes('max-[480px]:hidden'), 'capturadas se oculta por debajo de 480 px');
    assert.ok(left.includes('setCapturedOpen(true)'), 'el chip sigue abriendo el detalle de capturadas');
  });

  it('las esquinas inferiores despegan del adorno del marco', () => {
    assert.ok(layout.includes("pl-[calc(var(--corner)*0.75)]"), 'la esquina inferior izquierda despega 0.75 del marco');
    assert.ok(layout.includes("pr-[calc(var(--corner)*0.75)]"), 'la esquina inferior derecha despega 0.75 del marco');
    assert.ok(!layout.includes("pl-[calc(var(--corner)*0.6)]"), 'ya no se usa el despeje 0.6 que rozaba el adorno');
  });
});
