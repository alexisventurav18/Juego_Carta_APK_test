import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseCagaoMove, hasPair } from '../src/games/cagao';
import { chooseCasinoMove } from '../src/games/casinoBot';
import { lastFinishedTournament, previousSeasonId, seasonId } from '../src/games/ranking';
import {
  handleRequest,
  type RoomRequest,
  type RoomResponse,
  type RoomStore,
  type RoomView,
  type SocialPayload,
} from '../src/games/roomService';
import { MemoryStore } from './memoryStore';

const KEY_A = 'clave-secreta-de-ana-0123456789';
const KEY_B = 'clave-secreta-de-beto-012345678';
const KEY_C = 'clave-secreta-de-carla-01234567';
const KEY_D = 'clave-secreta-de-diego-012345678';
const A = { playerId: 'jugador-ana-0001', key: KEY_A };
const B = { playerId: 'jugador-beto-0002', key: KEY_B };
const C = { playerId: 'jugador-carla-0003', key: KEY_C };
const D = { playerId: 'jugador-diego-0004', key: KEY_D };

async function ok(store: RoomStore, req: RoomRequest): Promise<RoomView> {
  const res = await handleRequest(store, req);
  assert.ok(res.ok, res.ok ? '' : res.error);
  assert.ok('room' in res, 'se esperaba una sala');
  return res.room;
}
async function okData(store: RoomStore, req: RoomRequest): Promise<SocialPayload> {
  const res = await handleRequest(store, req);
  assert.ok(res.ok, res.ok ? '' : res.error);
  assert.ok('data' in res, 'se esperaban datos');
  return res.data;
}
async function fail(store: RoomStore, req: unknown): Promise<string> {
  const res: RoomResponse = await handleRequest(store, req);
  assert.ok(!res.ok, 'se esperaba un error');
  return res.ok ? '' : res.error;
}

/** Crea el perfil de un jugador con una sala propia (cada create guarda el perfil). */
async function makeProfile(store: MemoryStore, auth: typeof A, name: string, game: 'casino' | 'tresydos' = 'casino') {
  return ok(store, { action: 'create', game, name, ...auth });
}

async function withFixedNow(ms: number, fn: () => Promise<void>): Promise<void> {
  const original = Date.now;
  Date.now = () => ms;
  try {
    await fn();
  } finally {
    Date.now = original;
  }
}

/** Juega una partida completa de Casino contra bots y devuelve el equipo ganador. */
async function playSoloCasino(store: MemoryStore, auth: typeof A): Promise<{ winnerTeam: number | null }> {
  const created = await ok(store, { action: 'create', game: 'casino', solo: true, name: 'Ana', ...auth });
  let view = await ok(store, { action: 'start', roomId: created.id, dealer: 1, ...auth });
  let guard = 0;
  while (view.state && view.state.phase !== 'gameOver') {
    assert.ok(++guard < 3000, 'partida sin fin');
    const full = store.fullState(created.id);
    if (full.game !== 'casino') throw new Error('juego inesperado');
    const humanTurn = full.phase === 'playing' && full.turn === 0;
    const humanDeals = full.phase === 'roundEnd' && (full.dealer + 1) % created.players.length === 0;
    if (humanTurn) {
      const move = chooseCasinoMove(full as Parameters<typeof chooseCasinoMove>[0]);
      assert.ok(move);
      view = await ok(store, { action: 'move', roomId: created.id, move, ...auth });
    } else if (humanDeals) {
      view = await ok(store, { action: 'move', roomId: created.id, move: { type: 'nextRound' }, ...auth });
    } else {
      view = await ok(store, { action: 'tick', roomId: created.id, expectedVersion: view.version, ...auth });
    }
  }
  const full = store.fullState(created.id);
  if (full.game !== 'casino') throw new Error('juego inesperado');
  return { winnerTeam: full.winnerTeam };
}

/** Juega una partida completa de Casino entre dos humanos (sin bots). */
async function playDuoCasino(store: MemoryStore): Promise<{ winnerTeam: number | null }> {
  const created = await ok(store, { action: 'create', game: 'casino', name: 'Ana', ...A });
  await ok(store, { action: 'join', code: created.code, name: 'Beto', ...B });
  let view = await ok(store, { action: 'start', roomId: created.id, ...A });
  let guard = 0;
  while (view.state && view.state.phase !== 'gameOver') {
    assert.ok(++guard < 3000, 'partida sin fin');
    const full = store.fullState(created.id);
    if (full.game !== 'casino') throw new Error('juego inesperado');
    const seats = full.players.length;
    const humanTurn = full.phase === 'playing' && (full.turn === 0 || full.turn === 1);
    const nextDealer = (full.dealer + 1) % seats;
    const humanDeals = full.phase === 'roundEnd' && (nextDealer === 0 || nextDealer === 1);
    if (humanTurn) {
      const move = chooseCasinoMove(full as Parameters<typeof chooseCasinoMove>[0]);
      assert.ok(move);
      view = await ok(store, { action: 'move', roomId: created.id, move, ...(full.turn === 0 ? A : B) });
    } else if (humanDeals) {
      view = await ok(store, { action: 'move', roomId: created.id, move: { type: 'nextRound' }, ...(nextDealer === 0 ? A : B) });
    } else {
      view = await ok(store, { action: 'tick', roomId: created.id, expectedVersion: view.version, ...A });
    }
  }
  const full = store.fullState(created.id);
  if (full.game !== 'casino') throw new Error('juego inesperado');
  return { winnerTeam: full.winnerTeam };
}

/** Juega una partida completa de El Cagao contra bots y devuelve el asiento perdedor. */
async function playSoloCagao(store: MemoryStore, auth: typeof A): Promise<{ loserSeat: number | null }> {
  const created = await ok(store, { action: 'create', game: 'cagao', solo: true, name: 'Ana', ...auth });
  let view = await ok(store, { action: 'start', roomId: created.id, ...auth });
  let guard = 0;
  while (view.state && view.state.phase !== 'gameOver') {
    assert.ok(++guard < 1000, 'partida sin fin');
    const full = store.fullState(created.id);
    if (full.game !== 'cagao') throw new Error('juego inesperado');
    if (full.phase === 'pairing' && hasPair(full.hands[0])) {
      view = await ok(store, { action: 'move', roomId: created.id, move: { type: 'pairAll' }, ...auth });
    } else if (full.phase === 'playing' && full.turn === 0) {
      view = await ok(store, { action: 'move', roomId: created.id, move: chooseCagaoMove(full), ...auth });
    } else {
      view = await ok(store, { action: 'tick', roomId: created.id, expectedVersion: view.version, ...auth });
    }
  }
  const full = store.fullState(created.id);
  if (full.game !== 'cagao') throw new Error('juego inesperado');
  return { loserSeat: full.loserSeat };
}

describe('ranking en el servidor: perfiles', () => {
  it('crear una sala crea el perfil con código de amigo, y el nombre se actualiza', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const friends = await okData(store, { action: 'friends_list', ...A });
    assert.equal(friends.kind, 'friends');
    if (friends.kind !== 'friends') throw new Error('tipo inesperado');
    assert.match(friends.myCode, /^[A-HJ-NP-Z2-9]{6}$/);

    // Mismo jugador, otro nombre: el perfil se actualiza, el código no cambia.
    await makeProfile(store, A, 'Ana María');
    const again = await okData(store, { action: 'friends_list', ...A });
    if (again.kind !== 'friends') throw new Error('tipo inesperado');
    assert.equal(again.myCode, friends.myCode);
    await makeProfile(store, B, 'Beto');
    const found = await okData(store, { action: 'friend_search', query: 'Ana M', ...B });
    assert.equal(found.kind, 'friendSearch');
    if (found.kind !== 'friendSearch') throw new Error('tipo inesperado');
    assert.deepEqual(
      found.players.map((p) => p.name),
      ['Ana María'],
    );
  });

  it('sin perfil, las acciones sociales piden crear o entrar a una sala', async () => {
    const store = new MemoryStore();
    assert.match(await fail(store, { action: 'friends_list', ...A }), /perfil/);
    assert.match(await fail(store, { action: 'ranking', ...A }), /perfil/);
    assert.match(await fail(store, { action: 'tournament', ...A }), /perfil/);
  });

  it('el mismo id con otra clave no puede secuestrar el perfil', async () => {
    const store = new MemoryStore();
    const created = await makeProfile(store, A, 'Ana');
    assert.match(
      await fail(store, { action: 'join', code: created.code, name: 'Ana', playerId: A.playerId, key: KEY_B }),
      /otra clave/,
    );
    assert.match(
      await fail(store, { action: 'create', game: 'casino', name: 'Ana', playerId: A.playerId, key: KEY_B }),
      /otra clave/,
    );
  });

  it('las acciones sociales rechazan una clave distinta a la del perfil', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    assert.match(
      await fail(store, { action: 'friend_request', targetId: B.playerId, playerId: A.playerId, key: KEY_B }),
      /verificar/,
    );
  });
});

describe('ranking en el servidor: amigos', () => {
  async function twoFriends(store: MemoryStore) {
    const created = await makeProfile(store, A, 'Ana');
    await ok(store, { action: 'join', code: created.code, name: 'Beto', ...B });
    return created;
  }

  it('buscar por nombre o por código, sin verse a uno mismo', async () => {
    const store = new MemoryStore();
    await twoFriends(store);
    const byName = await okData(store, { action: 'friend_search', query: 'Be', ...A });
    assert.equal(byName.kind, 'friendSearch');
    if (byName.kind !== 'friendSearch') throw new Error('tipo inesperado');
    assert.deepEqual(
      byName.players.map((p) => p.name),
      ['Beto'],
    );
    const friends = await okData(store, { action: 'friends_list', ...B });
    if (friends.kind !== 'friends') throw new Error('tipo inesperado');
    const byCode = await okData(store, { action: 'friend_search', query: friends.myCode, ...A });
    if (byCode.kind !== 'friendSearch') throw new Error('tipo inesperado');
    assert.deepEqual(
      byCode.players.map((p) => p.name),
      ['Beto'],
    );
    // A sí misma no se encuentra.
    const self = await okData(store, { action: 'friend_search', query: 'Ana', ...A });
    if (self.kind !== 'friendSearch') throw new Error('tipo inesperado');
    assert.deepEqual(self.players, []);
  });

  it('solicitud, pendientes, aceptar, y ya no se puede pedir de nuevo', async () => {
    const store = new MemoryStore();
    await twoFriends(store);
    const sent = await okData(store, { action: 'friend_request', targetId: B.playerId, ...A });
    assert.deepEqual(sent, { kind: 'friendRequest', accepted: false });

    const forBeto = await okData(store, { action: 'friends_list', ...B });
    if (forBeto.kind !== 'friends') throw new Error('tipo inesperado');
    assert.deepEqual(
      forBeto.pendingIn.map((p) => p.name),
      ['Ana'],
    );
    const forAna = await okData(store, { action: 'friends_list', ...A });
    if (forAna.kind !== 'friends') throw new Error('tipo inesperado');
    assert.deepEqual(
      forAna.pendingOut.map((p) => p.name),
      ['Beto'],
    );

    assert.deepEqual(await okData(store, { action: 'friend_accept', requesterId: A.playerId, ...B }), { kind: 'ok' });
    const friendsBeto = await okData(store, { action: 'friends_list', ...B });
    if (friendsBeto.kind !== 'friends') throw new Error('tipo inesperado');
    assert.equal(friendsBeto.friends.length, 1);
    assert.equal(friendsBeto.friends[0].name, 'Ana');
    // Beto sigue en la sala en espera: en línea, con su código.
    assert.equal(friendsBeto.friends[0].online, true);
    assert.ok(friendsBeto.friends[0].inRoom);

    assert.match(await fail(store, { action: 'friend_request', targetId: B.playerId, ...A }), /Ya son amigos/);
  });

  it('rechazar borra la solicitud y un segundo rechazo ya no encuentra nada', async () => {
    const store = new MemoryStore();
    const created = await makeProfile(store, A, 'Ana');
    await ok(store, { action: 'join', code: created.code, name: 'Carla', ...C });
    await okData(store, { action: 'friend_request', targetId: A.playerId, ...C });
    assert.deepEqual(await okData(store, { action: 'friend_reject', requesterId: C.playerId, ...A }), { kind: 'ok' });
    const list = await okData(store, { action: 'friends_list', ...A });
    if (list.kind !== 'friends') throw new Error('tipo inesperado');
    assert.deepEqual(list.pendingIn, []);
    assert.match(await fail(store, { action: 'friend_reject', requesterId: C.playerId, ...A }), /pendiente/);
  });

  it('si los dos se piden amistad, la segunda solicitud acepta sola', async () => {
    const store = new MemoryStore();
    await twoFriends(store);
    await okData(store, { action: 'friend_request', targetId: B.playerId, ...A });
    const back = await okData(store, { action: 'friend_request', targetId: A.playerId, ...B });
    assert.deepEqual(back, { kind: 'friendRequest', accepted: true });
    const list = await okData(store, { action: 'friends_list', ...A });
    if (list.kind !== 'friends') throw new Error('tipo inesperado');
    assert.deepEqual(
      list.friends.map((f) => f.name),
      ['Beto'],
    );
    assert.deepEqual(list.pendingOut, []);
  });

  it('pedir amistad a quien no existe, o a uno mismo, se rechaza', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    assert.match(
      await fail(store, { action: 'friend_request', targetId: 'jugador-fantasma-0000', ...A }),
      /No encontramos/,
    );
    assert.match(await fail(store, { action: 'friend_request', targetId: A.playerId, ...A }), /ti mismo/);
  });

  it('eliminar quita la amistad en ambos lados', async () => {
    const store = new MemoryStore();
    await twoFriends(store);
    await okData(store, { action: 'friend_request', targetId: B.playerId, ...A });
    await okData(store, { action: 'friend_accept', requesterId: A.playerId, ...B });
    assert.deepEqual(await okData(store, { action: 'friend_remove', friendId: B.playerId, ...A }), { kind: 'ok' });
    for (const auth of [A, B]) {
      const list = await okData(store, { action: 'friends_list', ...auth });
      if (list.kind !== 'friends') throw new Error('tipo inesperado');
      assert.deepEqual(list.friends, []);
    }
  });
});

describe('ranking en el servidor: invitaciones', () => {
  it('invitar a un amigo crea una sala privada y el otro la ve y entra con el código', async () => {
    const store = new MemoryStore();
    const created = await makeProfile(store, A, 'Ana');
    await ok(store, { action: 'join', code: created.code, name: 'Beto', ...B });
    await okData(store, { action: 'friend_request', targetId: B.playerId, ...A });
    await okData(store, { action: 'friend_accept', requesterId: A.playerId, ...B });

    const invite = await okData(store, { action: 'invite_friend', friendId: B.playerId, game: 'tresydos', ...A });
    assert.equal(invite.kind, 'invite');
    if (invite.kind !== 'invite') throw new Error('tipo inesperado');
    assert.equal(invite.game, 'tresydos');
    assert.match(invite.code, /^[A-Z2-9]{5}$/);

    const list = await okData(store, { action: 'friends_list', ...B });
    if (list.kind !== 'friends') throw new Error('tipo inesperado');
    assert.equal(list.invites.length, 1);
    assert.equal(list.invites[0].fromName, 'Ana');
    assert.equal(list.invites[0].code, invite.code);
    assert.equal(list.invites[0].game, 'tresydos');

    const joined = await ok(store, { action: 'join', code: invite.code, name: 'Beto', ...B });
    assert.equal(joined.game, 'tresydos');
    assert.equal(joined.players.length, 2);
    const after = await okData(store, { action: 'friends_list', ...B });
    if (after.kind !== 'friends') throw new Error('tipo inesperado');
    assert.deepEqual(after.invites, []);
  });

  it('no se puede invitar a quien no es amigo', async () => {
    const store = new MemoryStore();
    const created = await makeProfile(store, A, 'Ana');
    await ok(store, { action: 'join', code: created.code, name: 'Carla', ...C });
    assert.match(await fail(store, { action: 'invite_friend', friendId: C.playerId, ...A }), /amigo/);
  });
});

describe('ranking en el servidor: puntos por partida', () => {
  it('una partida completa de Casino entre dos humanos premia a los dos, y los bots no aparecen', async () => {
    const store = new MemoryStore();
    const { winnerTeam } = await playDuoCasino(store);
    const season = seasonId(new Date());
    const board = await okData(store, { action: 'ranking', season, ...A });
    assert.equal(board.kind, 'ranking');
    if (board.kind !== 'ranking') throw new Error('tipo inesperado');
    assert.equal(board.season, season);
    assert.equal(board.entries.length, 2, 'los dos humanos tienen puntos');
    // Ana es el asiento 0 (equipo 0) y Beto el asiento 1 (equipo 1).
    const ana = board.entries.find((e) => e.name === 'Ana');
    const beto = board.entries.find((e) => e.name === 'Beto');
    assert.ok(ana && beto);
    assert.equal(ana.matches, 1);
    assert.equal(beto.matches, 1);
    const anaWon = winnerTeam === 0;
    assert.equal(ana.points, anaWon ? 100 : 0);
    assert.equal(beto.points, anaWon ? 0 : 100);
    assert.equal(ana.wins, anaWon ? 1 : 0);
    assert.equal(ana.losses, anaWon ? 0 : 1);
    assert.deepEqual(board.me, ana);
  });

  it('una partida solo contra bots no da puntos de ranking', async () => {
    const store = new MemoryStore();
    await playSoloCasino(store, A);
    const season = seasonId(new Date());
    const board = await okData(store, { action: 'ranking', season, ...A });
    if (board.kind !== 'ranking') throw new Error('tipo inesperado');
    assert.equal(board.entries.length, 0, 'sin otro humano no hay puntos');
    assert.equal(board.me, null);
  });

  it('una partida completa de El Cagao solo contra bots tampoco da puntos', async () => {
    const store = new MemoryStore();
    await playSoloCagao(store, A);
    const season = seasonId(new Date());
    const board = await okData(store, { action: 'ranking', season, ...A });
    if (board.kind !== 'ranking') throw new Error('tipo inesperado');
    assert.equal(board.entries.length, 0, 'sin otro humano no hay puntos');
    assert.equal(board.me, null);
  });

  it('la tabla por modo solo muestra ese juego y Todos suma todos', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await makeProfile(store, B, 'Beto');
    const season = seasonId(new Date());
    await store.awardRanking('seed:2', season, 'casino', [
      { playerId: A.playerId, name: 'Ana', points: 100, outcome: 'win' },
      { playerId: B.playerId, name: 'Beto', points: 0, outcome: 'loss' },
    ]);
    const casino = await okData(store, { action: 'ranking', season, game: 'casino', ...A });
    const tresydos = await okData(store, { action: 'ranking', season, game: 'tresydos', ...A });
    const all = await okData(store, { action: 'ranking', season, ...A });
    const invalid = await okData(store, { action: 'ranking', season, game: 'noexiste' as unknown as 'casino', ...A });
    if (casino.kind !== 'ranking' || tresydos.kind !== 'ranking' || all.kind !== 'ranking' || invalid.kind !== 'ranking') {
      throw new Error('tipo inesperado');
    }
    assert.equal(casino.entries.length, 2, 'Ana y Beto jugaron Casino');
    assert.equal(tresydos.entries.length, 0, 'nadie jugó Tres y Dos');
    assert.equal(all.entries.length, 2, 'Todos suma todos los modos');
    assert.equal(all.entries[0].points, casino.entries[0].points);
    assert.equal(invalid.entries.length, 2, 'un juego inválido cae a Todos');
    assert.equal(casino.me?.rank, 1);
    assert.equal(tresydos.me, null, 'sin jugar ese modo no hay fila propia');
  });

  it('premiar dos veces la misma partida no suma: la revancha sí es otra partida', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const season = seasonId(new Date());
    const results = [{ playerId: A.playerId, name: 'Ana', points: 100, outcome: 'win' as const }];
    assert.equal(await store.awardRanking('sala-1:7', season, 'casino', results), true);
    assert.equal(await store.awardRanking('sala-1:7', season, 'casino', results), false);
    const board = await okData(store, { action: 'ranking', season, ...A });
    if (board.kind !== 'ranking') throw new Error('tipo inesperado');
    assert.equal(board.entries[0].points, 100);
    assert.equal(board.entries[0].matches, 1);
    // La revancha (otra versión) sí premia.
    assert.equal(await store.awardRanking('sala-1:9', season, 'casino', results), true);
    const after = await okData(store, { action: 'ranking', season, ...A });
    if (after.kind !== 'ranking') throw new Error('tipo inesperado');
    assert.equal(after.entries[0].points, 200);
    assert.equal(after.entries[0].matches, 2);
  });

  it('el torneo solo premia en su ventana y con su juego', async () => {
    // Sábado 28 de noviembre de 2026: torneo de Casino activo.
    const casinoSaturday = Date.UTC(2026, 10, 28, 12);
    await withFixedNow(casinoSaturday, async () => {
      const store = new MemoryStore();
      const { winnerTeam } = await playDuoCasino(store);
      const board = await okData(store, { action: 'tournament', ...A });
      assert.equal(board.kind, 'tournament');
      if (board.kind !== 'tournament') throw new Error('tipo inesperado');
      assert.equal(board.tournament.id, '2026-11-28-casino');
      assert.equal(board.tournament.status, 'active');
      assert.equal(board.next.id, '2026-12-05-tresydos');
      assert.equal(board.next.status, 'upcoming');
      assert.equal(board.entries.length, 2, 'los dos humanos suman puntos de torneo');
      assert.equal(board.me?.points, winnerTeam === 0 ? 100 : 0);
    });

    // Miércoles 2 de diciembre: fuera de ventana, no hay puntos de torneo.
    await withFixedNow(Date.UTC(2026, 11, 2, 12), async () => {
      const store = new MemoryStore();
      await playDuoCasino(store);
      const board = await okData(store, { action: 'tournament', ...A });
      if (board.kind !== 'tournament') throw new Error('tipo inesperado');
      assert.equal(board.tournament.id, '2026-11-28-casino');
      assert.equal(board.tournament.status, 'finished');
      assert.deepEqual(board.entries, []);
      assert.equal(board.me, null);
      // El ranking sí premió (temporada de diciembre).
      const ranking = await okData(store, { action: 'ranking', season: '2026-12', ...A });
      if (ranking.kind !== 'ranking') throw new Error('tipo inesperado');
      assert.equal(ranking.entries[0].matches, 1);
    });

    // Sábado 5 de diciembre: torneo de Tres y Dos; una partida de Casino no suma.
    await withFixedNow(Date.UTC(2026, 11, 5, 12), async () => {
      const store = new MemoryStore();
      await playDuoCasino(store);
      const board = await okData(store, { action: 'tournament', ...A });
      if (board.kind !== 'tournament') throw new Error('tipo inesperado');
      assert.equal(board.tournament.id, '2026-12-05-tresydos');
      assert.equal(board.tournament.status, 'active');
      assert.deepEqual(board.entries, []);
    });
  });
});

describe('ranking en el servidor: premios', () => {
  async function seedPlayers(store: MemoryStore) {
    await makeProfile(store, A, 'Ana');
    await makeProfile(store, B, 'Beto');
    await makeProfile(store, C, 'Carla');
    await makeProfile(store, D, 'Diego');
  }

  it('el podio de la temporada pasada se reclama una sola vez', async () => {
    const store = new MemoryStore();
    await seedPlayers(store);
    const season = previousSeasonId(new Date());
    await store.awardRanking('seed:1', season, 'casino', [
      { playerId: A.playerId, name: 'Ana', points: 300, outcome: 'win' },
      { playerId: B.playerId, name: 'Beto', points: 200, outcome: 'win' },
      { playerId: C.playerId, name: 'Carla', points: 100, outcome: 'win' },
      { playerId: D.playerId, name: 'Diego', points: 50, outcome: 'win' },
    ]);
    const ana = await okData(store, { action: 'season_claim', ...A });
    assert.deepEqual(ana, { kind: 'claim', scope: 'season', ref: season, coins: 500, place: 1 });
    assert.match(await fail(store, { action: 'season_claim', ...A }), /Ya reclamaste/);
    const beto = await okData(store, { action: 'season_claim', ...B });
    assert.deepEqual(beto, { kind: 'claim', scope: 'season', ref: season, coins: 300, place: 2 });
    assert.match(await fail(store, { action: 'season_claim', ...D }), /3 primeros/);
  });

  it('el podio del último torneo terminado se reclama una sola vez', async () => {
    const store = new MemoryStore();
    await seedPlayers(store);
    const finished = lastFinishedTournament(new Date());
    await store.awardTournament('seed:1', finished.id, [
      { playerId: A.playerId, name: 'Ana', points: 300, outcome: 'win' },
      { playerId: B.playerId, name: 'Beto', points: 200, outcome: 'win' },
      { playerId: C.playerId, name: 'Carla', points: 100, outcome: 'win' },
    ]);
    const ana = await okData(store, { action: 'tournament_claim', ...A });
    assert.deepEqual(ana, { kind: 'claim', scope: 'tournament', ref: finished.id, coins: 500, place: 1 });
    assert.match(await fail(store, { action: 'tournament_claim', ...A }), /Ya reclamaste/);
    const carla = await okData(store, { action: 'tournament_claim', ...C });
    assert.deepEqual(carla, { kind: 'claim', scope: 'tournament', ref: finished.id, coins: 150, place: 3 });
  });

  it('sin podio no hay nada que reclamar', async () => {
    const store = new MemoryStore();
    await seedPlayers(store);
    assert.match(await fail(store, { action: 'season_claim', ...A }), /3 primeros/);
    assert.match(await fail(store, { action: 'tournament_claim', ...A }), /3 primeros/);
  });
});
