import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Invitar a un amigo eligiendo el modo (punto 6b): el cliente pasa el juego
 * elegido a `invite_friend` y el modal ofrece los 4 modos por amigo.
 *
 * El servidor se simula a nivel de fetch: supabase.functions.invoke usa el
 * fetch global, así que el stub captura el cuerpo que se envía y devuelve
 * una invitación válida. El stub se instala antes de importar rooms.ts.
 */
const seenBodies: Record<string, unknown>[] = [];
(globalThis as unknown as { fetch: unknown }).fetch = async (_url: unknown, init?: { body?: unknown }) => {
  seenBodies.push(JSON.parse(String(init?.body ?? '{}')));
  return new Response(JSON.stringify({ ok: true, data: { kind: 'invite', code: 'ABC12', game: 'casino' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

let roomsModule: typeof import('../src/lib/rooms') | undefined;
async function loadRooms(): Promise<typeof import('../src/lib/rooms')> {
  roomsModule ??= await import('../src/lib/rooms');
  return roomsModule;
}

describe('inviteFriend: el modo elegido llega a la acción invite_friend', () => {
  it('envía game cuando se elige un modo', async () => {
    const rooms = await loadRooms();
    seenBodies.length = 0;
    const res = await rooms.inviteFriend('friend-1', 'cagao');
    assert.equal(res.code, 'ABC12');
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0]?.action, 'invite_friend');
    assert.equal(seenBodies[0]?.friendId, 'friend-1');
    assert.equal(seenBodies[0]?.game, 'cagao');
  });

  it('envía game para cada uno de los 4 modos', async () => {
    const rooms = await loadRooms();
    for (const game of ['casino', 'tresydos', 'cagao', 'robaito'] as const) {
      seenBodies.length = 0;
      await rooms.inviteFriend('friend-1', game);
      assert.equal(seenBodies[0]?.game, game, `inviteFriend debe enviar game: '${game}'`);
    }
  });

  it('sin modo no envía game: el servidor crea la sala en Casino por defecto', async () => {
    const rooms = await loadRooms();
    seenBodies.length = 0;
    await rooms.inviteFriend('friend-1');
    assert.equal(seenBodies[0]?.action, 'invite_friend');
    assert.equal(seenBodies[0]?.friendId, 'friend-1');
    assert.ok(!('game' in (seenBodies[0] ?? {})), 'sin modo no se envía game');
  });

  it('la firma acepta el modo como segundo parámetro opcional', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(
      rooms.includes('export function inviteFriend(friendId: string, game?: GameId)'),
      'rooms: inviteFriend(friendId, game?)',
    );
    assert.ok(rooms.includes('...(game ? { game } : {})'), 'rooms: el game viaja en el cuerpo solo si se pasa');
  });
});

describe('inviteFriend: el servidor acepta el modo (contrato)', () => {
  it('roomService acepta game? en invite_friend y crea la sala en ese modo', () => {
    const service = read('src/games/roomService.ts');
    assert.ok(
      service.includes("({ action: 'invite_friend'; friendId: string; game?: GameId } & Auth)"),
      'roomService: invite_friend acepta game?',
    );
    assert.ok(
      service.includes("typeof req.game === 'string' && req.game in GAMES"),
      'roomService: valida el modo pedido',
    );
    assert.ok(service.includes('createInvite(auth.playerId, friendId, stored.room.code, game)'), 'roomService: la invitación guarda el modo');
  });
});

describe('FriendsModal: búsqueda arriba y selector de modo al invitar', () => {
  const modal = read('src/components/FriendsModal.tsx');

  it('la búsqueda es la primera sección del modal, antes que invitaciones y solicitudes', () => {
    const searchAt = modal.indexOf('Buscar amigos');
    assert.ok(searchAt > 0, 'FriendsModal: existe la sección Buscar amigos');
    for (const section of ['Invitaciones a salas', 'Solicitudes entrantes', 'Solicitudes enviadas', 'Mis amigos']) {
      const at = modal.indexOf(section);
      assert.ok(at > searchAt, `FriendsModal: "Buscar amigos" va antes que "${section}"`);
    }
  });

  it('cada resultado trae un botón claro "Enviar solicitud"', () => {
    assert.ok(modal.includes('Enviar solicitud'), 'FriendsModal: botón "Enviar solicitud" en los resultados');
    assert.ok(!modal.includes('Añadir'), 'FriendsModal: ya no queda el botón "Añadir"');
    assert.ok(modal.includes('friendRequest(player.playerId)'), 'FriendsModal: Enviar solicitud llama a friendRequest');
  });

  it('invitar a un amigo abre un selector con los 4 modos', () => {
    assert.ok(modal.includes("const INVITE_GAMES: GameId[] = ['casino', 'tresydos', 'cagao', 'robaito']"), 'FriendsModal: los 4 modos en orden');
    assert.ok(modal.includes('inviteFor === friend.playerId'), 'FriendsModal: el selector se abre por amigo');
    assert.ok(modal.includes('¿A qué quieres jugar con'), 'FriendsModal: el selector pregunta a qué jugar');
    assert.ok(modal.includes('{GAMES[game].name}'), 'FriendsModal: cada modo se muestra con su nombre');
    assert.ok(modal.includes('Cancelar'), 'FriendsModal: el selector se puede cerrar');
  });

  it('el modo elegido se pasa a inviteFriend y se entra a la sala creada', () => {
    assert.ok(modal.includes('invite(friend, game)'), 'FriendsModal: tocar un modo invita con ese modo');
    assert.ok(modal.includes('inviteFriend(friend.playerId, game)'), 'FriendsModal: inviteFriend recibe el modo');
    assert.ok(modal.includes('onJoinRoom(res.code)'), 'FriendsModal: tras invitar, entro a la sala creada');
  });
});
