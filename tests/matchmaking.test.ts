import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GameId } from '../src/games/shared';
import {
  handleRequest,
  QUICKPLAY_STALE_MS,
  QUICKPLAY_WAIT_MS,
  type RoomPatch,
  type RoomRecord,
  type RoomRequest,
  type RoomResponse,
  type RoomStore,
  type RoomView,
  type StoredRoom,
} from '../src/games/roomService';
import { isBotPlayer } from '../src/games/shared';

class MemoryStore implements RoomStore {
  rooms = new Map<string, StoredRoom>();
  private seq = 0;

  async findById(id: string) {
    return this.rooms.get(id) ?? null;
  }
  async findByCode(code: string) {
    return [...this.rooms.values()].find((r) => r.room.code === code) ?? null;
  }
  async findWaiting(game: GameId) {
    return [...this.rooms.values()]
      .filter((r) => r.room.game === game && r.room.isPublic && r.room.status === 'waiting')
      .sort((a, b) => a.room.createdAt - b.room.createdAt);
  }
  async create(room: Pick<RoomRecord, 'game' | 'status' | 'players' | 'isPublic' | 'createdAt'>, secret: StoredRoom['secret']) {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`;
    const stored: StoredRoom = {
      room: { ...room, id, code: `QP${String(this.seq).padStart(3, '0')}`, version: 0 },
      secret,
    };
    this.rooms.set(id, stored);
    return stored;
  }
  async update(roomId: string, expectedVersion: number, patch: RoomPatch) {
    const stored = this.rooms.get(roomId);
    if (!stored || stored.room.version !== expectedVersion) return false;
    stored.room = {
      ...stored.room,
      status: patch.status,
      players: patch.players,
      version: expectedVersion + 1,
      isPublic: patch.isPublic,
    };
    stored.secret = { state: patch.state, keys: patch.keys };
    return true;
  }
  async remove(roomId: string) {
    this.rooms.delete(roomId);
  }
  setCreatedAt(roomId: string, createdAt: number) {
    this.rooms.get(roomId)!.room.createdAt = createdAt;
  }
}

const PLAYERS = [
  { playerId: 'jugador-ana-0001', key: 'clave-secreta-de-ana-0123456789' },
  { playerId: 'jugador-beto-0002', key: 'clave-secreta-de-beto-012345678' },
  { playerId: 'jugador-carla-0003', key: 'clave-secreta-de-carla-01234567' },
  { playerId: 'jugador-diego-0004', key: 'clave-secreta-de-diego-012345678' },
  { playerId: 'jugador-elena-0005', key: 'clave-secreta-de-elena-01234567' },
] as const;

async function ok(store: RoomStore, req: RoomRequest): Promise<RoomView> {
  const res = await handleRequest(store, req);
  assert.ok(res.ok, res.ok ? '' : res.error);
  return res.room;
}
async function fail(store: RoomStore, req: unknown): Promise<string> {
  const res: RoomResponse = await handleRequest(store, req);
  assert.ok(!res.ok, 'se esperaba un error');
  return res.ok ? '' : res.error;
}

const quickplay = (game: GameId, i: number) =>
  ({ action: 'quickplay', game, name: `Jugador ${i}`, ...PLAYERS[i] }) as RoomRequest;

describe('matchmaking: entrar sin código', () => {
  it('si no hay sala pública, crea una nueva (y es pública)', async () => {
    const store = new MemoryStore();
    const room = await ok(store, quickplay('casino', 0));
    assert.equal(room.status, 'waiting');
    assert.equal(room.isPublic, true);
    assert.equal(room.players.length, 1);
    assert.ok(Date.now() - room.createdAt < 5000);
  });

  it('el segundo jugador entra en la misma sala en espera', async () => {
    const store = new MemoryStore();
    const first = await ok(store, quickplay('tresydos', 0));
    const second = await ok(store, quickplay('tresydos', 1));
    assert.equal(second.id, first.id);
    assert.equal(second.players.length, 2);
    assert.equal(second.status, 'waiting');
  });

  it('el mismo jugador que repite quickplay vuelve a su sala', async () => {
    const store = new MemoryStore();
    const first = await ok(store, quickplay('cagao', 0));
    const again = await ok(store, quickplay('cagao', 0));
    assert.equal(again.id, first.id);
    assert.equal(again.players.length, 1);
  });

  it('no entra en salas privadas (con código)', async () => {
    const store = new MemoryStore();
    const priv = await ok(store, { action: 'create', game: 'casino', name: 'Ana', ...PLAYERS[0] });
    assert.equal(priv.isPublic, false);
    const room = await ok(store, quickplay('casino', 1));
    assert.notEqual(room.id, priv.id);
    assert.equal(room.isPublic, true);
    assert.equal(room.players.length, 1);
  });

  it('no entra en salas públicas viejas (más de 5 min en espera)', async () => {
    const store = new MemoryStore();
    const old = await ok(store, quickplay('robaito', 0));
    store.setCreatedAt(old.id, Date.now() - QUICKPLAY_STALE_MS - 1000);
    const room = await ok(store, quickplay('robaito', 1));
    assert.notEqual(room.id, old.id);
    assert.equal(room.players.length, 1);
  });

  it('cuando la sala se llena, arranca sola sin bots', async () => {
    const store = new MemoryStore();
    let room: RoomView | null = null;
    for (let i = 0; i < 4; i++) room = await ok(store, quickplay('tresydos', i));
    assert.ok(room);
    assert.equal(room.status, 'playing');
    assert.equal(room.players.length, 4);
    assert.equal(room.players.filter((p) => isBotPlayer(p)).length, 0);
    assert.ok(room.state);
    // El quinto ya no cabe: abre otra sala.
    const fifth = await ok(store, quickplay('tresydos', 4));
    assert.notEqual(fifth.id, room.id);
    assert.equal(fifth.status, 'waiting');
  });

  it('rechaza un juego inválido', async () => {
    const store = new MemoryStore();
    assert.match(await fail(store, { action: 'quickplay', game: 'poker', name: 'Ana', ...PLAYERS[0] }), /Juego/);
  });
});

describe('matchmaking: completar con bots y arrancar', () => {
  it('antes de los 30 s la sala sigue esperando', async () => {
    const store = new MemoryStore();
    const room = await ok(store, quickplay('casino', 0));
    const seen = await ok(store, { action: 'view', roomId: room.id, ...PLAYERS[0] });
    assert.equal(seen.status, 'waiting');
    assert.equal(seen.players.length, 1);
  });

  for (const game of ['casino', 'tresydos', 'cagao', 'robaito'] as const) {
    it(`${game}: un jugador solo arranca con 1 bot a los 30 s`, async () => {
      const store = new MemoryStore();
      const room = await ok(store, quickplay(game, 0));
      store.setCreatedAt(room.id, Date.now() - QUICKPLAY_WAIT_MS - 1000);
      const started = await ok(store, { action: 'view', roomId: room.id, ...PLAYERS[0] });
      assert.equal(started.status, 'playing');
      assert.equal(started.players.length, 2);
      assert.equal(started.players.filter((p) => isBotPlayer(p)).length, 1);
      assert.ok(started.state);
    });
  }

  it('casino con 3 humanos se completa con 1 bot (mesa de 4)', async () => {
    const store = new MemoryStore();
    let room: RoomView | null = null;
    for (let i = 0; i < 3; i++) room = await ok(store, quickplay('casino', i));
    assert.ok(room);
    assert.equal(room.status, 'waiting');
    store.setCreatedAt(room.id, Date.now() - QUICKPLAY_WAIT_MS - 1000);
    const started = await ok(store, { action: 'view', roomId: room.id, ...PLAYERS[0] });
    assert.equal(started.status, 'playing');
    assert.equal(started.players.length, 4);
    assert.equal(started.players.filter((p) => !isBotPlayer(p)).length, 3);
    assert.equal(started.players.filter((p) => isBotPlayer(p)).length, 1);
  });

  it('el arranque también lo dispara el tick de otro jugador', async () => {
    const store = new MemoryStore();
    const first = await ok(store, quickplay('tresydos', 0));
    await ok(store, quickplay('tresydos', 1));
    store.setCreatedAt(first.id, Date.now() - QUICKPLAY_WAIT_MS - 1000);
    const started = await ok(store, { action: 'tick', roomId: first.id, expectedVersion: 1, ...PLAYERS[1] });
    assert.equal(started.status, 'playing');
    assert.equal(started.players.length, 2);
  });
});

describe('matchmaking: salir de la espera', () => {
  it('quitarse de la sala deja el asiento libre para otro', async () => {
    const store = new MemoryStore();
    const room = await ok(store, quickplay('casino', 0));
    await ok(store, quickplay('casino', 1));
    const left = await ok(store, { action: 'leave', roomId: room.id, ...PLAYERS[0] });
    assert.equal(left.players.length, 1);
    assert.equal(left.players[0].id, PLAYERS[1].playerId);
    const third = await ok(store, quickplay('casino', 2));
    assert.equal(third.id, room.id);
    assert.equal(third.players.length, 2);
  });

  it('si sale el último, la sala se borra', async () => {
    const store = new MemoryStore();
    const room = await ok(store, quickplay('casino', 0));
    await ok(store, { action: 'leave', roomId: room.id, ...PLAYERS[0] });
    assert.equal(await store.findById(room.id), null);
    assert.match(await fail(store, { action: 'view', roomId: room.id, ...PLAYERS[0] }), /no existe/);
  });

  it('no se puede salir de una partida empezada', async () => {
    const store = new MemoryStore();
    const room = await ok(store, quickplay('casino', 0));
    store.setCreatedAt(room.id, Date.now() - QUICKPLAY_WAIT_MS - 1000);
    await ok(store, { action: 'view', roomId: room.id, ...PLAYERS[0] });
    assert.match(await fail(store, { action: 'leave', roomId: room.id, ...PLAYERS[0] }), /empezó/);
  });
});
