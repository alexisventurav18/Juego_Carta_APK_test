import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La sala online no se puede renderizar en Node: su cadena de imports usa
// el alias `@/` y el runner tsx no lo resuelve. Se comprueba el cableado en
// el código fuente, como hace lobbyWeb.test.ts.
const roomView = readFileSync('src/components/RoomView.tsx', 'utf8');
const rooms = readFileSync('src/lib/rooms.ts', 'utf8');
const roomRematch = readFileSync('src/lib/roomRematch.ts', 'utf8');
const casinoTable = readFileSync('src/components/CasinoTable.tsx', 'utf8');
const tresYDosTable = readFileSync('src/components/TresYDosTable.tsx', 'utf8');
const cagaoTable = readFileSync('src/components/cagao/GameTable.tsx', 'utf8');
const robaitoTable = readFileSync('src/components/robaito/RobaitoTable.tsx', 'utf8');

/**
 * Revancha online: al terminar una partida online, cada humano ve
 * "Revancha" en la pantalla de victoria/derrota; quien la toca crea la sala
 * nueva y los demás reciben el aviso con "Unirse a la revancha".
 */
describe('revancha online: botón en el fin de partida', () => {
  it('RoomView pasa onRematch a las mesas (el botón vive en el aviso de fin de partida)', () => {
    assert.ok(roomView.includes('onRematch: handleRematch'), 'onRematch cableado en tableProps');
  });

  it('las 4 mesas reenvían onRematch al aviso de victoria/derrota', () => {
    for (const [name, source] of [
      ['Casino', casinoTable],
      ['Tres y Dos', tresYDosTable],
      ['El Cagao', cagaoTable],
      ['El Robaíto', robaitoTable],
    ] as const) {
      assert.ok(source.includes('onRematch={onRematch}'), `${name} reenvía onRematch`);
    }
  });

  it('pedir la revancha exige partida terminada (no se puede pedir a mitad de partida)', () => {
    assert.ok(
      roomView.includes("if (!state || !isGameFinished(state) || rematchBusyRef.current) return;"),
      'handleRematch se guarda en partida terminada',
    );
  });

  it('el botón "Jugar otra partida" del anfitrión sigue existiendo (sin regresión)', () => {
    assert.ok(roomView.includes('Jugar otra partida'), 'resultFooter intacto');
  });
});

describe('revancha online: aviso a los demás', () => {
  it('la invitación viaja por Broadcast en el canal de la sala (mismo mecanismo que el chat)', () => {
    assert.ok(roomRematch.includes("ROOM_REMATCH_INVITE_EVENT = 'rematch_invite'"), 'evento de revancha');
    assert.ok(rooms.includes("ROOM_REMATCH_INVITE_EVENT"), 'rooms escucha el evento de revancha');
    assert.ok(rooms.includes('sendRematchInvite'), 'la suscripción expone sendRematchInvite');
  });

  it('RoomView suscribe el aviso de revancha junto al chat', () => {
    assert.ok(roomView.includes('handleRematchInvite,'), 'onRematchInvite en subscribeToRoom');
    assert.ok(roomView.includes('const handleRematchInvite = useCallback'), 'manejador del aviso');
  });

  it('el aviso solo vale en el fin de partida y de un humano de la sala', () => {
    assert.ok(
      roomView.includes("if (!current || !current.state || !isGameFinished(current.state)) return;"),
      'el aviso se ignora si la partida no terminó',
    );
    assert.ok(
      roomView.includes('isAllowedRematchSender(invite, current.players)'),
      'el aviso se ignora si el remitente no es humano de la sala',
    );
  });

  it('el aviso dura lo que tarda la sala nueva en arrancar sola (~30 s)', () => {
    assert.ok(roomRematch.includes('REMATCH_INVITE_MS = 40_000'), 'el aviso dura 40 s');
    assert.ok(roomView.includes('REMATCH_INVITE_MS'), 'RoomView usa ese plazo');
  });
});

describe('revancha online: unirse con un toque', () => {
  it('el aviso trae "Unirse a la revancha" y "Descartar"', () => {
    assert.ok(roomView.includes('Unirse a la revancha'), 'botón de unirse');
    assert.ok(roomView.includes('Descartar'), 'botón de descartar');
  });

  it('el aviso solo se muestra en el fin de partida', () => {
    assert.ok(
      roomView.includes('{state && isGameFinished(state) && rematchInvite && ('),
      'el aviso está condicionado al fin de partida',
    );
  });

  it('unirse entra por código con el mismo jugador y cambia a la sala nueva', () => {
    assert.ok(roomView.includes('joinRoom(rematchInvite.code, oldRoom.players[seat])'), 'join por código');
    assert.ok(roomView.includes('switchRoom(next)'), 'cambio a la sala nueva');
  });

  it('la sala nueva queda guardada para reanudarla si se recarga la app', () => {
    assert.ok(roomView.includes('storeRoomId(row.id)'), 'switchRoom guarda la sala nueva');
  });
});

describe('revancha online: cambio de sala sin romper la sala vieja', () => {
  it('la sala vieja se abandona DESPUÉS de cambiar a la nueva', () => {
    // Si se abandonara antes, el sondeo de la sala vieja vería la clave
    // borrada y enseñaría el error fatal "No estás en esta sala.".
    const switchAt = roomView.indexOf('switchRoom(next);', roomView.indexOf('const handleRematch'));
    const abandonAt = roomView.indexOf('abandonRoom(oldRoom.id)', roomView.indexOf('const handleRematch'));
    assert.ok(switchAt !== -1 && abandonAt !== -1, 'cambio y abandono existen');
    assert.ok(switchAt < abandonAt, 'primero se cambia de sala, luego se abandona la vieja');
  });

  it('si la revancha falla, no se abandona nada y se enseña el error', () => {
    assert.ok(roomView.includes('if (!switched) {'), 'la revancha fallida no abandona');
    assert.ok(roomView.includes('setNotice(errorMessage(err))'), 'el error se enseña en un aviso');
  });

  it('el cliente pide la revancha con la acción nueva del servidor', () => {
    assert.ok(rooms.includes("export function requestRematch"), 'requestRematch existe');
    assert.ok(rooms.includes("action: 'rematch'"), 'usa la acción rematch');
  });

  it('App.tsx no se toca: el cambio de sala es interno a RoomView', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    assert.ok(!app.includes('rematch'), 'App.tsx no menciona la revancha');
    assert.ok(!app.includes('Rematch'), 'App.tsx no menciona la revancha');
  });
});
