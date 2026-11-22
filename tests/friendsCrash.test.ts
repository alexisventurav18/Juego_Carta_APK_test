import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Crash de Amigos (2026-11-22): tras una partida online, abrir Amigos
 * dejaba la app en blanco. Causa: la Edge Function devuelve las acciones
 * de datos envueltas en { ok: true, data: {...} } y el cliente devolvía el
 * sobre tal cual, así que el modal leía data.friends sobre undefined y
 * rompía al renderizar. Estas pruebas ejercen el cliente real (rooms.ts)
 * con el fetch stubbeado y el sobre exacto del servidor.
 */

// El sobre tal como lo devuelve la Edge Function `rooms` desplegada.
function envelope(action: string, data: unknown) {
  return { ok: true, data: { kind: action, ...(data as Record<string, unknown>) } };
}

let stub: ((body: Record<string, unknown>) => unknown) | null = null;
let friendsList: typeof import('../src/lib/rooms').friendsList;
let friendSearch: typeof import('../src/lib/rooms').friendSearch;
let rankingBoard: typeof import('../src/lib/rooms').rankingBoard;
let tournamentInfo: typeof import('../src/lib/rooms').tournamentInfo;

// El stub de fetch va ANTES de importar rooms.ts: el cliente de Supabase
// captura el fetch global al construirse (en la importación del módulo).
before(async () => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
    url: unknown,
    init?: { body?: unknown },
  ) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    const payload = stub ? stub(body) : { ok: false, error: 'sin stub' };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  ({ friendsList, friendSearch, rankingBoard, tournamentInfo } = await import('../src/lib/rooms'));
});

const FRIENDS_DATA = {
  myCode: 'K7Q2X9',
  friends: [
    { playerId: 'a1', name: 'Ana', avatar: 'M0.1.2.1.2.3.4.5.6.0.1.2.3', level: 12, online: true, inRoom: null },
    { playerId: 'b2', name: 'Beto', level: 3, online: false, inRoom: 'SALA9' },
  ],
  pendingIn: [{ playerId: 'c3', name: 'Carla', level: 7 }],
  pendingOut: [],
  invites: [{ from: 'a1', fromName: 'Ana', code: 'AB12CD', game: 'casino', createdAt: 1 }],
};

describe('crash de Amigos: el cliente desenvuelve la respuesta del servidor', () => {
  it('friendsList() devuelve la lista pelada, no el sobre { ok, data }', async () => {
    stub = (body) => (body.action === 'friends_list' ? envelope('friends', FRIENDS_DATA) : { ok: false, error: 'sin stub' });
    const list = await friendsList();
    assert.equal(list.myCode, 'K7Q2X9', 'friendsList: mi código llega al modal');
    assert.equal(list.friends.length, 2, 'friendsList: los amigos llegan como array');
    assert.equal(list.friends[0]?.name, 'Ana', 'friendsList: el primer amigo es Ana');
    assert.equal(list.pendingIn.length, 1, 'friendsList: las solicitudes llegan');
    assert.equal(list.invites.length, 1, 'friendsList: las invitaciones llegan');
  });

  it('friendsList() normaliza datos rotos: sin arrays no hay `.length` que rompa', async () => {
    stub = () =>
      envelope('friends', {
        myCode: null,
        friends: [null, { playerId: 'a1', name: '', online: true, inRoom: 'SALA9' }, { name: 'SinId' }],
        pendingIn: null,
        pendingOut: undefined,
        invites: [{ code: 'AB12CD' }],
      });
    const list = await friendsList();
    assert.equal(list.myCode, '', 'friendsList: sin código no se muestra basura');
    assert.equal(list.friends.length, 1, 'friendsList: se descartan las filas sin playerId');
    assert.equal(list.friends[0]?.name, 'Jugador', 'friendsList: sin nombre se muestra Jugador');
    assert.equal(list.friends[0]?.inRoom, true, 'friendsList: el código de sala en inRoom se lee como en partida');
    assert.deepEqual(list.pendingIn, [], 'friendsList: solicitudes nulas son lista vacía');
    assert.deepEqual(list.pendingOut, [], 'friendsList: solicitudes nulas son lista vacía');
    assert.deepEqual(list.invites, [], 'friendsList: invitaciones sin remitente se descartan');
  });

  it('friendSearch() devuelve jugadores como array aunque el sobre venga vacío', async () => {
    stub = (body) =>
      body.action === 'friend_search'
        ? envelope('friendSearch', { players: [{ playerId: 'a1', name: 'Ana', code: 'K7Q2X9' }] })
        : { ok: false, error: 'sin stub' };
    const res = await friendSearch('Ana');
    assert.equal(res.players.length, 1, 'friendSearch: los jugadores llegan');
    stub = () => envelope('friendSearch', { players: null });
    assert.deepEqual((await friendSearch('Ana')).players, [], 'friendSearch: sin jugadores es lista vacía');
  });

  it('el mismo arreglo cura el Ranking y el Torneo, que leían el sobre igual', async () => {
    stub = (body) =>
      body.action === 'ranking'
        ? envelope('ranking', { season: '2026-11', entries: [{ playerId: 'a1', name: 'Ana', points: 100, wins: 1, losses: 0, matches: 1 }], me: null })
        : body.action === 'tournament'
          ? envelope('tournament', { tournament: { id: 't1', game: 'casino', startsAt: 1, endsAt: 2, status: 'active' }, entries: [], me: null })
          : { ok: false, error: 'sin stub' };
    const board = await rankingBoard();
    assert.equal(board.season, '2026-11', 'rankingBoard: la temporada llega pelada');
    assert.equal(board.entries.length, 1, 'rankingBoard: las entradas llegan como array');
    const info = await tournamentInfo();
    assert.equal(info.tournament?.id, 't1', 'tournamentInfo: el torneo llega pelado');
  });

  it('un rechazo del servidor sigue siendo error, no lista vacía silenciosa', async () => {
    stub = () => ({ ok: false, error: 'Aún no tienes perfil.' });
    await assert.rejects(() => friendsList(), /Aún no tienes perfil/, 'friendsList: el error del servidor se muestra');
  });
});

describe('crash de Amigos: el modal no vuelve a romperse', () => {
  it('callRaw desenvuelve `data` en rooms.ts (causa raíz)', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(
      rooms.includes('return response.data ?? response;'),
      'rooms: callRaw debe devolver la carga pelada, no el sobre { ok, data }',
    );
  });

  it('el error al cargar Amigos tiene botón Reintentar', () => {
    const modal = read('src/components/FriendsModal.tsx');
    assert.ok(modal.includes('Reintentar'), 'FriendsModal: el error tiene botón Reintentar');
    assert.ok(modal.includes('onClick={load}'), 'FriendsModal: Reintentar vuelve a cargar la lista');
  });

  it('el chip de mi código solo se muestra si hay código', () => {
    const modal = read('src/components/FriendsModal.tsx');
    assert.ok(modal.includes('data.myCode &&'), 'FriendsModal: sin código no se pinta el chip vacío');
  });
});
