import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGameState, createSoloPlayers } from '../src/games';
import { botStep, tresYDosBotMove } from '../src/games/bots';
import { applyGameMove } from '../src/games/engine';
import { botLevelFor, type Player } from '../src/games/shared';
import { nextDealerSeat as nextTresYDosDealer, type TresYDosState } from '../src/games/tresYDos';

/**
 * Pruebas del nivel en la mesa: los bots se sientan cerca del humano y su
 * nivel no cambia en toda la partida. Las importaciones son relativas porque
 * tsx no resuelve el alias `@/` que usa Vite.
 */

describe('nivel de los bots', () => {
  it('botLevelFor: cerca del humano, ±5, con el azar inyectado', () => {
    assert.equal(botLevelFor(20, () => 0), 15);
    assert.equal(botLevelFor(20, () => 0.5), 20);
    assert.equal(botLevelFor(20, () => 0.999), 25);
    assert.equal(botLevelFor(20, () => 0.09), 15);
    assert.equal(botLevelFor(20, () => 0.1), 16);
  });

  it('botLevelFor: no baja de 1 ni sube de 100', () => {
    assert.equal(botLevelFor(1, () => 0), 1);
    assert.equal(botLevelFor(3, () => 0), 1);
    assert.equal(botLevelFor(100, () => 0.999), 100);
    assert.equal(botLevelFor(98, () => 0.999), 100);
  });

  it('createSoloPlayers asigna a cada bot un nivel cercano al del humano', () => {
    const players = createSoloPlayers(
      'tresydos',
      { id: 'yo', name: 'Ana', level: 20 },
      3,
      () => botLevelFor(20),
    );
    assert.equal(players[0].level, 20);
    for (const bot of players.slice(1)) {
      assert.ok(bot.level !== undefined && bot.level >= 15 && bot.level <= 25, `bot nivel ${bot.level}`);
    }
  });

  it('sin función de nivel, los bots no llevan nivel', () => {
    const players = createSoloPlayers('tresydos', { id: 'yo', name: 'Ana', level: 20 }, 3);
    assert.equal(players[0].level, 20);
    for (const bot of players.slice(1)) assert.equal(bot.level, undefined);
  });

  it('el nivel no cambia durante una partida completa de Tres y Dos', () => {
    const players: Player[] = createSoloPlayers(
      'tresydos',
      { id: 'yo', name: 'Ana', level: 20 },
      3,
      () => botLevelFor(20, () => 0.5),
    );
    assert.deepEqual(
      players.map((p) => p.level),
      [20, 20, 20],
    );
    let state = createGameState('tresydos', players);
    let steps = 0;
    while (state.phase !== 'gameOver' && steps < 20000) {
      steps += 1;
      if (state.phase === 'playing') {
        const result = tresYDosBotMove(state);
        assert.ok(!('error' in result), `jugada: ${'error' in result ? result.error : ''}`);
        state = result.state;
        continue;
      }
      if (state.phase === 'roundEnd') {
        const step = botStep(state);
        if (step) {
          assert.ok(!('error' in step.result));
          state = step.result.state;
          continue;
        }
        const dealer = nextTresYDosDealer(state as TresYDosState);
        const res = applyGameMove(state, dealer, { type: 'nextRound' });
        assert.ok(!('error' in res), `siguiente ronda: ${'error' in res ? res.error : ''}`);
        state = res.state;
        continue;
      }
      throw new Error(`fase inesperada: ${state.phase}`);
    }
    assert.equal(state.phase, 'gameOver');
    assert.deepEqual(
      state.players.map((p) => p.level),
      [20, 20, 20],
      'los niveles siguen iguales al terminar la partida',
    );
  });
});
