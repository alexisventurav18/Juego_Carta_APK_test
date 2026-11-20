import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { botStep, botTickDelay } from '../src/games/bots';
import { applyCagaoMove, createCagaoGame, seatsWithPairs, type CagaoState } from '../src/games/cagao';
import { createCasinoGame } from '../src/games/casino';
import { createRobaitoGame } from '../src/games/robaito';
import type { Player } from '../src/games/shared';
import { createTresYDosGame } from '../src/games/tresYDos';

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: i === 0 ? 'humano' : `bot-${i}`, name: `J${i}` }));

/** Casino con 4 jugadores, repartidor humano: le toca al bot del asiento 1. */
function casinoBotTurn() {
  return createCasinoGame(players(4), 0);
}

/** Tres y Dos con 3 jugadores, repartidor humano: le toca al bot del asiento 1. */
function tresYDosBotTurn() {
  return createTresYDosGame(players(3), 0);
}

/** Robaíto con el turno puesto en un bot (el repartidor inicial es aleatorio). */
function robaitoBotTurn() {
  const state = createRobaitoGame(players(3));
  state.turn = 1;
  return state;
}

/** Baja todos los pares iniciales hasta que empieza el robo por turnos. */
function settleCagaoPairing(state: CagaoState): CagaoState {
  let s = state;
  let guard = 0;
  while (s.phase === 'pairing' && guard++ < 20) {
    const seat = seatsWithPairs(s)[0];
    if (seat === undefined) break;
    const res = applyCagaoMove(s, seat, { type: 'pairAll' });
    assert.ok('state' in res, 'error' in res ? res.error : '');
    s = res.state;
  }
  return s;
}

/** El Cagao ya en fase de robo, con el turno en un bot que todavía tiene cartas. */
function cagaoBotTurn(): CagaoState {
  const state = settleCagaoPairing(createCagaoGame(players(4), 0));
  assert.equal(state.phase, 'playing');
  const bot = state.hands.findIndex((hand, seat) => seat !== 0 && hand.length > 0);
  assert.ok(bot > 0, 'ningún bot tiene cartas');
  state.turn = bot;
  return state;
}

/** El Cagao en la fase inicial, con al menos un bot con pares por bajar. */
function cagaoPairingWithBot() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const state = createCagaoGame(players(4), 0);
    if (state.phase === 'pairing' && seatsWithPairs(state).some((seat) => seat !== 0)) return state;
  }
  throw new Error('no salió un reparto con pares para un bot');
}

describe('retardo humano de los bots', () => {
  it('Casino, Tres y Dos y Robaíto: entre 1400 y 2600 ms, distinto en cada jugada', () => {
    const states = [casinoBotTurn(), tresYDosBotTurn(), robaitoBotTurn()];
    for (const state of states) {
      const delays = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const delay = botTickDelay(state);
        assert.ok(delay !== null, 'al bot le toca y debe haber espera');
        assert.ok(delay >= 1400 && delay <= 2600, `retardo ${delay} ms fuera de rango`);
        delays.add(delay);
      }
      assert.ok(delays.size > 50, 'el retardo debe variar entre jugadas');
    }
  });

  it('El Cagao: entre 1700 y 2900 ms, para que se vea qué carta roba', () => {
    const state = cagaoBotTurn();
    const delays = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const delay = botTickDelay(state);
      assert.ok(delay !== null, 'al bot le toca y debe haber espera');
      assert.ok(delay >= 1700 && delay <= 2900, `retardo ${delay} ms fuera de rango`);
      delays.add(delay);
    }
    assert.ok(delays.size > 50, 'el retardo debe variar entre jugadas');
  });

  it('botStep devuelve el mismo rango de espera que botTickDelay', () => {
    const state = casinoBotTurn();
    for (let i = 0; i < 50; i++) {
      const step = botStep(state);
      assert.ok(step, 'el bot debe poder jugar');
      assert.ok(step.delayMs >= 1400 && step.delayMs <= 2600, `retardo ${step.delayMs} ms fuera de rango`);
    }
  });
});

describe('bloqueo durante el reparto', () => {
  it('ningún bot mueve mientras se reparte, en los 4 modos', () => {
    for (const state of [casinoBotTurn(), tresYDosBotTurn(), robaitoBotTurn(), cagaoBotTurn()]) {
      assert.ok(botTickDelay(state, false) !== null, 'sin reparto el bot sí mueve');
      assert.equal(botTickDelay(state, true), null, 'con reparto el bot no mueve');
    }
  });

  it('tampoco bajan pares en la fase inicial de El Cagao mientras se reparte', () => {
    const state = cagaoPairingWithBot();
    assert.ok(botTickDelay(state, false) !== null, 'sin reparto el bot baja sus pares');
    assert.equal(botTickDelay(state, true), null, 'con reparto el bot no baja pares');
  });
});
