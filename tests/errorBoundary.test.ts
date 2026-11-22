import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx compila los .tsx con el runtime clásico de JSX (`React.createElement`):
// se expone React como global para que los componentes rendericen en Node.
(globalThis as unknown as { React: typeof React }).React = React;
import ErrorBoundary, { ErrorFallback } from '../src/components/ErrorBoundary';

/**
 * El seguro contra pantallas en blanco (el bug de Amigos: un throw en el
 * render dejaba toda la app en blanco porque no había boundary).
 *
 * Limitación conocida del runner: en React 18.3 el render de servidor
 * (`renderToStaticMarkup` y `renderToPipeableStream`) RE-LANZA el error del
 * hijo en vez de respetar el boundary (verificado con un experimento: ambos
 * re-lanzan "boom de prueba"). Por eso el camino completo "hijo que rompe →
 * fallback" no se puede montar en Node (no hay DOM ni jsdom en el proyecto):
 * se prueba el mecanismo por piezas — el estático que activa el fallback,
 * el registro del error, el fallback renderizado y los handlers de reset —
 * y el montaje en App/Lobby por aserciones sobre el código fuente.
 */
describe('ErrorBoundary: el mecanismo', () => {
  it('getDerivedStateFromError activa el estado de error', () => {
    assert.deepEqual(ErrorBoundary.getDerivedStateFromError(new Error('boom')), { hasError: true });
  });

  it('componentDidCatch registra el error en la consola', () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      const boundary = new ErrorBoundary({ children: null, onReset: () => {} });
      const error = new Error('boom de prueba');
      boundary.componentDidCatch(error, { componentStack: '\n    en Boom' });
      assert.equal(logged.length, 1, 'debe registrar el error una vez');
      assert.equal(logged[0][0], 'Error en la pantalla del juego');
      assert.equal(logged[0][1], error);
    } finally {
      console.error = original;
    }
  });

  it('el fallback de pantalla completa muestra el mensaje y los dos botones', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorFallback, { onRetry: () => {}, onReset: () => {} }),
    );
    assert.ok(html.includes('Algo salió mal'), 'falta el título del error');
    assert.ok(html.includes('Reintentar'), 'falta el botón Reintentar');
    assert.ok(html.includes('Volver al menú'), 'falta el botón Volver al menú');
  });

  it('sin showRetry el fallback solo ofrece volver al menú', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorFallback, { onRetry: () => {}, onReset: () => {}, showRetry: false }),
    );
    assert.ok(html.includes('Volver al menú'), 'falta el botón Volver al menú');
    assert.ok(!html.includes('Reintentar'), 'no debe ofrecer Reintentar');
  });

  it('el fallback compacto es un aviso pequeño, no una pantalla', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorFallback, { onRetry: () => {}, onReset: () => {}, compact: true }),
    );
    assert.ok(html.includes('Esa ventana tuvo un problema y se cerró.'), 'falta el aviso corto');
    assert.ok(html.includes('Entendido'), 'falta el botón Entendido');
    assert.ok(!html.includes('Algo salió mal'), 'no debe ser la pantalla completa');
    assert.ok(!html.includes('Reintentar'), 'no debe ofrecer Reintentar');
    assert.ok(!html.includes('Volver al menú'), 'no debe ofrecer Volver al menú');
  });

  it('handleReset limpia el estado de error y llama a onReset', () => {
    let resetCalls = 0;
    const boundary = new ErrorBoundary({
      children: null,
      onReset: () => {
        resetCalls += 1;
      },
    });
    const patches: unknown[] = [];
    (boundary as unknown as { setState: (patch: unknown) => void }).setState = (patch) => {
      patches.push(patch);
    };
    boundary.handleReset();
    assert.deepEqual(patches, [{ hasError: false }], 'debe limpiar el estado de error');
    assert.equal(resetCalls, 1, 'debe llamar a onReset para volver al menú');
  });

  it('handleRetry limpia el estado de error sin llamar a onReset', () => {
    let resetCalls = 0;
    const boundary = new ErrorBoundary({
      children: null,
      onReset: () => {
        resetCalls += 1;
      },
    });
    const patches: unknown[] = [];
    (boundary as unknown as { setState: (patch: unknown) => void }).setState = (patch) => {
      patches.push(patch);
    };
    boundary.handleRetry();
    assert.deepEqual(patches, [{ hasError: false }], 'debe limpiar el estado de error');
    assert.equal(resetCalls, 0, 'no debe volver al menú al reintentar');
  });
});

describe('ErrorBoundary: montaje en la app', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const lobby = readFileSync('src/components/Lobby.tsx', 'utf8');

  it('App usa el boundary compartido y ya no tiene la clase local', () => {
    assert.ok(
      app.includes("import ErrorBoundary from '@/components/ErrorBoundary'"),
      'App: debe importar el boundary compartido',
    );
    assert.ok(!app.includes('ScreenErrorBoundary'), 'App: la clase local ya no debe existir');
    assert.ok(!app.includes('class ScreenErrorBoundary'), 'App: no debe quedar la clase local');
  });

  it('App monta el boundary en raíz, sala y partida offline', () => {
    const mounts = [...app.matchAll(/<ErrorBoundary/g)].length;
    assert.equal(mounts, 3, 'App: debe haber 3 montajes (raíz, sala, offline)');
    assert.ok(app.includes('<ErrorBoundary onReset={resetToMenu}>'), 'App: la raíz debe usar resetToMenu');
    assert.ok(app.includes('<RoomView key={roomId}'), 'App: la sala sigue montada dentro de su boundary');
    assert.ok(app.includes('<OfflineBotGame'), 'App: la partida offline sigue montada dentro de su boundary');
  });

  it('volver al menú desde la raíz limpia sala, partida e invitación', () => {
    const at = app.indexOf('const resetToMenu');
    assert.ok(at >= 0, 'App: debe existir resetToMenu');
    const body = app.slice(at, app.indexOf('};', at));
    for (const call of ['storeRoomId(null)', 'setRoomId(null)', 'setOfflineGame(null)', 'setInviteCode(undefined)']) {
      assert.ok(body.includes(call), `App: resetToMenu debe hacer ${call}`);
    }
  });

  it('el reset de la sala libera el asiento en el servidor antes de salir', () => {
    assert.ok(app.includes('leaveRoomBestEffort(roomId)'), 'App: el reset de sala debe avisar al servidor');
  });

  it('el Lobby envuelve sus modales en un boundary compacto', () => {
    assert.ok(
      lobby.includes("import ErrorBoundary from './ErrorBoundary'"),
      'Lobby: debe importar el boundary',
    );
    assert.ok(
      lobby.includes('<ErrorBoundary compact onReset={closeAllModals}>'),
      'Lobby: los modales deben ir dentro de un boundary compacto',
    );
    const at = lobby.indexOf('const closeAllModals');
    assert.ok(at >= 0, 'Lobby: debe existir closeAllModals');
    const body = lobby.slice(at, lobby.indexOf('};', at));
    for (const setter of [
      'setStoreOpen(false)',
      'setMissionsOpen(false)',
      'setRankingOpen(false)',
      'setFriendsOpen(false)',
      'setTournamentOpen(false)',
      'setDailyWheelOpen(false)',
      'setProfileOpen(false)',
      'setEditorOpen(false)',
      'setTutorialOpen(false)',
    ]) {
      assert.ok(body.includes(setter), `Lobby: closeAllModals debe hacer ${setter}`);
    }
  });
});
