import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultEconomy, grantPrizeCoins } from '../src/lib/economy';
import { formatCountdown, prizeForPlace, RANKING_TABS, TOURNAMENT_PRIZES } from '../src/lib/tournament';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * Ranking (cliente): las llamadas al servidor usan los nombres y formas del
 * contrato, el modal tiene pestañas por modo y reclamo de temporada, y el
 * premio solo se suma una vez por respuesta del servidor.
 */
describe('ranking (cliente): llamadas al servidor', () => {
  it('rooms.ts pide el ranking con la acción "ranking" y devuelve temporada, entradas y mi fila', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'ranking'"), 'rooms: la acción del ranking debe ser "ranking"');
    assert.ok(rooms.includes('export function rankingBoard'), 'rooms: debe existir rankingBoard()');
    assert.ok(rooms.includes('season: string'), 'rooms: el ranking trae la temporada');
    assert.ok(rooms.includes('entries: RankingEntry[]'), 'rooms: el ranking trae las entradas');
    assert.ok(rooms.includes('me: RankingEntry | null'), 'rooms: el ranking trae mi fila');
    // Puntos por victoria: los pone el servidor; el cliente no calcula nada.
    assert.ok(!rooms.includes('WIN_REWARDS'), 'rooms: el ranking no calcula puntos en el cliente');
  });

  it('rooms.ts reclama la temporada pasada con "season_claim" y devuelve monedas y puesto', () => {
    const rooms = read('src/lib/rooms.ts');
    assert.ok(rooms.includes("action: 'season_claim'"), 'rooms: la acción debe ser "season_claim"');
    assert.ok(rooms.includes('export function seasonClaim'), 'rooms: debe existir seasonClaim()');
    assert.ok(rooms.includes('coins: number;\n  place: number;'), 'rooms: el reclamo trae monedas y puesto');
  });

  it('el modal del ranking tiene pestañas Todos + 4 modos', () => {
    assert.deepEqual(
      RANKING_TABS.map((tab) => tab.id),
      ['all', 'casino', 'tresydos', 'cagao', 'robaito'],
      'tournament: las pestañas del ranking son Todos + los 4 modos',
    );
    const modal = read('src/components/RankingModal.tsx');
    assert.ok(modal.includes('RANKING_TABS'), 'RankingModal: las pestañas vienen de RANKING_TABS');
    assert.ok(modal.includes("role=\"tablist\""), 'RankingModal: las pestañas son una tablist');
    assert.ok(modal.includes('rankingBoard(undefined, tab)'), 'RankingModal: cada pestaña pide su tabla al servidor');
  });

  it('el modal destaca mi fila y ofrece reclamar el premio de temporada', () => {
    const modal = read('src/components/RankingModal.tsx');
    assert.ok(modal.includes('Tú'), 'RankingModal: mi fila lleva la marca "Tú"');
    assert.ok(modal.includes('Reclamar premio de temporada'), 'RankingModal: botón de reclamo de temporada');
    assert.ok(modal.includes('seasonClaim()'), 'RankingModal: el reclamo llama a seasonClaim()');
    assert.ok(modal.includes("claimPrize(`season:"), 'RankingModal: el premio se suma con clave de temporada');
    assert.ok(modal.includes("playSound('coin')"), 'RankingModal: al reclamar suena la moneda');
  });
});

describe('premios: una sola vez por respuesta del servidor', () => {
  it('los premios del podio son 500, 300 y 150 monedas', () => {
    assert.deepEqual([...TOURNAMENT_PRIZES], [500, 300, 150], 'tournament: premios 500/300/150');
    assert.equal(prizeForPlace(1), 500, 'tournament: 1º gana 500');
    assert.equal(prizeForPlace(2), 300, 'tournament: 2º gana 300');
    assert.equal(prizeForPlace(3), 150, 'tournament: 3º gana 150');
    assert.equal(prizeForPlace(4), 0, 'tournament: fuera del podio no hay premio');
    assert.equal(prizeForPlace(0), 0, 'tournament: puesto inválido no paga');
  });

  it('grantPrizeCoins paga una vez por clave y no vuelve a pagar la misma', () => {
    const base = defaultEconomy();
    const first = grantPrizeCoins(base, 'season:2026-10', 500);
    assert.equal(first.granted, 500, 'economy: el primer reclamo paga 500');
    assert.equal(first.state.coins, 500, 'economy: las monedas se suman');
    const second = grantPrizeCoins(first.state, 'season:2026-10', 500);
    assert.equal(second.granted, 0, 'economy: el segundo reclamo de la misma clave no paga');
    assert.equal(second.state.coins, 500, 'economy: el saldo no cambia en el segundo reclamo');
    const other = grantPrizeCoins(first.state, 'tournament:abc', 300);
    assert.equal(other.granted, 300, 'economy: otra clave distinta sí paga');
    assert.equal(other.state.coins, 800, 'economy: 500 + 300');
    const zero = grantPrizeCoins(base, 'season:2026-10', 0);
    assert.equal(zero.granted, 0, 'economy: un premio de 0 no paga');
  });

  it('la cuenta atrás se lee sin hacer cuentas en la cabeza', () => {
    assert.equal(formatCountdown(2 * 86400_000 + 3 * 3600_000), '2d 3h', 'tournament: días y horas');
    assert.equal(formatCountdown(4 * 3600_000 + 12 * 60_000), '4h 12m', 'tournament: horas y minutos');
    assert.equal(formatCountdown(12 * 60_000 + 30_000), '12m 30s', 'tournament: minutos y segundos');
    assert.equal(formatCountdown(0), 'ahora', 'tournament: sin tiempo, "ahora"');
    assert.equal(formatCountdown(-1000), 'ahora', 'tournament: tiempo pasado, "ahora"');
  });
});

describe('ranking (cliente): botón en el menú', () => {
  it('el menú tiene un botón Ranking con trofeo y abre el modal', () => {
    const lobby = read('src/components/Lobby.tsx');
    assert.ok(lobby.includes('Ranking'), 'Lobby: botón Ranking');
    assert.ok(lobby.includes('aria-label="Ranking de la temporada"'), 'Lobby: el botón Ranking tiene su etiqueta');
    assert.ok(lobby.includes('<RankingModal onClose={() => setRankingOpen(false)} />'), 'Lobby: abre RankingModal');
    assert.ok(lobby.includes('import RankingModal from'), 'Lobby: importa RankingModal');
  });
});
