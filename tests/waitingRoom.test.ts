import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La sala de espera no se puede renderizar en Node: su cadena de imports usa
// el alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado y el
// CSS en el código fuente, como hace seatPlaque.test.ts.
const waitingRoom = readFileSync('src/components/WaitingRoom.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');

// Solo la media query de horizontal corto (la primera, la de la sala de espera).
const shortLandscape = css.slice(
  css.indexOf('@media (orientation: landscape) and (max-height: 500px)'),
  css.indexOf('@media (orientation: landscape) and (max-height: 500px)', css.indexOf('@media (orientation: landscape) and (max-height: 500px)') + 1),
);
const waitingGridCss = shortLandscape.slice(
  shortLandscape.indexOf('.room-waiting-grid {'),
  shortLandscape.indexOf('.room-waiting-player-panel {'),
);
const waitingContentCss = shortLandscape.slice(
  shortLandscape.indexOf('.room-waiting-content {'),
  shortLandscape.indexOf('.room-waiting-mode-banner {'),
);

describe('banda del modo en la sala de espera', () => {
  it('el nombre es pequeño: text-xs, sm:text-sm como mucho, sin text-base', () => {
    const nameClass = waitingRoom.match(/room-waiting-mode-name ([^"]*)"/)?.[1] ?? '';
    assert.ok(nameClass.length > 0, 'el nombre lleva la clase room-waiting-mode-name');
    assert.ok(nameClass.includes('text-xs'), 'el nombre es text-xs por defecto');
    assert.ok(!nameClass.includes('text-base'), 'el nombre ya no crece a text-base');
    assert.ok(!nameClass.includes('text-sm font-extrabold'), 'el nombre ya no es text-sm sin tope en horizontal');
  });

  it('la banda es una línea fina: padding vertical reducido', () => {
    const bannerClass = waitingRoom.match(/room-waiting-mode-banner ([^"]*)"/)?.[1] ?? '';
    assert.ok(bannerClass.length > 0, 'la banda existe');
    assert.ok(bannerClass.includes('py-1'), 'la banda usa py-1, no py-2');
    assert.ok(!bannerClass.includes('py-2'), 'la banda ya no tiene py-2');
  });

  it('la descripción tiene su propia clase para poder ocultarla en horizontal corto', () => {
    assert.ok(waitingRoom.includes('room-waiting-mode-tagline'), 'la descripción lleva la clase room-waiting-mode-tagline');
    assert.ok(shortLandscape.includes('.room-waiting-mode-tagline'), 'la media query apunta a la clase, no a p:last-child');
    assert.ok(shortLandscape.includes('.room-waiting-mode-tagline {\n    display: none;'), 'la descripción se oculta en horizontal corto');
  });

  it('el grid no estira los paneles: filas auto auto y sin flex:1', () => {
    assert.ok(waitingGridCss.length > 0, 'se encontró la regla del grid en la media query');
    assert.ok(
      waitingGridCss.includes('grid-template-rows: auto auto;'),
      'las dos filas son auto: los paneles abrazan su contenido en vez de estirarse',
    );
    assert.ok(waitingGridCss.includes('flex: none;'), 'el grid ya no se estira con flex:1');
    assert.ok(!waitingGridCss.includes('minmax(0, 1fr)'), 'la fila de los paneles ya no se queda con el resto');
  });

  it('la sala se centra con margen auto y el contenido no fuerza el 100% de alto', () => {
    // Reglas base (fuera de la media query): la pantalla es columna flex y
    // el contenido se centra con margen auto — si es más alto que la
    // pantalla, el margen se anula y el scroll empieza arriba sin recortar.
    assert.ok(css.includes('.room-waiting-screen {\n  display: flex;\n  flex-direction: column;'), 'la pantalla es columna flex');
    assert.ok(
      css.includes('.room-waiting-content {\n  margin-top: auto;\n  margin-bottom: auto;'),
      'el contenido se centra con margen auto',
    );
    assert.ok(waitingContentCss.length > 0, 'se encontró la regla del contenido en la media query');
    assert.ok(waitingContentCss.includes('min-height: 0;'), 'en horizontal corto el contenido no fuerza min-height:100%');
    assert.ok(!waitingContentCss.includes('min-height: 100%;'), 'el contenido ya no llena la pantalla a la fuerza');
  });

  it('el color del modo sigue siendo la identidad de la banda (gradiente + brillo del acento)', () => {
    assert.ok(waitingRoom.includes('env.accent'), 'la banda sigue teñida con el acento del modo');
    assert.ok(waitingRoom.includes('linear-gradient(90deg, ${env.accent}66'), 'el gradiente del acento sigue ahí');
    assert.ok(waitingRoom.includes('boxShadow: `0 0 24px ${env.accent}55`'), 'el brillo del acento sigue ahí');
  });
});

describe('otros nombres de juego en pantallas de sala', () => {
  it('el nombre del encabezado de la sala ya es pequeño (text-xs) y se esconde en horizontal corto', () => {
    const headerClass = roomView.match(/room-waiting-header-game ([^"]*)"/)?.[1] ?? '';
    assert.ok(headerClass.includes('text-xs'), 'el nombre del encabezado es text-xs');
    assert.ok(shortLandscape.includes('.room-waiting-header-game'), 'la media query lo trata');
    assert.ok(shortLandscape.includes('.room-waiting-header-game {\n    display: none;'), 'se esconde en horizontal corto');
  });

  it('el resultado de ronda y el sorteo del repartidor no muestran el nombre del juego', () => {
    const roundResult = readFileSync('src/components/RoundResultPanel.tsx', 'utf8');
    const dealerReveal = readFileSync('src/components/DealerReveal.tsx', 'utf8');
    assert.ok(!roundResult.includes('info.name') && !roundResult.includes('GAMES['), 'el resultado de ronda no pinta el nombre del juego');
    assert.ok(!dealerReveal.includes('info.name') && !dealerReveal.includes('GAMES['), 'el sorteo no pinta el nombre del juego');
  });
});
