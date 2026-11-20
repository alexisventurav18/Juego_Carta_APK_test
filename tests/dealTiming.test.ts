import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cagaoDealIntroMs, dealIntroMs } from '../src/games/dealTiming';

/**
 * Duración del reparto visible: la animación (useDealIntro) y el bloqueo de los bots leen los
 * mismos números (ver src/games/dealTiming.ts), así que estas cifras son también el tiempo que
 * nadie puede jugar al empezar cada ronda.
 */
describe('duración del reparto visible', () => {
  it('Casino: 2 jugadores ~4,4 s y 4 jugadores ~6,7 s', () => {
    assert.equal(dealIntroMs(2, 4, 4), 4440);
    assert.equal(dealIntroMs(4, 4, 4), 6680);
  });

  it('Tres y Dos: 2 jugadores ~4,2 s y 4 jugadores ~7,0 s', () => {
    assert.equal(dealIntroMs(2, 5, 1), 4160);
    assert.equal(dealIntroMs(4, 5, 1), 6960);
  });

  it('El Robaíto: igual que el Casino (4 en mano y 4 en mesa)', () => {
    assert.equal(dealIntroMs(2, 4, 4), 4440);
    assert.equal(dealIntroMs(4, 4, 4), 6680);
  });

  it('El Cagao: barajar + una oleada por asiento, sin 49 vuelos', () => {
    assert.equal(cagaoDealIntroMs(2), 1640);
    assert.equal(cagaoDealIntroMs(6), 2760);
  });

  it('ningún reparto pasa de ~7 s en el caso mayor', () => {
    assert.ok(dealIntroMs(4, 4, 4) <= 7000);
    assert.ok(dealIntroMs(4, 5, 1) <= 7000);
    assert.ok(cagaoDealIntroMs(6) <= 7000);
  });
});
