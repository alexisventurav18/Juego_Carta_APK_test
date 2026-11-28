import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Feedback de Alexis sobre el APK (puntos 1-5): rueda con scroll, leyenda de
// bots que encoge las tarjetas, modal de misiones/logros demasiado grande,
// racha que no deja ver la lista de logros y el icono de Ranking igual que
// el de Logros. Los componentes no se pueden renderizar en Node (su cadena
// de imports usa el alias `@/` y el runner tsx no lo resuelve), así que se
// comprueba el marcado y el CSS en el código fuente, como hacen
// shortLandscape.test.ts y waitingRoom.test.ts.
//
// Presupuestos por cálculo (verificados a mano, no en navegador: el Chromium
// local bloquea la navegación a localhost por Local Network Access):
// - Rueda a 360 px de alto, peor caso (premio + racha + logro): título ~37 +
//   rueda 34dvh = 122 + bloque de premio ~106 + huecos 12 + relleno 20 =
//   ~297 px < 94dvh = 338 px, sin scroll.
// - Modal a 819x378 (panel 354 px): la zona superior (título 32 + pestañas
//   32 + Reclamar todo 30 + huecos 12 + relleno 10) deja la lista a 116 px
//   del borde del panel y la lista tiene ~228 px de alto con scroll.
const wheel = readFileSync('src/components/DailyWheel.tsx', 'utf8');
const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');
const modal = readFileSync('src/components/MissionsAchievementsModal.tsx', 'utf8');

describe('punto 1: la rueda diaria cabe sin scroll en horizontal corto', () => {
  it('la rueda se ata a la altura disponible en pantallas cortas (34dvh)', () => {
    assert.ok(
      wheel.includes('[@media(max-height:500px)]:size-[min(62vw,34dvh,100%)]'),
      'DailyWheel: en horizontal corto la rueda mide min(62vw, 34dvh, 100%)',
    );
    assert.ok(
      wheel.includes('size-[min(62vw,44dvh,100%)]'),
      'DailyWheel: en pantallas altas la rueda sigue a 44dvh, sin superar el ancho del panel',
    );
  });

  it('el panel se compacta en horizontal corto (relleno, huecos, título, botones)', () => {
    assert.ok(wheel.includes('[@media(max-height:500px)]:p-2.5'), 'DailyWheel: panel con p-2.5 en corto');
    assert.ok(wheel.includes('[@media(max-height:500px)]:space-y-1.5'), 'DailyWheel: huecos space-y-1.5 en corto');
    assert.ok(wheel.includes('[@media(max-height:500px)]:text-sm'), 'DailyWheel: título más chico en corto');
    assert.ok(
      wheel.includes('[@media(max-height:500px)]:min-h-[36px]'),
      'DailyWheel: botones de 36 px en corto',
    );
  });

  it('los premios y las probabilidades no cambiaron (se verifican en dailyWheel.test.ts)', () => {
    assert.ok(wheel.includes('DAILY_WHEEL_PRIZES'), 'DailyWheel: sigue usando DAILY_WHEEL_PRIZES');
  });
});

describe('punto 2: la leyenda de bots no encoge las tarjetas de modo', () => {
  it('el texto de Casino es corto y cabe en una línea', () => {
    assert.ok(lobby.includes("'2 contra 2 por equipos'"), 'Lobby: Casino 2v2 dice "2 contra 2 por equipos"');
    assert.ok(lobby.includes("'Uno contra uno'"), 'Lobby: Casino 1v1 dice "Uno contra uno"');
    assert.ok(
      !lobby.includes('Dos equipos de dos: tú y un bot contra dos bots.'),
      'Lobby: ya no está la leyenda larga de Casino',
    );
  });

  it('la leyenda sigue truncándose a dos líneas como red de seguridad', () => {
    const at = lobby.indexOf('{botCaption(game, bots)}');
    assert.ok(at > 0, 'Lobby: la leyenda se sigue renderizando');
    const span = lobby.slice(lobby.lastIndexOf('<span', at), at);
    assert.ok(span.includes('line-clamp-2'), 'Lobby: la leyenda lleva line-clamp-2');
  });
});

describe('punto 3: la parte superior del modal combinado es compacta', () => {
  it('las pestañas y el botón Reclamar todo son más bajos', () => {
    assert.ok(modal.includes('min-h-[36px]'), 'modal: pestañas de 36 px');
    assert.ok(modal.includes('min-h-[34px]'), 'modal: Reclamar todo de 34 px');
    assert.ok(!modal.includes('min-h-[40px]'), 'modal: ya no hay botones de 40 px en la zona superior');
  });

  it('los resúmenes son cortos y no repiten el conteo largo', () => {
    assert.ok(
      modal.includes('Completa misiones jugando y reclama monedas para la Tienda.'),
      'modal: resumen de misiones corto',
    );
    assert.ok(
      modal.includes('Desbloquea logros jugando; cada uno se cobra una sola vez.'),
      'modal: resumen de logros corto',
    );
    assert.ok(
      !modal.includes('El progreso se guarda en este dispositivo.'),
      'modal: ya no está la frase larga del resumen de misiones',
    );
    assert.ok(
      !modal.includes('Gana partidas, sube de nivel y gira la rueda cada día'),
      'modal: ya no está el resumen largo de logros',
    );
    assert.ok(!modal.includes('monedas (${pending.count}'), 'modal: el botón no repite el conteo largo (el toast de confirmación tras reclamar sí lo conserva)');
    assert.ok(modal.includes('Reclamar todo'), 'modal: el botón Reclamar todo sigue existiendo');
  });

  it('los resúmenes se ocultan en horizontal corto para dar sitio a la lista', () => {
    assert.ok(
      modal.includes('[@media(max-height:500px)]:hidden'),
      'modal: los resúmenes llevan el gancho de ocultar en corto',
    );
  });
});

describe('punto 4: la tarjeta de racha es compacta y la lista de logros hace scroll', () => {
  // La tarjeta de racha es el único bloque naranja del modal.
  const streakAt = modal.indexOf('bg-orange-500/15');
  const streak = modal.slice(streakAt, modal.indexOf('</div>', streakAt));

  it('la tarjeta de racha es más chica y su descripción va en una sola línea', () => {
    assert.ok(streak.includes('h-5 w-5'), 'racha: icono de 20 px (antes 24 px)');
    assert.ok(!streak.includes('h-6 w-6'), 'racha: ya no hay icono de 24 px');
    assert.ok(streak.includes('line-clamp-1'), 'racha: descripción en una sola línea');
    assert.ok(streak.includes('Racha diaria'), 'racha: el título sigue diciendo "Racha diaria"');
    assert.ok(!streak.includes('Si giras la rueda mañana'), 'racha: ya no está la descripción larga');
  });

  it('el panel tiene altura fija, así la lista flex-1 tiene contra qué desplazarse', () => {
    assert.ok(
      modal.includes('wood-panel flex h-full max-h-full'),
      'modal: el panel lleva h-full (antes solo max-h-full, sin altura fija)',
    );
    assert.ok(
      modal.includes('min-h-0 flex-1 overflow-y-auto'),
      'modal: la lista sigue siendo min-h-0 flex-1 overflow-y-auto',
    );
    assert.ok(modal.includes('ACHIEVEMENTS.map'), 'modal: la lista dibuja los 12 logros');
  });
});

describe('punto 5: Ranking ya no usa el mismo icono que Logros', () => {
  it('Medal existe en la versión de lucide-react instalada', () => {
    assert.ok(
      existsSync('node_modules/lucide-react/dist/esm/icons/medal.js'),
      'lucide-react 0.446.0 trae el icono Medal',
    );
    assert.ok(lobby.includes('Medal'), 'Lobby: importa Medal de lucide-react');
  });

  it('el botón Ranking usa Medal y el botón Logros sigue con Trophy', () => {
    const rankingAt = lobby.indexOf('aria-label="Ranking de la temporada"');
    assert.ok(rankingAt > 0, 'Lobby: existe el botón Ranking');
    const rankingBtn = lobby.slice(lobby.lastIndexOf('<button', rankingAt), lobby.indexOf('</button>', rankingAt));
    assert.ok(rankingBtn.includes('<Medal'), 'Ranking: usa el icono Medal');
    assert.ok(!rankingBtn.includes('<Trophy'), 'Ranking: ya no usa Trophy');

    const logrosAt = lobby.indexOf("setProgressTab('achievements')");
    assert.ok(logrosAt > 0, 'Lobby: existe el botón Logros');
    const logrosBtn = lobby.slice(lobby.lastIndexOf('<button', logrosAt), lobby.indexOf('</button>', logrosAt));
    assert.ok(logrosBtn.includes('<Trophy'), 'Logros: sigue con el icono Trophy');
  });
});
