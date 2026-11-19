import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buyItem,
  claimDailyReward,
  defaultEconomy,
  DAILY_REWARD_COINS,
  humanOutcome,
  isOwned,
  loadEconomy,
  matchFingerprint,
  migrateEconomy,
  recordWin,
  SHOP_ITEMS,
  shopPrice,
  winRewardAmount,
} from '../src/lib/economy';
import { createGameState, createSoloPlayers, type GameState } from '../src/games';
import type { Player } from '../src/games/shared';

const PLAYERS: Player[] = [
  { id: 'yo', name: 'Yo' },
  { id: 'bot-1', name: 'Bot 1' },
  { id: 'bot-2', name: 'Bot 2' },
  { id: 'bot-3', name: 'Bot 3' },
];

function finished(game: Parameters<typeof createGameState>[0], patch: Record<string, unknown>): GameState {
  const state = createGameState(game, PLAYERS.slice(0, 4));
  return { ...state, phase: 'gameOver', ...patch } as GameState;
}

describe('economía: saldo inicial y catálogo', () => {
  it('empieza en 0 monedas con los temas gratuitos en propiedad', () => {
    const eco = defaultEconomy();
    assert.equal(eco.coins, 0);
    assert.equal(eco.wins, 0);
    assert.equal(eco.streak, 0);
    assert.ok(isOwned(eco, 'cardBack', 'cacao'));
    assert.ok(isOwned(eco, 'table', 'madera'));
    assert.ok(isOwned(eco, 'menu', 'madera'));
    assert.equal(isOwned(eco, 'cardBack', 'dominicano-bandera'), false);
  });

  it('el catálogo cubre los 6 dorsos, las 5 mesas y los 5 fondos, solo con arte existente', () => {
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'cardBack').length, 6);
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'table').length, 5);
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'menu').length, 5);
    assert.equal(shopPrice('cardBack', 'cacao'), 0);
    assert.equal(shopPrice('cardBack', 'dominicano-bandera'), 400);
    assert.equal(shopPrice('table', 'tropical'), 350);
    assert.equal(shopPrice('menu', 'playa-ilustrada'), 350);
    assert.equal(shopPrice('table', 'no-existe'), null);
  });
});

describe('economía: comprar', () => {
  it('sin monedas no se puede comprar y el saldo no cambia', () => {
    const eco = defaultEconomy();
    const result = buyItem(eco, 'cardBack', 'azul');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'funds');
    assert.equal(result.state.coins, 0);
    assert.equal(isOwned(result.state, 'cardBack', 'azul'), false);
  });

  it('comprar descuenta el precio y marca el artículo como propio', () => {
    const eco = { ...defaultEconomy(), coins: 500 };
    const result = buyItem(eco, 'table', 'bandera');
    assert.equal(result.ok, true);
    assert.equal(result.state.coins, 200);
    assert.ok(isOwned(result.state, 'table', 'bandera'));
  });

  it('un artículo propio no se vuelve a cobrar', () => {
    const eco = { ...defaultEconomy(), coins: 500 };
    const bought = buyItem(eco, 'menu', 'azul');
    assert.equal(bought.ok, true);
    const again = buyItem(bought.state, 'menu', 'azul');
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.reason, 'owned');
    assert.equal(again.state.coins, 350);
  });

  it('un artículo desconocido no se cobra', () => {
    const result = buyItem({ ...defaultEconomy(), coins: 999 }, 'table', 'invisible');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'unknown');
    assert.equal(result.state.coins, 999);
  });
});

describe('economía: recompensa diaria', () => {
  it('paga 50 una sola vez por día y vuelve a pagar al día siguiente', () => {
    const monday = new Date(2026, 10, 16, 9, 0, 0);
    const first = claimDailyReward(defaultEconomy(), monday);
    assert.equal(first.granted, DAILY_REWARD_COINS);
    assert.equal(first.state.coins, 50);
    const second = claimDailyReward(first.state, new Date(2026, 10, 16, 20, 0, 0));
    assert.equal(second.granted, 0);
    assert.equal(second.state.coins, 50);
    const tuesday = claimDailyReward(second.state, new Date(2026, 10, 17, 9, 0, 0));
    assert.equal(tuesday.granted, 50);
    assert.equal(tuesday.state.coins, 100);
  });
});

describe('economía: victorias, rachas y pago único por partida', () => {
  it('Casino paga 100, Tres y Dos 80, El Robaíto 70 y El Cagao 60', () => {
    assert.equal(winRewardAmount('casino', 'win', 0), 100);
    assert.equal(winRewardAmount('tresydos', 'win', 0), 80);
    assert.equal(winRewardAmount('robaito', 'win', 0), 70);
    assert.equal(winRewardAmount('cagao', 'win', 0), 60);
    assert.equal(winRewardAmount('robaito', 'tie', 0), 35);
  });

  it('la racha suma +10 por victoria anterior, hasta +50', () => {
    assert.equal(winRewardAmount('casino', 'win', 1), 110);
    assert.equal(winRewardAmount('casino', 'win', 3), 130);
    assert.equal(winRewardAmount('casino', 'win', 9), 150);
  });

  it('ganar paga una sola vez por partida aunque se registre dos veces', () => {
    const key = 'partida-1';
    const first = recordWin(defaultEconomy(), 'casino', 'win', key);
    assert.equal(first.awarded, 100);
    assert.equal(first.state.coins, 100);
    assert.equal(first.state.streak, 1);
    assert.equal(first.state.winsByGame.casino, 1);
    const second = recordWin(first.state, 'casino', 'win', key);
    assert.equal(second.awarded, null);
    assert.equal(second.state.coins, 100);
    assert.equal(second.state.streak, 1);
  });

  it('perder reinicia la racha sin pagar', () => {
    const won = recordWin(defaultEconomy(), 'tresydos', 'win', 'p1');
    assert.equal(won.state.streak, 1);
    const lost = recordWin(won.state, 'tresydos', 'loss', 'p2');
    assert.equal(lost.awarded, null);
    assert.equal(lost.state.streak, 0);
    assert.equal(lost.state.coins, 80);
  });
});

describe('economía: migración de temas ya equipados', () => {
  it('los temas que el jugador ya tenía equipados quedan como suyos, gratis', () => {
    const migrated = migrateEconomy(defaultEconomy(), {
      cardBack: 'dominicano-bandera',
      table: 'tropical',
      menu: 'atardecer-tropical',
    });
    assert.ok(isOwned(migrated, 'cardBack', 'dominicano-bandera'));
    assert.ok(isOwned(migrated, 'table', 'tropical'));
    assert.ok(isOwned(migrated, 'menu', 'atardecer-tropical'));
    // Los gratuitos por defecto siguen siendo suyos.
    assert.ok(isOwned(migrated, 'cardBack', 'cacao'));
    assert.ok(isOwned(migrated, 'table', 'madera'));
    assert.ok(isOwned(migrated, 'menu', 'madera'));
  });

  it('la ruta de carga (loadEconomy) conserva lo equipado aunque no haya economía guardada', () => {
    const prefs = {
      cardBack: 'dominicano-bandera',
      table: 'tropical',
      menu: 'atardecer-tropical',
    } as const;
    const loaded = loadEconomy(null, prefs);
    assert.ok(isOwned(loaded, 'cardBack', 'dominicano-bandera'));
    assert.ok(isOwned(loaded, 'table', 'tropical'));
    assert.ok(isOwned(loaded, 'menu', 'atardecer-tropical'));
  });

  it('la ruta de carga conserva lo equipado aunque la economía guardada no lo liste', () => {
    const prefs = {
      cardBack: 'dominicano-bandera',
      table: 'tropical',
      menu: 'atardecer-tropical',
    } as const;
    const stored = JSON.stringify({ ...defaultEconomy(), coins: 120 });
    const loaded = loadEconomy(stored, prefs);
    assert.equal(loaded.coins, 120);
    assert.ok(isOwned(loaded, 'cardBack', 'dominicano-bandera'));
    assert.ok(isOwned(loaded, 'table', 'tropical'));
    assert.ok(isOwned(loaded, 'menu', 'atardecer-tropical'));
  });

  it('la ruta de carga conserva lo equipado aunque el guardado esté corrupto', () => {
    const loaded = loadEconomy('{no-json', {
      cardBack: 'dominicano-bandera',
      table: 'tropical',
      menu: 'atardecer-tropical',
    });
    assert.ok(isOwned(loaded, 'cardBack', 'dominicano-bandera'));
    assert.ok(isOwned(loaded, 'table', 'tropical'));
    assert.ok(isOwned(loaded, 'menu', 'atardecer-tropical'));
  });
});

describe('economía: quién ganó en cada juego', () => {
  it('Casino: gana el equipo del ganador; el otro pierde', () => {
    const state = finished('casino', { winnerTeam: 0, scores: [21, 15], roundNo: 3 });
    assert.equal(humanOutcome(state, 0), 'win');
    assert.equal(humanOutcome(state, 2), 'win');
    assert.equal(humanOutcome(state, 1), 'loss');
  });

  it('Tres y Dos: gana solo el asiento ganador', () => {
    const state = finished('tresydos', { winnerSeat: 2, wins: [1, 0, 3, 0] });
    assert.equal(humanOutcome(state, 2), 'win');
    assert.equal(humanOutcome(state, 0), 'loss');
  });

  it('El Cagao: pierde quien se quedó con el A♠; los demás ganan', () => {
    const state = finished('cagao', { loserSeat: 1, finishOrder: [0, 2, 3] });
    assert.equal(humanOutcome(state, 1), 'loss');
    assert.equal(humanOutcome(state, 0), 'win');
  });

  it('El Robaíto: un ganador cobra entero y un empate paga la mitad', () => {
    const solo = finished('robaito', { winnerSeats: [0], piles: [[], [], [], []].map(() => []) });
    assert.equal(humanOutcome(solo, 0), 'win');
    assert.equal(humanOutcome(solo, 1), 'loss');
    const tie = finished('robaito', { winnerSeats: [0, 2], piles: [[], [], [], []] });
    assert.equal(humanOutcome(tie, 2), 'tie');
  });

  it('sin terminar la partida no hay resultado', () => {
    const state = createGameState('casino', createSoloPlayers('casino', PLAYERS[0], 2));
    assert.equal(humanOutcome(state, 0), null);
  });

  it('la huella de una partida cambia con el resultado', () => {
    const a = finished('casino', { winnerTeam: 0, scores: [21, 15], roundNo: 3 });
    const b = finished('casino', { winnerTeam: 1, scores: [15, 21], roundNo: 3 });
    assert.notEqual(matchFingerprint(a), matchFingerprint(b));
    assert.equal(matchFingerprint(a), matchFingerprint(finished('casino', { winnerTeam: 0, scores: [21, 15], roundNo: 3 })));
  });
});
