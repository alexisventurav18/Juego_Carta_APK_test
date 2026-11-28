import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// tsx compila los .tsx con el runtime clásico de JSX (`React.createElement`):
// se expone React como global para que los componentes rendericen en Node.
(globalThis as unknown as { React: typeof React }).React = React;
import ConfirmDialog from '../src/components/ConfirmDialog';
import { leaveConfirmContent } from '../src/lib/leaveConfirm';

function renderDialog(props: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
}): string {
  return renderToStaticMarkup(
    React.createElement(ConfirmDialog, {
      ...props,
      onConfirm: () => {},
      onCancel: () => {},
    }),
  );
}

describe('ConfirmDialog: contenido', () => {
  it('es un diálogo modal con Cancelar y el botón de confirmar', () => {
    const html = renderDialog({ title: '¿Salir de la sala?', message: 'Se liberará tu asiento.', confirmLabel: 'Salir' });
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /¿Salir de la sala\?/);
    assert.match(html, /Se liberará tu asiento\./);
    assert.match(html, />Cancelar</);
    assert.match(html, />Salir</);
  });

  it('el botón de cancelar tiene el foco por defecto', () => {
    const html = renderDialog({ title: 'T', message: 'M', confirmLabel: 'Salir' });
    assert.match(html, /autofocus/i);
  });

  it('ocupado desactiva los dos botones y cambia el texto de confirmar', () => {
    const html = renderDialog({ title: 'T', message: 'M', confirmLabel: 'Salir de la partida', busy: true, busyLabel: 'Saliendo…' });
    assert.match(html, /Saliendo…/);
    assert.doesNotMatch(html, />Salir de la partida</);
    const disabled = html.match(/disabled=""/g);
    assert.equal(disabled?.length, 3, 'X, Cancelar y confirmar desactivados');
  });
});

describe('leaveConfirmContent: textos por caso', () => {
  it('en espera: se liberará el asiento', () => {
    const c = leaveConfirmContent('waiting', false);
    assert.equal(c.title, '¿Salir de la sala?');
    assert.match(c.message, /Se liberará tu asiento/);
    assert.equal(c.confirmLabel, 'Salir');
  });

  it('online en curso: un bot toma tu lugar', () => {
    const c = leaveConfirmContent('online', false);
    assert.equal(c.title, '¿Salir de la partida?');
    assert.match(c.message, /Un bot tomará tu lugar/);
    assert.equal(c.confirmLabel, 'Salir de la partida');
  });

  it('online terminada: solo se vuelve al menú, sin bot', () => {
    const c = leaveConfirmContent('online', true);
    assert.equal(c.title, '¿Salir de la sala?');
    assert.match(c.message, /volverás al menú/);
    assert.doesNotMatch(c.message, /bot/i);
    assert.equal(c.confirmLabel, 'Salir');
  });

  it('offline en curso: el progreso se pierde', () => {
    const c = leaveConfirmContent('offline', false);
    assert.equal(c.title, '¿Salir de la partida?');
    assert.match(c.message, /Tu progreso en esta partida se perderá/);
    assert.equal(c.confirmLabel, 'Salir');
  });

  it('offline terminada: solo se vuelve al menú', () => {
    const c = leaveConfirmContent('offline', true);
    assert.match(c.message, /volverás al menú/);
    assert.doesNotMatch(c.message, /bot/i);
  });
});

// --- Cableado: tocar "Salir" abre el diálogo; solo confirmar sale. -------
// Sin DOM en el runner, el cableado se comprueba sobre el fuente, como en
// menuLimpio.test.ts: el diálogo es el único camino hacia la salida.

const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
const offline = readFileSync('src/components/OfflineBotGame.tsx', 'utf8');
const dialog = readFileSync('src/components/ConfirmDialog.tsx', 'utf8');

describe('Confirmar salir: sin window.confirm', () => {
  it('ningún componente usa window.confirm', () => {
    for (const [name, src] of [
      ['RoomView', roomView],
      ['OfflineBotGame', offline],
      ['ConfirmDialog', dialog],
    ] as const) {
      assert.doesNotMatch(src, /window\.confirm/, `${name} no debe usar window.confirm`);
    }
  });
});

describe('Confirmar salir: online (RoomView)', () => {
  it('la mesa pide confirmación una sola vez: su "Salir" solo abre el diálogo', () => {
    // El botón "Salir" de la mesa no sale: abre el diálogo.
    assert.match(roomView, /onLeave: \(\) => setConfirmLeave\(true\)/);
    // El diálogo de la mesa es único: un solo setConfirmLeave(true).
    assert.equal(roomView.match(/setConfirmLeave\(true\)/g)?.length, 1);
    // Solo el diálogo confirma la salida de la mesa.
    assert.match(roomView, /onConfirm=\{leaveGame\}/);
    assert.doesNotMatch(roomView, /onClick=\{leaveGame\}/);
  });

  it('el texto del diálogo de la mesa depende del caso (en curso o terminada)', () => {
    assert.match(roomView, /leaveConfirmContent\('online', isGameFinished\(state\)\)/);
  });

  it('la sala en espera pide confirmación: encabezado y "Cancelar búsqueda" abren su diálogo', () => {
    assert.match(roomView, /onClick=\{\(\) => setConfirmLeaveWaiting\(true\)\}/);
    assert.match(roomView, /onLeave=\{\(\) => setConfirmLeaveWaiting\(true\)\}/);
    // El diálogo de espera es único y su confirmación libera el asiento.
    assert.equal(roomView.match(/setConfirmLeaveWaiting\(true\)/g)?.length, 2);
    assert.match(roomView, /onConfirm=\{leaveWaitingRoom\}/);
    assert.match(roomView, /leaveConfirmContent\('waiting', false\)/);
  });

  it('el anuncio solo se dispara dentro de leaveGame (tras confirmar), nunca con el primer toque', () => {
    const adCalls = roomView.match(/maybeShowInterstitialOnMatchExit\(true\)/g);
    assert.equal(adCalls?.length, 2, 'solo en leaveGame (terminada) y en "Jugar otra partida"');
    assert.match(roomView, /if \(room\.state && isGameFinished\(room\.state\)\) maybeShowInterstitialOnMatchExit\(true\);/);
  });

  it('"Jugar otra partida" y la revancha no piden confirmación', () => {
    // Solo hay un setConfirmLeave(true) en todo RoomView (el botón Salir de
    // la mesa): ni "Jugar otra partida" ni la revancha abren el diálogo.
    assert.match(roomView, /maybeShowInterstitialOnMatchExit\(true\);\s*\n\s*startGame\(\);/);
  });
});

describe('Confirmar salir: offline (OfflineBotGame)', () => {
  it('el botón "Salir" de la mesa abre el diálogo en mitad de partida y desde resultados', () => {
    assert.match(offline, /onLeave: \(\) => setConfirmLeave\(true\)/);
    // Solo el diálogo confirma la salida.
    assert.match(offline, /onConfirm=\{leaveWithAd\}/);
    assert.doesNotMatch(offline, /onLeave: leaveWithAd/);
  });

  it('el texto del diálogo depende de si la partida terminó', () => {
    assert.match(offline, /leaveConfirmContent\('offline', isGameFinished\(state\)\)/);
  });

  it('el anuncio sigue gated por partida terminada, dentro de leaveWithAd', () => {
    assert.match(offline, /if \(isGameFinished\(state\)\) maybeShowInterstitialOnMatchExit\(true\);/);
  });

  it('"Jugar otra partida" no pide confirmación', () => {
    // Solo hay un setConfirmLeave(true) en todo OfflineBotGame (el botón
    // Salir de la mesa): "Jugar otra partida" no abre el diálogo.
    assert.equal(offline.match(/setConfirmLeave\(true\)/g)?.length, 1);
    assert.match(offline, /onClick=\{rematchWithAd\}/);
  });
});

describe('Confirmar salir: cancelar no hace nada', () => {
  it('cancelar solo cierra el diálogo: no llama a salir ni al anuncio', () => {
    // En los dos componentes, onCancel solo resetea el estado del diálogo.
    assert.match(roomView, /onCancel=\{\(\) => setConfirmLeave\(false\)\}/);
    assert.match(roomView, /onCancel=\{\(\) => setConfirmLeaveWaiting\(false\)\}/);
    assert.match(offline, /onCancel=\{\(\) => setConfirmLeave\(false\)\}/);
    // El diálogo genérico no llama a confirmar desde cancelar ni desde fuera.
    assert.doesNotMatch(dialog, /onConfirm\(\)/);
  });
});
