import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Torneos (cliente): la información viene del servidor (el cliente no calcula
 * rotaciones), el modal muestra cuenta atrás, top 10 y reclamo del podio, y
 * "Jugar torneo" entra al matchmaking del modo del torneo.
 */
describe('torneos (cliente): llamadas al servidor', () => {
  it('rooms.ts pide el torneo con "tournament" y trae modo, fechas, estado, top 10 y mi fila', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'tournament'"), 'rooms: la acción debe ser "tournament"');
    assert.ok(rooms.includes('export function tournamentInfo'), 'rooms: debe existir tournamentInfo()');
    assert.ok(rooms.includes('startsAt: number'), 'rooms: el torneo trae cuándo empieza');
    assert.ok(rooms.includes('endsAt: number'), 'rooms: el torneo trae cuándo termina');
    assert.ok(rooms.includes("status: TournamentStatus"), 'rooms: el torneo trae su estado');
    assert.ok(rooms.includes('entries: TournamentEntry[]'), 'rooms: el torneo trae el top 10');
    assert.ok(rooms.includes('me: TournamentEntry | null'), 'rooms: el torneo trae mi fila');
    assert.ok(rooms.includes("type TournamentStatus = 'upcoming' | 'active' | 'ended'"), 'rooms: los estados son próximo, activo y terminado');
  });

  it('rooms.ts reclama el premio del torneo con "tournament_claim"', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'tournament_claim'"), 'rooms: la acción debe ser "tournament_claim"');
    assert.ok(rooms.includes('export function tournamentClaim'), 'rooms: debe existir tournamentClaim()');
  });

  it('el cliente no calcula rotaciones ni clasificaciones de torneos', () => {
    const rooms = read('src/lib/rooms.ts');
    const modal = read('src/components/TournamentModal.tsx');
    assert.ok(!rooms.includes('nextTournament'), 'rooms: sin cálculo de rotación en el cliente');
    assert.ok(modal.includes('tournamentInfo()'), 'TournamentModal: todo viene de tournamentInfo()');
    assert.ok(!modal.includes('new Date('), 'TournamentModal: sin fechas inventadas en el cliente');
  });
});

describe('torneos (cliente): el modal y el botón de jugar', () => {
  it('el modal muestra cuenta atrás, premios del podio y clasificación', () => {
    const modal = read('src/components/TournamentModal.tsx');
    assert.ok(modal.includes('formatCountdown('), 'TournamentModal: la cuenta atrás usa formatCountdown');
    assert.ok(modal.includes('TOURNAMENT_PRIZES'), 'TournamentModal: muestra los premios del podio');
    assert.ok(modal.includes('Clasificación'), 'TournamentModal: sección de clasificación');
    assert.ok(modal.includes('Tú'), 'TournamentModal: mi fila lleva la marca "Tú"');
    assert.ok(modal.includes('Reclamar premio'), 'TournamentModal: botón de reclamo del podio');
    assert.ok(modal.includes('tournamentClaim()'), 'TournamentModal: el reclamo llama a tournamentClaim()');
    assert.ok(modal.includes("claimPrize(`tournament:"), 'TournamentModal: el premio se suma con clave del torneo');
  });

  it('"Jugar torneo" lanza el matchmaking en el modo del torneo', () => {
    const modal = read('src/components/TournamentModal.tsx');
    assert.ok(modal.includes('Jugar torneo'), 'TournamentModal: botón "Jugar torneo"');
    assert.ok(modal.includes('onPlayTournament(tournament.game)'), 'TournamentModal: juega en el modo del torneo');
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(lobby.includes('onPlayTournament={playTournament}'), 'Lobby: el modal juega con playTournament');
    assert.ok(
      lobby.includes('quickplayRoom(tournamentGame, player)'),
      'Lobby: "Jugar torneo" usa quickplay del modo del torneo',
    );
    assert.ok(lobby.includes('setGame(tournamentGame)'), 'Lobby: el menú cambia al modo del torneo');
  });
});

describe('torneos (cliente): tarjeta en el menú', () => {
  it('el menú muestra la tarjeta del torneo con modo, cuenta atrás y mis puntos', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(lobby.includes('tournamentBanner'), 'Lobby: la tarjeta del torneo es tournamentBanner');
    assert.ok(lobby.includes('setTournamentOpen(true)'), 'Lobby: la tarjeta abre el modal del torneo');
    assert.ok(lobby.includes('tus puntos:'), 'Lobby: la tarjeta muestra mis puntos en el torneo');
    assert.ok(lobby.includes('empieza en'), 'Lobby: la tarjeta dice cuándo empieza el torneo próximo');
    assert.ok(lobby.includes('termina en'), 'Lobby: la tarjeta dice cuándo termina el torneo activo');
    assert.ok(lobby.includes('tournamentInfo()'), 'Lobby: el menú pide el torneo al entrar');
  });

  it('la tarjeta no aparece si no hay torneo y no rompe el menú sin conexión', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(lobby.includes('tournamentBanner && ('), 'Lobby: la tarjeta solo se muestra si hay torneo');
    assert.ok(lobby.includes('.catch(() => undefined);'), 'Lobby: si el torneo no carga, el menú sigue igual');
  });
});
