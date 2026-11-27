import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { tickerLoopSeconds } from '../src/lib/tournament';

// Aviso del torneo como marquesina (Alexis, 2026-11-27): la píldora de
// abajo se elimina y el aviso sube entre el encabezado y las tarjetas,
// con el texto desplazándose, y se oculta solo a los ~10 s.
const ticker = readFileSync('src/components/TournamentTicker.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

describe('marquesina del torneo: duración de una vuelta', () => {
  it('un texto corto no va demasiado deprisa (mínimo 8 s)', () => {
    assert.equal(tickerLoopSeconds('Torneo'), 8);
    assert.equal(tickerLoopSeconds(''), 8);
  });

  it('el texto típico del torneo se lee entero antes de ocultarse', () => {
    // "Torneo de Casino · termina en 2d 0h · tus puntos: 240" (51 caracteres).
    const seconds = tickerLoopSeconds('Torneo de Casino · termina en 2d 0h · tus puntos: 240');
    assert.ok(seconds >= 8 && seconds <= 12, `una vuelta dura ${seconds} s`);
    assert.ok(seconds + 1.5 <= 13.5, 'el aviso se oculta poco después de una vuelta');
  });

  it('un texto largo no va demasiado despacio (máximo 12 s)', () => {
    assert.equal(tickerLoopSeconds('T'.repeat(200)), 12);
  });
});

describe('marquesina del torneo: comportamiento', () => {
  it('el texto va duplicado para que el bucle no tenga salto', () => {
    assert.ok(ticker.includes('[0, 1].map'), 'el texto se repite dos veces en la pista');
    assert.ok(css.includes('@keyframes ticker-scroll'), 'hay animación de marquesina');
    assert.ok(css.includes('translateX(-50%)'), 'la animación recorre exactamente media pista');
  });

  it('se muestra una vez por entrada al menú y no reaparece sola', () => {
    assert.ok(ticker.includes('useState(true)'), 'el aviso empieza visible al montar');
    assert.ok(ticker.includes('setGone(true)'), 'al ocultarse se desmonta y no vuelve');
  });

  it('al tocarla se abre el torneo', () => {
    assert.ok(ticker.includes('onClick={onOpen}'), 'tocar el aviso llama a onOpen');
    assert.ok(ticker.includes('Aviso del torneo:'), 'el botón anuncia qué abre');
  });
});
