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
      block.includes('min-height: calc(var(--oh) + 22px)'),
      'la fila superior reserva la altura del abanico de arriba (su carta más la holgura del giro)',
    );
    // La regla no está dentro del bloque de escritorio grande: allí la fila
    // ya mide lo mismo en los 3 modos sin apilar y la mínima la encogería.
    assert.ok(
      css.indexOf('@media (max-height: 599px)') < css.indexOf('@media (min-width: 640px) and (min-height: 600px)'),
      'la regla de pantallas cortas va antes del bloque de escritorio, no dentro de él',
    );
  });

  it('la pista flota sobre la franja inferior del tablero, sin carril propio', () => {
    // La pista ya no tiene fila: flota sobre la franja inferior del tablero (overlay absoluto
    // dentro de la celda central), así el tablero gana los 24 px del carril. La franja está
    // vacía en los 4 modos: en Casino y El Robaíto las cartas no bajan del 24% inferior y en
    // Tres y Dos el contenido va centrado con el 22% libre abajo; en El Cagao la pila va
    // centrada. La píldora mide ~20 px (py-0.5) y va a 16 px del borde (bottom-4): el hueco
    // entre la pila de El Cagao y una carta elegida de la mano, que se eleva 18 px (LIFT en
    // Fans.tsx), es de solo ~26 px, así que la píldora cabe con ~3 px de margen por cada lado.
    // Solo se dibuja un elemento de pista: en El Cagao y El Robaíto el aviso de la última
    // jugada tiene precedencia sobre la pista inicial; con los dos a la vez la píldora se
    // partía en dos líneas (40 px) y no cabía en el hueco. Es pointer-events-none para no
    // tapar toques.
    assert.ok(layout.includes('hint?: ReactNode'), 'TableLayout recibe la pista como prop');
    assert.ok(!layout.includes('table-hint-row'), 'ya no existe el carril de la pista');
    assert.ok(!layout.includes("'auto auto minmax(0,1fr) auto 30%'"), 'la rejilla ya no tiene cinco filas');
    assert.ok(
      layout.includes("gridTemplateRows: 'auto auto minmax(0,1fr) 30%'"),
      'la rejilla tiene cuatro filas: controles | arriba | tablero | tu zona',
    );
    assert.ok(
      layout.includes('pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center'),
      'la pista flota a 16 px del borde inferior del tablero, sin bloquear toques',
    );
    assert.ok(
      casino.includes('bottom-[24%]'),
      'en Casino las cartas no bajan del 24% inferior: no entran en la franja de la pista',
    );
    assert.ok(
      readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8').includes('bottom-[24%]'),
      'en El Robaíto los paquetes no bajan del 24% inferior',
    );
  });

  it('la pista es una sola píldora de ~20 px: el aviso tiene precedencia sobre la pista inicial', () => {
    // Con el aviso y la pista inicial a la vez, la píldora se partía en dos líneas (40 px) y
    // no cabía en el hueco de ~26 px entre la pila de El Cagao y la carta elegida de la mano.
    // El aviso (lo que acaba de pasar) tiene precedencia; la pista inicial vuelve cuando ya
    // no hay aviso. Las dos píldoras usan py-0.5 para medir ~20 px en vez de 24 px.
    const cagao = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
    const robaito = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');
    for (const [name, src] of [
      ['El Cagao', cagao],
      ['El Robaíto', robaito],
    ] as const) {
      assert.ok(src.includes('!event && showStartHint'), `${name}: la pista inicial se esconde si hay aviso`);
      assert.ok(src.includes('py-0.5'), `${name}: las píldoras usan py-0.5 (~20 px)`);
    }
    assert.ok(casino.includes('py-0.5'), 'Casino: la pista usa py-0.5 (~20 px)');
  });

  it('la pila de El Robaíto de arriba no lleva etiqueta: la fila no crece con el paquete', () => {
    // La pila crece con sus capas (hasta 3, +9 px) y su etiqueta añade ~17 px: con etiqueta la
    // fila superior de El Robaíto medía hasta ~70 px cuando el paquete engordaba y su tablero
    // quedaba ~8 px más bajo que el de los demás modos. Sin etiqueta la pila mide como mucho
    // ~49 px y cabe en el mínimo de la fila (~62 px). La etiqueta sobra ahí: el nombre ya va
    // en la placa de al lado; en los costados y abajo se conserva.
    const pilePad = readFileSync('src/components/robaito/PilePad.tsx', 'utf8');
    const robaito = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');
    assert.ok(pilePad.includes('showLabel?: boolean'), 'PilePad acepta ocultar la etiqueta');
    assert.ok(pilePad.includes('{showLabel && ('), 'la etiqueta solo se dibuja cuando showLabel');
    assert.ok(robaito.includes('pileOf(s, false)'), 'la pila de arriba se dibuja sin etiqueta');
    assert.ok(robaito.includes('const pileOf = (s: number, showLabel = true)'), 'pileOf pasa el indicador a PilePad');
  });

  it('Casino usa las mismas columnas laterales que los demás modos', () => {
    assert.ok(casino.includes('sideCols="16%"'), 'Casino usa sideCols 16% como Tres y Dos, El Cagao y El Robaíto');
    assert.ok(!casino.includes('sideCols="17%"'), 'Casino ya no usa el 17% que le quitaba 15 px de tablero');
    // La ampliación de mesas estrecha las columnas solo por CSS: 15% en pantallas
    // cortas y 11% en escritorio, con !important sobre el estilo inline.
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(
      short.includes('grid-template-columns: 15% minmax(0, 1fr) 15% !important'),
      'en pantallas cortas las columnas laterales son 15%',
    );
    const desktop = css.slice(css.indexOf('@media (min-width: 640px) and (min-height: 600px)'));
    assert.ok(
      desktop.includes('grid-template-columns: 11% minmax(0, 1fr) 11% !important'),
      'en escritorio las columnas laterales son 11%',
    );
  });

  it('el abanico apilado de El Cagao con 6 jugadores cabe en la fila superior', () => {
    // A tamaño completo la unidad apilada (placa compacta + abanico) mide
    // ~88 px y se come ~30 px del tablero. Con --oh-s al 65% mide ~68 px
    // en el teléfono y ~120 px en escritorio, dentro del mínimo de la fila
    // superior. La variable tiene nombre propio (--oh-s) porque redefinir
    // --oh desde sí misma invalida la propiedad y las cartas de arriba
    // colapsaban a 0 px en escritorio.
    assert.ok(playerSeat.includes("'--oh-s': 'calc(var(--oh) * 0.65)'"), 'el asiento apilado define --oh-s al 65% de --oh en la base');
    assert.ok(playerSeat.includes("heightVar={fanHeightVar}"), 'el abanico apilado usa la variable de altura apilada');
    assert.ok(playerSeat.includes('stacked-fan-wrap'), 'el hueco del abanico apilado usa la clase .stacked-fan-wrap');
    assert.ok(playerSeat.includes('stacked-seat'), 'la unidad apilada lleva la clase .stacked-seat para su ajuste de pantallas cortas');
    assert.ok(css.includes('.stacked-fan-wrap'), 'index.css tiene la regla del hueco del abanico apilado');
    assert.ok(css.includes('height: calc(var(--oh-s) + 14px)'), 'en escritorio el hueco apilado tiene 14 px de holgura');
    assert.ok(css.includes('height: calc(var(--oh-s) + 8px)'), 'en pantallas cortas el hueco apilado tiene 8 px de holgura');
    // En pantallas cortas la unidad se achica solo por CSS (--oh-s al 56% y hueco de 2 px):
    // mide ~58 px y cabe en el mínimo nuevo de la fila superior (~62 px). En escritorio
    // sigue al 65% con hueco de 4 px para no romper la igualdad de la fila superior allí.
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(short.includes('.stacked-seat'), 'el ajuste del asiento apilado vive en el bloque de pantallas cortas');
    assert.ok(short.includes('--oh-s: calc(var(--oh) * 0.56) !important'), 'en pantallas cortas el abanico apilado baja al 56%');
    assert.ok(short.includes('gap: 2px !important'), 'en pantallas cortas el hueco entre placa y abanico baja a 2 px');
    assert.ok(!playerSeat.includes("'--oh': 'calc(var(--oh)"), 'ninguna variable se redefine desde sí misma');
    assert.ok(playerSeat.includes('stacked'), 'la rama apilada sigue existiendo para 6 jugadores');
  });

  it('el bloque de escritorio grande sigue intacto', () => {
    const desktop = css.slice(css.indexOf('@media (min-width: 640px) and (min-height: 600px)'));
    assert.ok(desktop.includes('--ch-max: 208px'), 'en escritorio la mano sigue subiendo a 208px');
    assert.ok(desktop.includes('--oh-max: 96px'), 'en escritorio los rivales bajan a 96px para darle hueco al tablero');
    assert.ok(desktop.includes('grid-template-columns: 11% minmax(0, 1fr) 11% !important'), 'en escritorio las columnas laterales son 11%');
    assert.ok(desktop.includes('grid-template-rows: auto auto minmax(0, 1fr) 28% !important'), 'en escritorio la fila de tu zona baja al 28%');
  });

  it('los botones de acción caben en la columna estrecha de horizontal corto', () => {
    // Al estrechar las columnas laterales al 15% en pantallas cortas, el botón "Hacer Par"
    // pedía ~46 px y solo tenía ~42 px: se cortaba a 800x360 y a 800x480 (medido en el
    // navegador: scrollWidth > clientWidth). En pantallas cortas el texto baja a 8 px y el
    // padding a 2 px; en escritorio sigue a 10 px.
    const styles = readFileSync('src/components/table/styles.ts', 'utf8');
    assert.ok(
      styles.includes('[@media(max-height:599px)]:text-[8px]'),
      'en pantallas cortas los botones de acción usan 8 px',
    );
    assert.ok(
      styles.includes('[@media(max-height:599px)]:px-[2px]'),
      'en pantallas cortas los botones de acción usan padding de 2 px',
    );
    assert.ok(styles.includes('text-[10px]'), 'en escritorio los botones siguen a 10 px');
  });

  it('la fila de tu zona es más baja para que el tablero crezca', () => {
    // 30% en la rejilla (TableLayout), 26% en pantallas cortas (CSS) y 28% en escritorio: a
    // 800x360 la fila pasa de ~94 px a ~87 px y el tablero gana esos ~7 px de alto. El abanico
    // cabe porque su celda recortó el relleno superior (pt-4 → pt-1) e inferior (marco*1.5 → *0.5)
    // y porque los botones de El Cagao se achican en pantallas cortas (ver cagao-side-btn).
    assert.ok(layout.includes("gridTemplateRows: 'auto auto minmax(0,1fr) 30%'"), 'la rejilla usa 30% para la fila de tu zona');
    assert.ok(!layout.includes("auto 32%'"), 'la rejilla ya no usa el 32% que achicaba el tablero');
    assert.ok(layout.includes('pt-1'), 'la celda de la mano recorta el relleno superior a pt-1');
    assert.ok(layout.includes('pb-[calc(var(--frame)*0.5)]'), 'la celda de la mano recorta el relleno inferior a medio marco');
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(
      short.includes('grid-template-rows: auto auto minmax(0, 1fr) 26% !important'),
      'en pantallas cortas la fila de tu zona baja al 26%',
    );
    const desktop = css.slice(css.indexOf('@media (min-width: 640px) and (min-height: 600px)'));
    assert.ok(
      desktop.includes('grid-template-rows: auto auto minmax(0, 1fr) 28% !important'),
      'en escritorio la fila de tu zona baja al 28%',
    );
  });

  it('en pantallas cortas las cartas y las esquinas se achican un poco', () => {
    // --ch/--oh/--sh con !important sobre el estilo inline: la mano pasa de 85 px a ~76 px
    // y la fila superior de ~72-75 px a ~68 px a 800x360; --corner baja para que el relleno
    // de la esquina (corner*0.75) no se coma los botones de Casino en 2 columnas.
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(short.includes('--ch: clamp(54px, 21dvh, 157px) !important'), 'la mano baja a 21dvh en pantallas cortas');
    assert.ok(short.includes('--oh: clamp(34px, 11dvh, 83px) !important'), 'los rivales bajan a 11dvh en pantallas cortas');
    assert.ok(short.includes('--sh: clamp(34px, 11dvh, 84px) !important'), 'los paquetes bajan a 11dvh en pantallas cortas');
    assert.ok(short.includes('--corner: clamp(22px, 6dvh, 60px) !important'), 'las esquinas bajan a 6dvh en pantallas cortas');
    // La regla vive solo en pantallas cortas: en escritorio y retrato no se aplica.
    assert.ok(
      css.indexOf('Mesas más grandes en pantallas cortas') > css.indexOf('@media (max-height: 599px)'),
      'el bloque de mesas grandes vive en la media query de pantallas cortas',
    );
  });

  it('la barra de controles es más baja en pantallas cortas y el marco deja menos hueco', () => {
    // Botones de 40 px a 30 px en la barra de controles (clase propia .table-controls-row):
    // la fila deja ~4 px más de tablero a 800x360 (antes 34 px). En escritorio bajan a 36 px.
    // El marco pasa de +2 px a +0 px de hueco en los cuatro lados: el fieltro gana 4 px de alto
    // y 4 px de ancho en todas partes (el marco es solo decoración en el borde; la rejilla
    // queda a ras de su borde interior, sin montarse sobre él).
    assert.ok(layout.includes('table-controls-row'), 'la fila de controles lleva la clase .table-controls-row');
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(short.includes('.table-controls-row .h-10'), 'la regla de la barra de controles existe en pantallas cortas');
    assert.ok(short.includes('height: 30px'), 'en pantallas cortas los botones de la barra miden 30 px');
    const desktop = css.slice(css.indexOf('@media (min-width: 640px) and (min-height: 600px)'));
    assert.ok(desktop.includes('height: 36px'), 'en escritorio los botones de la barra miden 36 px');
    assert.ok(layout.includes("calc(var(--frame) + 0px + var(--sat))"), 'el marco deja 0 px arriba');
    assert.ok(layout.includes("calc(var(--frame) + 0px + var(--sab))"), 'el marco deja 0 px abajo');
    assert.ok(!layout.includes("calc(var(--frame) + 2px"), 'el marco ya no deja 2 px de hueco');
  });

  it('los botones de El Cagao de abajo a la derecha caben en la fila del 26%', () => {
    // "Bajar todos los pares" y "Mezclar mano" miden 44 px cada uno: los dos juntos sumaban
    // ~102 px y se salían ~8 px por arriba de su celda cuando aparecía el de bajar pares
    // (ya pasaba con la fila del 28%). En pantallas cortas bajan a 36 px con relleno de 4 px
    // y suman ~86 px; en escritorio siguen a 44 px, donde la fila es mucho más alta.
    const gameTable = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
    assert.ok(gameTable.includes('cagao-side-btn'), 'los botones de El Cagao llevan la clase .cagao-side-btn');
    const short = css.slice(css.indexOf('Mesas más grandes en pantallas cortas'));
    assert.ok(short.includes('.cagao-side-btn'), 'la regla de los botones de El Cagao vive en pantallas cortas');
    assert.ok(short.includes('min-height: 36px !important'), 'en pantallas cortas los botones de El Cagao miden 36 px');
    assert.ok(gameTable.includes('min-h-[44px]'), 'en escritorio y retrato los botones siguen a 44 px');
  });
});
