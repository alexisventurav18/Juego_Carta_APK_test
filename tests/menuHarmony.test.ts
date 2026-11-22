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

describe('armonía del menú: aviso de torneo discreto', () => {
  // Solo el botón del aviso: desde su condición hasta su cierre.
  const start = lobby.indexOf('tournamentBanner && (');
  const bannerBlock = lobby.slice(start, lobby.indexOf('</button>', start));

  it('el aviso es una píldora fina centrada, no una banda dorada de ancho completo', () => {
    assert.ok(bannerBlock.includes('mx-auto'), 'la píldora va centrada');
    assert.ok(bannerBlock.includes('rounded-full'), 'la píldora es redondeada');
    assert.ok(bannerBlock.includes('min-h-[28px]'), 'la píldora es fina (28 px)');
    assert.ok(bannerBlock.includes('btn-wood'), 'la píldora usa el estilo apagado de madera');
    assert.ok(!bannerBlock.includes('btn-gold'), 'la píldora ya no es dorada brillante');
    assert.ok(!bannerBlock.includes(' w-full '), 'la píldora ya no ocupa todo el ancho (max-w-full es solo el tope)');
  });

  it('el aviso sigue abriendo el modal del torneo y conserva su texto', () => {
    assert.ok(bannerBlock.includes('setTournamentOpen(true)'), 'tocar el aviso abre el modal');
    assert.ok(bannerBlock.includes('{tournamentBanner}'), 'el aviso muestra modo, cuenta atrás y puntos');
  });

  it('el aviso vive abajo del todo, debajo de los botones de acción', () => {
    // En el medio competía con las tarjetas y les robaba altura; abajo
    // aprovecha el espacio que sobra y las tarjetas crecen.
    const footerClose = lobby.indexOf('</footer>');
    assert.ok(footerClose > 0, 'el menú tiene pie de acciones');
    assert.ok(start > footerClose, 'la píldora del torneo va después del pie de acciones');
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
});
