import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGameState, type GameId, type GameState } from '../src/games';
import { applyGameMove } from '../src/games/engine';
import {
  botStep,
  botTickDelay,
  cagaoBotMove,
  robaitoBotMove,
  tresYDosBotMove,
} from '../src/games/bots';
import { applyCagaoMove, seatsWithPairs, type CagaoState } from '../src/games/cagao';
import { casinoBotMove } from '../src/games/casinoBot';
import { nextDealerSeat as casinoNextDealer, type CasinoState } from '../src/games/casino';
import { nextDealerSeat as tresYDosNextDealer, type TresYDosState } from '../src/games/tresYDos';
import { isBotPlayer, type MoveResult, type Player } from '../src/games/shared';

const MAX_STEPS = 20000;

function players(count: number): Player[] {
  const names = ['Bb', 'Daniela', 'Valentina', 'Sebastián'];
  return names.slice(0, count).map((name, i) => ({ id: i === 0 ? 'yo' : `bot-${i}`, name }));
}

/** Jugada del bot para quien tenga el turno (también sirve para simular al humano). */
function botPolicyMove(state: GameState): MoveResult<GameState> {
  switch (state.game) {
    case 'casino':
      return casinoBotMove(state);
    case 'tresydos':
      return tresYDosBotMove(state);
    case 'cagao':
      return cagaoBotMove(state);
    case 'robaito':
      return robaitoBotMove(state);
  }
}

/**
 * Partida completa con el mismo bucle que usan OfflineBotGame y el tick del
 * servidor: jugadas de bots, avance de ronda cuando el repartidor es bot y
 * "siguiente ronda" cuando es el humano. Falla si el motor se atasca, da
 * error o no llega al final.
 */
function playFullGame(game: GameId, count: number): { state: GameState; steps: number; rounds: number } {
  let state = createGameState(game, players(count));
  let steps = 0;
  let rounds = 0;
  while (state.phase !== 'gameOver' && steps < MAX_STEPS) {
    steps++;
    if (state.phase === 'pairing') {
      // El Cagao: primero todos bajan sus pares.
      const step = botStep(state);
      if (step) {
        assert.ok(!('error' in step.result), `bot en pairing: ${'error' in step.result ? step.result.error : ''}`);
        state = step.result.state;
        continue;
      }
      const seat = seatsWithPairs(state as CagaoState).find((s) => !isBotPlayer(state.players[s]));
      assert.notEqual(seat, undefined, 'pairing atascado: nadie con pares por bajar');
      const res = applyCagaoMove(state as CagaoState, seat as number, { type: 'pairAll' });
      assert.ok(!('error' in res), `humano en pairing: ${'error' in res ? res.error : ''}`);
      state = res.state;
      continue;
    }
    if (state.phase === 'playing') {
      const result = botPolicyMove(state);
      assert.ok(!('error' in result), `jugada en ${game}: ${'error' in result ? result.error : ''}`);
      state = result.state;
      continue;
    }
    if (state.phase === 'roundEnd') {
      rounds++;
      const dealer =
        game === 'tresydos'
          ? tresYDosNextDealer(state as TresYDosState)
          : casinoNextDealer(state as CasinoState);
      // El tick del bot solo debe programarse cuando el repartidor es bot.
      assert.equal(
        botTickDelay(state) !== null,
        isBotPlayer(state.players[dealer]),
        `tick de ronda en ${game}: repartidor ${state.players[dealer].name}`,
      );
      const step = botStep(state);
      if (step) {
        assert.ok(!('error' in step.result), `avance de ronda en ${game}: ${'error' in step.result ? step.result.error : ''}`);
        state = step.result.state;
        continue;
      }
      // Repartidor humano: pulsa "siguiente ronda".
      const res = applyGameMove(state, dealer, { type: 'nextRound' });
      assert.ok(!('error' in res), `siguiente ronda en ${game}: ${'error' in res ? res.error : ''}`);
      state = res.state;
      continue;
    }
    throw new Error(`fase inesperada en ${game}: ${state.phase}`);
  }
  assert.equal(state.phase, 'gameOver', `${game} no terminó en ${MAX_STEPS} pasos (fase ${state.phase})`);
  return { state, steps, rounds };
}

describe('partida completa: los 4 modos llegan al final', () => {
  it('Casino a 4 jugadores termina y cambia de ronda', () => {
    const { state, steps, rounds } = playFullGame('casino', 4);
    assert.ok(rounds >= 1, 'Casino debe jugar al menos una ronda');
    assert.ok(steps < MAX_STEPS);
    assert.equal((state as CasinoState).winnerTeam !== null, true);
  });

  it('Tres y Dos a 3 jugadores termina y cambia de ronda', () => {
    const { state, steps, rounds } = playFullGame('tresydos', 3);
    assert.ok(rounds >= 1, 'Tres y Dos debe jugar al menos una ronda');
    assert.ok(steps < MAX_STEPS);
    assert.equal((state as TresYDosState).winnerSeat !== null, true);
  });

  it('El Cagao a 4 jugadores termina', () => {
    const { state, steps } = playFullGame('cagao', 4);
    assert.ok(steps < MAX_STEPS);
    assert.equal((state as CagaoState).loserSeat !== null, true);
  });

  it('El Robaíto a 2 jugadores termina', () => {
    const { steps } = playFullGame('robaito', 2);
    assert.ok(steps < MAX_STEPS);
  });
});

describe('avance de ronda: el bot reparte solo cuando le toca', () => {
  it('Casino: en roundEnd con repartidor bot, botStep reparte la siguiente ronda', () => {
    // Se juega hasta el primer fin de ronda con repartidor bot.
    let state = createGameState('casino', players(4));
    let steps = 0;
    while (state.phase !== 'roundEnd' && steps < MAX_STEPS) {
      steps++;
      const result = botPolicyMove(state);
      assert.ok(!('error' in result));
      state = result.state;
    }
    assert.equal(state.phase, 'roundEnd');
    const dealer = casinoNextDealer(state as CasinoState);
    if (isBotPlayer(state.players[dealer])) {
      assert.notEqual(botTickDelay(state), null);
      const step = botStep(state);
      assert.ok(step, 'el bot repartidor debe avanzar la ronda');
      assert.ok(!('error' in step.result));
      assert.equal(step.result.state.phase, 'playing');
      assert.equal((step.result.state as CasinoState).roundNo, (state as CasinoState).roundNo + 1);
    }
  });
});
