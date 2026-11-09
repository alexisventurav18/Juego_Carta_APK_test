import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { botStep, burakoBotMove, tresYDosBotMove } from '../src/games/bots';
import { americanDeck, americanDoubleDeck, shuffle } from '../src/games/cards';
import { applyBurakoMove, type BurakoState, createBurakoGame, isValidMeld } from '../src/games/burako';
import { applyTresYDosMove, createTresYDosGame, type TresYDosState } from '../src/games/tresYDos';
import type { Player } from '../src/games/shared';

const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `bot-${i}`, name: `B${i}` }));

describe('cartas', () => {
  it('la baraja americana tiene 52 cartas únicas y la doble 108', () => {
    assert.equal(new Set(americanDeck().map((c) => c.id)).size, 52);
    assert.equal(new Set(americanDoubleDeck().map((c) => c.id)).size, 108);
  });
  it('barajar conserva las cartas', () => {
    const shuffled = shuffle(americanDeck());
    assert.deepEqual(shuffled.map((c) => c.id).sort(), americanDeck().map((c) => c.id).sort());
  });
});

describe('Tres y Dos', () => {
  for (const n of [2, 3, 4]) {
    it(`${n} jugadores: el bot termina la partida con jugadas válidas`, () => {
      for (let g = 0; g < 8; g++) {
        let state: TresYDosState = createTresYDosGame(players(n));
        let guard = 0;
        while (state.phase !== 'gameOver') {
          assert.ok(++guard < 6000, 'partida sin fin');
          if (state.phase === 'roundEnd') {
            const res = applyTresYDosMove(state, (state.dealer + 1) % n, { type: 'nextRound' });
            assert.ok('state' in res, 'error' in res ? res.error : '');
            state = res.state;
            continue;
          }
          const res = tresYDosBotMove(state);
          assert.ok('state' in res, 'error' in res ? res.error : '');
          state = res.state;
        }
        assert.ok(state.winnerSeat !== null);
      }
    });
  }
  it('no deja botar antes de robar', () => {
    const state = createTresYDosGame(players(3));
    const seat = state.turn;
    assert.ok('error' in applyTresYDosMove(state, seat, { type: 'discard', cardId: state.hands[seat][0].id }));
  });
});

describe('Burako', () => {
  for (const n of [2, 4]) {
    it(`${n} jugadores: el bot termina la partida con jugadas válidas`, () => {
      for (let g = 0; g < 6; g++) {
        let state: BurakoState = createBurakoGame(players(n));
        let guard = 0;
        while (state.phase !== 'gameOver') {
          assert.ok(++guard < 20000, 'partida sin fin');
          if (state.phase === 'roundEnd') {
            const res = applyBurakoMove(state, 0, { type: 'nextRound' });
            assert.ok('state' in res);
            state = res.state;
            continue;
          }
          const res = burakoBotMove(state);
          assert.ok('state' in res, 'error' in res ? res.error : '');
          state = res.state;
        }
      }
    });
  }
  it('valida juegos: trío, escalera y comodines', () => {
    const c = (suit: 'corazones' | 'picas', rank: number, i = 0) => ({ id: `${suit}-${rank}-${i}`, suit, rank });
    assert.ok(isValidMeld([c('corazones', 7), c('picas', 7), c('corazones', 7, 1)]));
    assert.ok(isValidMeld([c('corazones', 4), c('corazones', 5), c('corazones', 6)]));
    assert.ok(!isValidMeld([c('corazones', 4), c('picas', 5), c('corazones', 6)]));
  });
});

describe('botStep', () => {
  it('no actúa si le toca a un humano', () => {
    const state = createTresYDosGame([{ id: 'humano', name: 'Yo' }, ...players(2)], 2);
    state.turn = 0;
    assert.equal(botStep(state), null);
  });
});
