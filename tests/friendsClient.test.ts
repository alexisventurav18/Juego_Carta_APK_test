import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Amigos (cliente): las llamadas al servidor usan los nombres y formas del
 * contrato, el modal cubre buscar, solicitudes, invitaciones y lista de
 * amigos, y el menú muestra la insignia de pendientes.
 */
describe('amigos (cliente): llamadas al servidor', () => {
  it('rooms.ts pide la lista con "friends_list" y trae código, amigos, solicitudes e invitaciones', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'friends_list'"), 'rooms: la acción debe ser "friends_list"');
    assert.ok(rooms.includes('export async function friendsList'), 'rooms: debe existir friendsList()');
    assert.ok(rooms.includes('myCode: string'), 'rooms: la lista trae mi código de amigo');
    assert.ok(rooms.includes('friends: FriendEntry[]'), 'rooms: la lista trae los amigos');
    assert.ok(rooms.includes('pendingIn: FriendRequestEntry[]'), 'rooms: la lista trae solicitudes entrantes');
    assert.ok(rooms.includes('pendingOut: FriendRequestEntry[]'), 'rooms: la lista trae solicitudes salientes');
    assert.ok(rooms.includes('invites: FriendInvite[]'), 'rooms: la lista trae invitaciones a salas');
    assert.ok(rooms.includes('online: boolean'), 'rooms: cada amigo trae si está en línea');
    assert.ok(rooms.includes('inRoom: boolean'), 'rooms: cada amigo trae si está en partida');
  });

  it('rooms.ts busca por nombre o código con "friend_search"', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'friend_search'"), 'rooms: la acción debe ser "friend_search"');
    assert.ok(rooms.includes('export async function friendSearch(query: string)'), 'rooms: debe existir friendSearch(query)');
    assert.ok(rooms.includes("query }"), 'rooms: la búsqueda envía el texto');
    assert.ok(rooms.includes('players: FriendSearchResult[]'), 'rooms: la búsqueda trae jugadores');
  });

  it('rooms.ts cubre solicitar, aceptar, rechazar y eliminar con los nombres del contrato', () => {
    const rooms = read('src/lib/rooms.ts');
    for (const [fn, action, field] of [
      ['friendRequest', 'friend_request', 'targetId'],
      ['friendAccept', 'friend_accept', 'requesterId'],
      ['friendReject', 'friend_reject', 'requesterId'],
      ['friendRemove', 'friend_remove', 'friendId'],
    ] as const) {
      assert.ok(rooms.includes(`export function ${fn}`), `rooms: debe existir ${fn}()`);
      assert.ok(rooms.includes(`action: '${action}'`), `rooms: la acción de ${fn} debe ser "${action}"`);
      assert.ok(rooms.includes(field), `rooms: ${fn} envía ${field}`);
    }
  });

  it('rooms.ts invita con "invite_friend" y el servidor devuelve el código de la sala privada', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'invite_friend'"), 'rooms: la acción debe ser "invite_friend"');
    assert.ok(rooms.includes('export function inviteFriend'), 'rooms: debe existir inviteFriend()');
    assert.ok(rooms.includes('code: string; game: GameId'), 'rooms: la invitación trae código y modo');
  });
});

describe('amigos (cliente): el modal cubre todo el flujo', () => {
  it('el modal tiene buscar, solicitudes, invitaciones y lista de amigos', () => {
    const modal = read('src/components/FriendsModal.tsx');
    for (const section of ['Buscar amigos', 'Solicitudes entrantes', 'Solicitudes enviadas', 'Mis amigos', 'Invitaciones a salas']) {
      assert.ok(modal.includes(section), `FriendsModal: falta la sección "${section}"`);
    }
    assert.ok(modal.includes('Mi código:'), 'FriendsModal: muestra mi código de amigo');
    assert.ok(modal.includes('friendSearch('), 'FriendsModal: la búsqueda llama al servidor');
    assert.ok(modal.includes('friendAccept('), 'FriendsModal: aceptar llama al servidor');
    assert.ok(modal.includes('friendReject('), 'FriendsModal: rechazar llama al servidor');
    assert.ok(modal.includes('friendRemove('), 'FriendsModal: eliminar llama al servidor');
    assert.ok(modal.includes('friendRequest('), 'FriendsModal: añadir llama al servidor');
  });

  it('el modal muestra nivel, en línea y en partida, e invita con el botón Invitar', () => {
    const modal = read('src/components/FriendsModal.tsx');
    assert.ok(modal.includes('en línea'), 'FriendsModal: marca quién está en línea');
    assert.ok(modal.includes('en partida'), 'FriendsModal: marca quién está en partida');
    assert.ok(modal.includes('Invitar'), 'FriendsModal: botón Invitar');
    assert.ok(modal.includes('inviteFriend('), 'FriendsModal: invitar llama al servidor');
    assert.ok(modal.includes('onJoinRoom(res.code)'), 'FriendsModal: tras invitar, entro a la sala creada');
  });

  it('las invitaciones recibidas tienen botón Unirse que entra por código', () => {
    const modal = read('src/components/FriendsModal.tsx');
    assert.ok(modal.includes('Unirse'), 'FriendsModal: botón Unirse en las invitaciones');
    assert.ok(modal.includes('onJoinRoom(invite.code)'), 'FriendsModal: Unirse entra con el código de la invitación');
  });
});

describe('amigos (cliente): botón en el menú con insignia', () => {
  it('el menú tiene un botón Amigos con insignia de pendientes', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(lobby.includes('Amigos'), 'Lobby: botón Amigos');
    assert.ok(lobby.includes('friendsBadge'), 'Lobby: la insignia viene de friendsBadge');
    assert.ok(lobby.includes('list.pendingIn.length + list.invites.length'), 'Lobby: la insignia cuenta solicitudes + invitaciones');
    assert.ok(lobby.includes('friendsBadge > 0'), 'Lobby: la etiqueta del botón Amigos cambia si hay avisos');
    assert.ok(lobby.includes('avisos pendientes'), 'Lobby: la etiqueta del botón Amigos dice cuántos avisos hay');
    assert.ok(lobby.includes('<FriendsModal'), 'Lobby: abre FriendsModal');
    assert.ok(lobby.includes('onJoinRoom={joinByCode}'), 'Lobby: el modal entra a salas con joinByCode');
    assert.ok(lobby.includes("joinRoom(roomCode.trim().toUpperCase(), player)"), 'Lobby: joinByCode entra por código');
  });
});
