import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Armonía del menú (Alexis, 2026-11-22): el aviso de torneo era una banda
// dorada que metía ruido visual, las imágenes de los modos se veían
// recortadas a una franja (23% de su altura a 819x378) y los nombres no
// estaban alineados entre tarjetas. Como en lobbyWeb.test.ts, se comprueba
// el marcado en el código fuente (el runner tsx no resuelve el alias `@/`).
const gameCards = readFileSync('src/components/GameCards.tsx', 'utf8');
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

describe('armonía del menú: arte completo y tarjetas alineadas', () => {
  it('la descripción reserva siempre 2 líneas, aunque quepa en 1', () => {
    // "Tres y Dos" cabe en 1 línea a 819 px de ancho y sin reserva su
    // tarjeta quedaba con el arte 17 px más alto y el nombre ~20 px más
    // bajo que las demás.
    assert.ok(gameCards.includes('line-clamp-2'), 'la descripción se limita a 2 líneas');
    assert.ok(gameCards.includes('min-h-[2.75em]'), 'la descripción reserva la altura de 2 líneas');
  });

  it('la tarjeta activa no se levanta ni se escala (rompía las baselines)', () => {
    assert.ok(!gameCards.includes('scale-[1.02]'), 'sin escala en la tarjeta activa');
    assert.ok(!gameCards.includes("'-translate-y-1"), 'sin elevación en la tarjeta activa');
    assert.ok(gameCards.includes('ring-2 ring-amber-300'), 'la tarjeta activa se sigue marcando con el anillo');
  });

  it('el arte se ve entero fuera del escritorio (contain), cover solo en escritorio', () => {
    assert.ok(gameCards.includes('object-contain'), 'el arte se contiene entero por defecto');
    assert.ok(
      gameCards.includes('[@media(min-width:640px)_and_(min-height:600px)]:object-cover'),
      'en escritorio el arte vuelve a cubrir el panel',
    );
  });
});

describe('armonía del menú: aviso de torneo como marquesina arriba', () => {
  // La píldora de abajo se eliminó (Alexis, 2026-11-27): el aviso vive
  // ahora entre el encabezado y las tarjetas, se desplaza como marquesina
  // y se oculta solo a los ~10 s, devolviendo su espacio a las tarjetas.
  const ticker = readFileSync('src/components/TournamentTicker.tsx', 'utf8');

  it('ya no hay píldora del torneo abajo del menú', () => {
    assert.ok(!lobby.includes('min-h-[28px]'), 'la píldora fina ya no existe');
    assert.ok(!lobby.includes('Vive abajo del todo'), 'el comentario de la píldora desapareció');
  });

  it('el aviso vive entre el encabezado y las tarjetas', () => {
    const headerClose = lobby.indexOf('</header>');
    const tickerUse = lobby.indexOf('<TournamentTicker');
    const cards = lobby.indexOf('<GameCards');
    assert.ok(tickerUse > headerClose, 'el aviso va después del encabezado');
    assert.ok(tickerUse < cards, 'el aviso va antes de las tarjetas');
  });

  it('la marquesina se desplaza y se oculta sola, liberando el espacio', () => {
    assert.ok(css.includes('@keyframes ticker-scroll'), 'hay animación de marquesina');
    assert.ok(ticker.includes('ticker-track'), 'la pista usa la animación');
    assert.ok(ticker.includes('setVisible(false)'), 'el aviso se oculta solo');
    assert.ok(ticker.includes('setGone(true)'), 'al ocultarse deja de ocupar espacio');
  });

  it('tocar el aviso abre el modal del torneo y conserva su texto', () => {
    assert.ok(
      lobby.includes('<TournamentTicker text={tournamentBanner} onOpen={() => setTournamentOpen(true)}'),
      'el aviso abre el modal',
    );
    assert.ok(ticker.includes('{text}'), 'el aviso muestra modo, cuenta atrás y puntos');
  });

  it('sin movimiento, el texto se queda quieto', () => {
    assert.ok(css.includes('.ticker-track'), 'la pista tiene regla propia');
    assert.ok(
      css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.ticker-track {\n    animation: none;'),
      'la marquesina se apaga con movimiento reducido',
    );
  });
});

describe('armonía del menú: la cabecera cabe en una fila en horizontal corto', () => {
  it('la caja del perfil se acota para dejar sitio a los botones', () => {
    assert.ok(
      lobby.includes('[@media(max-height:500px)]:max-w-[150px]'),
      'la caja del perfil se estrecha en horizontal corto',
    );
  });

  it('el título se acorta a "Cartas" en horizontal corto', () => {
    assert.ok(lobby.includes('[@media(max-height:500px)]:hidden'), 'el título largo se oculta en horizontal corto');
    assert.ok(lobby.includes('[@media(max-height:500px)]:inline'), 'el título corto aparece en horizontal corto');
    assert.ok(lobby.includes('>Cartas</span>'), 'el título corto es "Cartas"');
  });

  it('los botones de la cabecera se aprietan en horizontal corto (CSS)', () => {
    assert.ok(css.includes('@media (max-height: 500px)'), 'hay reglas para horizontal corto');
    assert.ok(css.includes('.lobby-stage header > div:last-child button'), 'las reglas tocan los botones de la cabecera');
    assert.ok(css.includes('height: 30px'), 'los botones bajan a 30 px de alto');
  });

  it('la columna aprieta un poco sus huecos en horizontal corto', () => {
    assert.ok(lobby.includes('[@media(max-height:500px)]:gap-[1.1dvh]'), 'el hueco de la columna se reduce');
  });

  it('el botón Logros se adelgaza en horizontal corto para que quepa la fila', () => {
    // El "4/12" y los días de racha se ocultan: el botón queda en trofeo +
    // llama y el encabezado cabe en una sola fila en el peor caso. Ambos
    // datos se siguen viendo dentro del modal, en la pestaña Logros.
    assert.ok(
      lobby.includes('text-amber-200 [@media(max-height:500px)]:hidden'),
      'el "4/12" se oculta en horizontal corto',
    );
    assert.ok(
      lobby.includes('className="[@media(max-height:500px)]:hidden">{streakDays}'),
      'los días de racha se ocultan en horizontal corto',
    );
    assert.ok(
      lobby.includes('[@media(max-height:500px)]:gap-1'),
      'el cluster aprieta sus huecos en horizontal corto',
    );
  });
});
