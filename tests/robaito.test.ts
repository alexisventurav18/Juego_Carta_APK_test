import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { botStep, botTickDelay } from '../src/games/bots';
import type { Card } from '../src/games/cards';
import { applyGameMove } from '../src/games/engine';
import { canStartGame, createGameState, createSoloPlayers, GAMES } from '../src/games';
import {
  applyRobaitoMove,
  captureOptions,
  createRobaitoGame,
  leadingSeats,
  type RobaitoState,
  topOf,
} from '../src/games/robaito';
import { chooseRobaitoCard } from '../src/games/robaitoBot';
import type { Player } from '../src/games/shared';
import { projectState } from '../src/games/view';

type Suit = 'corazones' | 'diamantes' | 'treboles' | 'picas';
const c = (rank: number, suit: Suit): Card => ({ id: `${suit}-${rank}`, suit, rank });

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: i === 0 ? 'humano' : `bot-${i}`, name: `J${i}` }));

function makeState(opts: Partial<RobaitoState> & { hands: Card[][] }): RobaitoState {
  const seats = opts.hands.length;
  return {
    game: 'robaito',
    phase: 'playing',
    players: players(seats),
    deck: [c(2, 'picas'), c(3, 'picas'), c(4, 'picas')],
    table: [],
    piles: opts.hands.map(() => []),
    turn: 0,
    dealer: seats - 1,
    dealNo: 1,
    roundNo: 1,
    lastCapturerId: null,
    winnerSeats: [],
    lastEvent: null,
    ...opts,
  };
}

function play(state: RobaitoState, seat: number, card: Card): RobaitoState {
  const result = applyRobaitoMove(state, seat, { type: 'play', cardId: card.id });
  assert.ok('state' in result, 'error' in result ? result.error : '');
  return result.state;
}

describe('El Robaíto · reparto', () => {
  for (const n of [2, 3, 4]) {
    it(`${n} jugadores: 4 cartas a cada uno, 4 en la mesa y el resto en el mazo`, () => {
      const state = createRobaitoGame(players(n), 0);
      assert.ok(state.hands.every((h) => h.length === 4));
      assert.equal(state.table.length, 4);
      assert.equal(state.deck.length, 52 - 4 * n - 4);
      assert.deepEqual(state.piles, Array.from({ length: n }, () => []));
      assert.equal(state.turn, 1 % n, 'empieza quien sigue al que reparte');
      const all = [...state.hands.flat(), ...state.table, ...state.deck];
      assert.equal(new Set(all.map((x) => x.id)).size, 52);
    });
  }
  it('solo admite de 2 a 4 jugadores', () => {
    assert.throws(() => createRobaitoGame(players(1)));
    assert.throws(() => createRobaitoGame(players(5)));
    assert.equal(canStartGame('robaito', 4), true);
    assert.equal(canStartGame('robaito', 5), false);
    assert.equal(GAMES.robaito.maxPlayers, 4);
  });
  it('createGameState y createSoloPlayers lo reconocen', () => {
    const solo = createSoloPlayers('robaito', { id: 'humano', name: 'Yo' });
    assert.equal(solo.length, 3);
    assert.equal(createGameState('robaito', solo).game, 'robaito');
  });
});

describe('El Robaíto · jugadas', () => {
  it('levanta de la mesa todas las cartas del mismo número y deja la jugada arriba', () => {
    const state = makeState({
      hands: [[c(7, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      table: [c(7, 'picas'), c(4, 'diamantes'), c(7, 'diamantes')],
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.deepEqual(next.piles[0].map((x) => x.id), ['picas-7', 'diamantes-7', 'corazones-7']);
    assert.deepEqual(next.table.map((x) => x.id), ['diamantes-4']);
    assert.equal(topOf(next.piles[0])?.id, 'corazones-7');
    assert.equal(next.lastCapturerId, 'humano');
    assert.equal(next.lastEvent?.kind, 'capture');
    assert.equal(next.lastEvent?.gained, 3);
    assert.equal(next.turn, 1);
  });

  it('roba el paquete completo del rival si iguala su cima, y se funde con el propio', () => {
    const state = makeState({
      hands: [[c(9, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      piles: [[c(13, 'picas')], [c(3, 'picas'), c(4, 'picas'), c(9, 'treboles')]],
      table: [c(8, 'diamantes')],
    });
    const next = play(state, 0, c(9, 'corazones'));
    assert.equal(next.piles[1].length, 0);
    assert.deepEqual(next.piles[0].map((x) => x.id), ['picas-13', 'picas-3', 'picas-4', 'treboles-9', 'corazones-9']);
    assert.equal(topOf(next.piles[0])?.id, 'corazones-9');
    assert.equal(next.lastEvent?.kind, 'steal');
    assert.deepEqual(next.lastEvent?.stolen, [{ seat: 1, count: 3 }]);
    assert.deepEqual(next.table.map((x) => x.id), ['diamantes-8'], 'la mesa sin coincidencias no se toca');
  });

  it('captura múltiple: mesa y paquetes de varios rivales en la misma jugada', () => {
    const state = makeState({
      hands: [[c(6, 'corazones'), c(2, 'treboles')], [c(5, 'picas')], [c(8, 'picas')]],
      piles: [[], [c(1, 'picas'), c(6, 'treboles')], [c(10, 'picas'), c(6, 'diamantes')]],
      table: [c(6, 'picas'), c(11, 'picas')],
    });
    const next = play(state, 0, c(6, 'corazones'));
    assert.equal(next.piles[0].length, 1 + 1 + 2 + 2);
    assert.equal(next.piles[1].length, 0);
    assert.equal(next.piles[2].length, 0);
    assert.deepEqual(next.table.map((x) => x.id), ['picas-11']);
    assert.equal(topOf(next.piles[0])?.id, 'corazones-6');
  });

  it('descarta en la mesa cuando no empareja con nada', () => {
    const state = makeState({
      hands: [[c(7, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      piles: [[], [c(9, 'treboles')]],
      table: [c(4, 'diamantes')],
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.deepEqual(next.table.map((x) => x.id), ['diamantes-4', 'corazones-7']);
    assert.equal(next.lastEvent?.kind, 'discard');
    assert.equal(next.lastCapturerId, null);
  });

  it('no se puede robar el propio paquete: su cima no cuenta', () => {
    const state = makeState({
      hands: [[c(9, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      piles: [[c(9, 'treboles')], []],
    });
    assert.deepEqual(captureOptions(state, 0, c(9, 'corazones')), { table: [], steals: [] });
    const next = play(state, 0, c(9, 'corazones'));
    assert.equal(next.piles[0].length, 1);
    assert.equal(next.table.length, 1);
  });

  it('un paquete vacío no se puede robar', () => {
    const state = makeState({ hands: [[c(9, 'corazones')], [c(5, 'picas')]] });
    assert.deepEqual(captureOptions(state, 0, c(9, 'corazones')).steals, []);
  });

  it('rechaza jugadas inválidas', () => {
    const state = makeState({ hands: [[c(7, 'corazones')], [c(5, 'picas')]] });
    assert.ok('error' in applyRobaitoMove(state, 1, { type: 'play', cardId: 'picas-5' }), 'fuera de turno');
    assert.ok('error' in applyRobaitoMove(state, 0, { type: 'play', cardId: 'picas-5' }), 'carta ajena');
    assert.ok('error' in applyGameMove(state, 0, { type: 'otra' }), 'jugada desconocida');
    assert.ok('state' in applyGameMove(state, 0, { type: 'play', cardId: 'corazones-7' }));
  });

  it('no modifica el estado anterior', () => {
    const state = makeState({
      hands: [[c(7, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      table: [c(7, 'picas')],
    });
    const snapshot = JSON.stringify(state);
    play(state, 0, c(7, 'corazones'));
    assert.equal(JSON.stringify(state), snapshot);
  });
});

describe('El Robaíto · repartos y final', () => {
  it('reparte 4 cartas nuevas a cada uno cuando todos se quedan sin cartas, sin tocar la mesa', () => {
    const deck = Array.from({ length: 8 }, (_, i) => c(i + 2, 'picas'));
    const state = makeState({ hands: [[c(7, 'corazones')], []], deck, table: [c(11, 'picas')] });
    const next = play(state, 0, c(7, 'corazones'));
    assert.equal(next.phase, 'playing');
    assert.equal(next.dealNo, 2);
    assert.ok(next.hands.every((h) => h.length === 4));
    assert.equal(next.deck.length, 0);
    assert.deepEqual(next.table.map((x) => x.id), ['picas-11', 'corazones-7'], 'la mesa solo cambia por la jugada');
    assert.equal(next.lastEvent?.redeal, true);
    assert.equal(next.turn, 1);
  });

  it('al acabar, lo suelto de la mesa pasa al último que capturó', () => {
    const state = makeState({
      hands: [[c(7, 'corazones')], []],
      deck: [],
      piles: [[c(1, 'picas')], [c(2, 'picas'), c(3, 'picas')]],
      table: [c(4, 'diamantes'), c(5, 'diamantes')],
      lastCapturerId: 'bot-1',
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.equal(next.phase, 'gameOver');
    assert.equal(next.table.length, 0);
    assert.equal(next.piles[1].length, 2 + 3);
    assert.equal(next.lastEvent?.swept, 3);
    assert.deepEqual(next.winnerSeats, [1]);
  });

  it('si el último que capturó es quien juega al final, también se lleva lo suelto', () => {
    const state = makeState({
      hands: [[c(7, 'corazones')], []],
      deck: [],
      table: [c(7, 'picas'), c(4, 'diamantes')],
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.equal(next.phase, 'gameOver');
    assert.equal(next.piles[0].length, 2 + 1);
    assert.deepEqual(next.winnerSeats, [0]);
  });

  it('gana quien tenga más cartas; la carta botada al final queda en la mesa y no cuenta', () => {
    assert.deepEqual(leadingSeats([[c(1, 'picas'), c(2, 'picas')], [c(3, 'picas'), c(4, 'picas')], [c(5, 'picas')]]), [0, 1]);
    const state = makeState({
      hands: [[c(7, 'corazones')], []],
      deck: [],
      piles: [[c(1, 'picas'), c(2, 'picas')], [c(3, 'picas'), c(4, 'picas'), c(5, 'picas')]],
      table: [],
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.equal(next.phase, 'gameOver');
    assert.deepEqual(next.winnerSeats, [1]);
  });

  it('empate: si dos paquetes terminan con las mismas cartas, ambos asientos ganan', () => {
    const state = makeState({
      hands: [[c(7, 'corazones')], []],
      deck: [],
      piles: [[c(1, 'picas')], [c(3, 'picas'), c(4, 'picas'), c(5, 'picas')]],
      table: [c(7, 'picas')],
    });
    const next = play(state, 0, c(7, 'corazones'));
    assert.equal(next.piles[0].length, 3);
    assert.equal(next.piles[1].length, 3);
    assert.deepEqual(next.winnerSeats, [0, 1]);
  });
});

describe('El Robaíto · IA', () => {
  it('prioridad 1: roba, y entre varios robos elige el paquete más grande', () => {
    const state = makeState({
      hands: [[c(4, 'corazones'), c(9, 'corazones'), c(12, 'corazones')], [c(5, 'picas')], [c(8, 'picas')]],
      piles: [[], [c(1, 'picas'), c(4, 'treboles')], [c(1, 'diamantes'), c(2, 'diamantes'), c(3, 'diamantes'), c(9, 'treboles')]],
      table: [c(12, 'picas')],
    });
    for (let i = 0; i < 20; i++) assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-9');
  });

  it('prioridad 2: sin robos, levanta la carta que más cartas se lleva de la mesa', () => {
    const state = makeState({
      hands: [[c(4, 'corazones'), c(9, 'corazones'), c(2, 'corazones')], [c(5, 'picas')]],
      piles: [[], [c(1, 'picas'), c(13, 'treboles')]],
      table: [c(9, 'picas'), c(9, 'diamantes'), c(4, 'picas'), c(3, 'picas')],
    });
    for (let i = 0; i < 20; i++) assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-9');
  });

  it('prioridad 3: al descartar evita el número de la cima de su propio paquete', () => {
    const state = makeState({
      hands: [[c(5, 'corazones'), c(8, 'corazones')], [c(2, 'picas')]],
      piles: [[c(5, 'treboles')], []],
      table: [c(11, 'picas')],
    });
    for (let i = 0; i < 20; i++) assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-8');
  });

  it('si todas sus cartas repiten su cima, igualmente juega una', () => {
    const state = makeState({
      hands: [[c(5, 'corazones')], [c(2, 'picas')]],
      piles: [[c(5, 'treboles')], []],
    });
    assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-5');
  });

  for (const n of [2, 3, 4]) {
    it(`${n} bots juegan partidas completas con jugadas válidas y conservan las 52 cartas`, () => {
      for (let g = 0; g < 25; g++) {
        let state: RobaitoState = createRobaitoGame(Array.from({ length: n }, (_, i) => ({ id: `bot-${i}`, name: `B${i}` })));
        let guard = 0;
        while (state.phase !== 'gameOver') {
          assert.ok(++guard < 200, 'partida sin fin');
          const step = botStep(state);
          assert.ok(step, 'el bot debe poder jugar');
          assert.ok('state' in step.result, 'error' in step.result ? step.result.error : '');
          assert.equal(botTickDelay(state) !== null, true);
          state = step.result.state as RobaitoState;
          const total = state.hands.flat().length + state.deck.length + state.table.length + state.piles.flat().length;
          assert.equal(total, 52);
        }
        assert.equal(state.table.length === 0 || state.lastCapturerId === null, true);
        assert.equal(state.piles.flat().length + state.table.length, 52);
        assert.ok(state.winnerSeats.length >= 1);
      }
    });
  }
});

describe('El Robaíto · vista de cada jugador', () => {
  it('oculta manos rivales, mazo y las cartas de abajo de cada paquete', () => {
    const state = makeState({
      hands: [[c(7, 'corazones')], [c(5, 'picas'), c(6, 'picas')]],
      piles: [[c(1, 'picas'), c(2, 'picas')], [c(3, 'picas'), c(4, 'picas'), c(9, 'treboles')]],
      deck: [c(12, 'picas'), c(13, 'picas')],
      table: [c(10, 'picas')],
    });
    const view = projectState(state, 0);
    assert.equal(view.game, 'robaito');
    if (view.game !== 'robaito') return;
    assert.deepEqual(view.hands[0].map((x) => x.id), ['corazones-7']);
    assert.ok(view.hands[1].every((x) => x.rank === 0 && x.suit === 'comodin'));
    assert.equal(view.hands[1].length, 2);
    assert.equal(view.deck.length, 2);
    assert.ok(view.deck.every((x) => x.rank === 0));
    assert.deepEqual(view.piles.map((p) => p.length), [2, 3], 'el contador se conserva');
    assert.equal(topOf(view.piles[1])?.id, 'treboles-9', 'la cima es visible');
    assert.ok(view.piles[1].slice(0, -1).every((x) => x.rank === 0), 'lo de abajo, oculto');
    assert.deepEqual(view.table.map((x) => x.id), ['picas-10']);
  });

  it('al terminar la partida los paquetes se muestran completos', () => {
    const state = makeState({
      phase: 'gameOver',
      hands: [[], []],
      deck: [],
      piles: [[c(1, 'picas'), c(2, 'picas')], [c(3, 'picas')]],
      winnerSeats: [0],
    });
    const view = projectState(state, 1);
    if (view.game !== 'robaito') throw new Error('juego equivocado');
    assert.deepEqual(view.piles[0].map((x) => x.id), ['picas-1', 'picas-2']);
  });

  it('el bot decide igual con la vista de otro jugador (solo usa datos públicos)', () => {
    const state = makeState({
      hands: [[c(9, 'corazones'), c(2, 'treboles')], [c(5, 'picas')]],
      piles: [[], [c(3, 'picas'), c(9, 'treboles')]],
    });
    const view = projectState(state, 0);
    if (view.game !== 'robaito') throw new Error('juego equivocado');
    assert.equal(chooseRobaitoCard(view, 0).id, 'corazones-9');
  });
});

describe('El Robaíto · IA analítica (valor neto)', () => {
  it('no roba un paquete si eso deja su paquete grande expuesto a un 9 probable', () => {
    // Las dos jugadas se llevan 3 cartas, pero robar el paquete deja mi cima en 9
    // (quedan 3 nueves sin ver) y mi paquete de 13 cartas a tiro del rival; levantar
    // los dos 4 de la mesa deja mi cima en 4, del que solo quedan 2 copias sin ver.
    const state = makeState({
      hands: [
        [c(9, 'corazones'), c(4, 'corazones')],
        [c(2, 'picas'), c(3, 'picas'), c(6, 'picas'), c(8, 'picas')],
        [c(7, 'picas')],
      ],
      deck: [],
      table: [c(4, 'picas'), c(4, 'diamantes')],
      piles: [
        [
          c(1, 'treboles'), c(2, 'treboles'), c(3, 'treboles'), c(5, 'treboles'), c(6, 'treboles'),
          c(7, 'treboles'), c(8, 'treboles'), c(10, 'treboles'), c(11, 'treboles'), c(13, 'picas'),
        ],
        [c(12, 'treboles'), c(9, 'diamantes')],
        [c(4, 'treboles')],
      ],
    });
    assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-4');
  });

  it('sigue robando el paquete más grande cuando no hay exposición', () => {
    const state = makeState({
      hands: [[c(4, 'corazones'), c(9, 'corazones'), c(12, 'corazones')], [c(5, 'picas')], [c(8, 'picas')]],
      piles: [[], [c(1, 'picas'), c(4, 'treboles')], [c(1, 'diamantes'), c(2, 'diamantes'), c(3, 'diamantes'), c(9, 'treboles')]],
      table: [c(12, 'picas')],
    });
    assert.equal(chooseRobaitoCard(state, 0).id, 'corazones-9');
  });
});
