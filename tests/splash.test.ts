import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPLASH_DURATION_MS, SPLASH_STEPS, splashStep } from '../src/lib/splash';
import { matchmakingStatus } from '../src/components/MatchmakingAnimation';

describe('splashStep', () => {
  it('recorre los cuatro mensajes en orden según el progreso', () => {
    assert.equal(splashStep(0), SPLASH_STEPS[0]);
    assert.equal(splashStep(29), SPLASH_STEPS[0]);
    assert.equal(splashStep(30), SPLASH_STEPS[1]);
    assert.equal(splashStep(59), SPLASH_STEPS[1]);
    assert.equal(splashStep(60), SPLASH_STEPS[2]);
    assert.equal(splashStep(84), SPLASH_STEPS[2]);
    assert.equal(splashStep(85), SPLASH_STEPS[3]);
    assert.equal(splashStep(100), SPLASH_STEPS[3]);
  });

  it('limita el progreso fuera de rango', () => {
    assert.equal(splashStep(-10), SPLASH_STEPS[0]);
    assert.equal(splashStep(150), SPLASH_STEPS[3]);
  });

  it('la duración mínima deja ver la animación sin hacer esperar', () => {
    assert.ok(SPLASH_DURATION_MS >= 1500 && SPLASH_DURATION_MS <= 3500);
  });
});

describe('matchmakingStatus', () => {
  it('rota el mensaje cada 5 segundos y vuelve al primero', () => {
    const first = matchmakingStatus(0);
    assert.equal(matchmakingStatus(4), first);
    assert.notEqual(matchmakingStatus(5), first);
    assert.notEqual(matchmakingStatus(10), matchmakingStatus(5));
    assert.equal(matchmakingStatus(20), first);
  });

  it('no acepta tiempos negativos', () => {
    assert.equal(matchmakingStatus(-3), matchmakingStatus(0));
  });
});
