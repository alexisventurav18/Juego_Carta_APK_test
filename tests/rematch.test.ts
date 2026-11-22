import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseCasinoMove } from '../src/games/casinoBot';
import { encodeAvatar, randomAvatar, seededRandom } from '../src/games/avatar';
import { isBotPlayer } from '../src/games/shared';
import {
  QUICKPLAY_WAIT_MS,
  handleRequest,
  type RoomRequest,
  type RoomResponse,
  type RoomStore,
  type RoomView,
} from '../src/games/roomService';
import { MemoryStore } from './memoryStore';

const KEY_A = 'clave-secreta-de-ana-0123456789';
const KEY_B = 'clave-secreta-de-beto-012345678';
const A = { playerId: 'jugador-ana-0001', key: KEY_A };
const B = { playerId: 'jugador-beto-0002', key: KEY_B };
const C = { playerId: 'jugador-carla-0003', key: 'clave-secreta-de-carla-01234567' };

async function ok(store: RoomStore, req: RoomRequest): Promise<RoomView> {
  const res = await handleRequest(store, req);
  assert.ok(res.ok, res.ok ? '' : res.error);
  assert.ok('room' in res, 'se esperaba una sala');
  return res.room;
}
async function fail(store: RoomStore, req: unknown): Promise<string> {
  const res: RoomResponse = await handleRequest(store, req);
  assert.ok(!res.ok, 'se esperaba un error');
  return res.ok ? '' : res.error;
}

/** Sala de Casino con Ana y Beto, jugada hasta el fin (gameOver). */
async function finishedCasinoRoom(store: MemoryStore) {
  const avatar = encodeAvatar(randomAvatar(seededRandom('rematch')));
  const created = await ok(store, { action: 'create', game: 'casino', name: 'Ana', avatar, level: 42, ...A });
  await ok(store, { action: 'join', code: created.code, name: 'Beto', level: 7, ...B });
  let view = await ok(store, { action: 'start', roomId: created.id, ...A });
  let guard = 0;
  while (view.state && view.state.phase !== 'gameOver') {
    assert.ok(++guard < 3000, 'partida sin fin');
    const state = view.state;
    if (state.game !== 'casino') throw new Error('juego inesperado');
    const full = store.fullState(created.id);
    if (state.phase === 'playing') {
      const auth = state.turn === 0 ? A : B;
      const move = chooseCasinoMove(full as Parameters<typeof chooseCasinoMove>[0]);
      assert.ok(move);
      view = await ok(store, { action: 'move', roomId: created.id, move, ...auth });
    } else if (state.phase === 'roundEnd') {
      const nextDealer = (state.dealer + 1) % state.players.length;
      const auth = nextDealer === 0 ? A : B;
      view = await ok(store, { action: 'move', roomId: created.id, move: { type: 'nextRound' }, ...auth });
    } else {
      view = await ok(store, { action: 'tick', roomId: created.id, expectedVersion: view.version, ...A });
    }
  }
  assert.equal(view.state?.phase, 'gameOver');
  return { id: created.id, code: created.code, avatar, view };
}

describe('revancha online', () => {
  it('crea una sala nueva con el mismo juego y quien pide como único jugador', async () => {
    const store = new MemoryStore();
    const { id, code, avatar } = await finishedCasinoRoom(store);
    const next = await ok(store, { action: 'rematch', roomId: id, ...A });
    assert.notEqual(next.id, id);
    assert.notEqual(next.code, code);
    assert.equal(next.game, 'casino');
    assert.equal(next.status, 'waiting');
    assert.equal(next.isPublic, true);
    assert.equal(next.players.length, 1);
    assert.equal(next.players[0].id, A.playerId);
    assert.equal(next.players[0].name, 'Ana');
    assert.equal(next.players[0].avatar, avatar);
    assert.equal(next.players[0].level, 42);
    // Si A vuelve a tocar Revancha mientras espera, sigue en la misma sala.
    const again = await ok(store, { action: 'rematch', roomId: id, ...A });
    assert.equal(again.id, next.id);
    assert.equal(again.players.length, 1);
    // La sala vieja no cambia: sigue terminada, con los dos humanos.
    const old = await ok(store, { action: 'view', roomId: id, ...A });
    assert.equal(old.status, 'playing');
    assert.equal(old.state?.phase, 'gameOver');
    assert.equal(old.players.length, 2);
  });

  it('doble revancha no duplica: A y B comparten la misma sala nueva', async () => {
    const store = new MemoryStore();
    const { id } = await finishedCasinoRoom(store);
    const first = await ok(store, { action: 'rematch', roomId: id, ...A });
    const second = await ok(store, { action: 'rematch', roomId: id, ...B });
    assert.equal(second.id, first.id);
    assert.equal(second.code, first.code);
    assert.equal(second.players.length, 2);
    assert.deepEqual(
      second.players.map((p) => p.id),
      [A.playerId, B.playerId],
    );
    // En cuanto se unen todos los humanos, la revancha arranca al momento.
    assert.equal(second.status, 'playing');
    assert.equal(second.players.filter((p) => isBotPlayer(p)).length, 0, 'sin bots con dos humanos');
    assert.ok(second.state);
    // Si A vuelve a tocar Revancha ya empezada la partida, es otra
    // petición: se crea una sala nueva en espera con solo A.
    const third = await ok(store, { action: 'rematch', roomId: id, ...A });
    assert.notEqual(third.id, first.id);
    assert.equal(third.status, 'waiting');
    assert.equal(third.players.length, 1);
    assert.equal(third.players[0].id, A.playerId);
  });

  it('pasada la ventana de dedup, una revancha crea otra sala distinta', async () => {
    const store = new MemoryStore();
    const { id } = await finishedCasinoRoom(store);
    const first = await ok(store, { action: 'rematch', roomId: id, ...A });
    store.setCreatedAt(first.id, Date.now() - 121_000);
    const second = await ok(store, { action: 'rematch', roomId: id, ...B });
    assert.notEqual(second.id, first.id);
    assert.equal(second.players.length, 1);
    assert.equal(second.players[0].id, B.playerId);
  });

  it('revancha en sala no terminada se rechaza (a mitad de partida y en espera)', async () => {
    const store = new MemoryStore();
    const created = await ok(store, { action: 'create', game: 'casino', name: 'Ana', ...A });
    assert.equal(
      await fail(store, { action: 'rematch', roomId: created.id, ...A }),
      'La partida todavía no terminó.',
    );
    await ok(store, { action: 'join', code: created.code, name: 'Beto', ...B });
    await ok(store, { action: 'start', roomId: created.id, ...A });
    assert.equal(
      await fail(store, { action: 'rematch', roomId: created.id, ...A }),
      'La partida todavía no terminó.',
    );
  });

  it('revancha de quien no está en la sala se rechaza', async () => {
    const store = new MemoryStore();
    const { id } = await finishedCasinoRoom(store);
    assert.equal(
      await fail(store, { action: 'rematch', roomId: id, ...C }),
      'No estás en esta sala.',
    );
  });

  it('tras abandonar la partida terminada, la revancha se rechaza', async () => {
    const store = new MemoryStore();
    const { id } = await finishedCasinoRoom(store);
    await ok(store, { action: 'abandon', roomId: id, ...B });
    assert.equal(
      await fail(store, { action: 'rematch', roomId: id, ...B }),
      'No estás en esta sala.',
    );
    // El otro humano sí puede pedirla. Como ya es el único humano que
    // queda de la partida, su revancha arranca al momento con un bot.
    const next = await ok(store, { action: 'rematch', roomId: id, ...A });
    assert.equal(next.status, 'playing');
    assert.equal(next.players.length, 2);
    assert.equal(next.players.filter((p) => isBotPlayer(p)).length, 1);
    assert.equal(next.players[0].id, A.playerId);
    assert.ok(next.state);
  });

  it('el que no se une lo reemplaza el bot: la sala arranca sola a los 30 s', async () => {
    const store = new MemoryStore();
    const { id } = await finishedCasinoRoom(store);
    const next = await ok(store, { action: 'rematch', roomId: id, ...A });
    assert.equal(next.status, 'waiting');
    store.setCreatedAt(next.id, Date.now() - QUICKPLAY_WAIT_MS - 1000);
    const started = await ok(store, { action: 'view', roomId: next.id, ...A });
    assert.equal(started.status, 'playing');
    assert.equal(started.players.length, 2);
    assert.equal(started.players.filter((p) => isBotPlayer(p)).length, 1);
    assert.equal(started.players[0].id, A.playerId);
    assert.ok(started.state);
  });

  it('la sala de revancha no se confunde con otra sala pública del mismo juego', async () => {
    const store = new MemoryStore();
    // Otra sala pública de Casino en espera, con una extraña (no es de la partida).
    const other = await ok(store, { action: 'quickplay', game: 'casino', name: 'Carla', ...C });
    assert.equal(other.isPublic, true);
    const { id } = await finishedCasinoRoom(store);
    const next = await ok(store, { action: 'rematch', roomId: id, ...A });
    // La revancha es una sala nueva, no la sala de Carla.
    assert.notEqual(next.id, other.id);
    assert.equal(next.players.length, 1);
    assert.equal(next.players[0].id, A.playerId);
  });
});
