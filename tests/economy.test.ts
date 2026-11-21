import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buyItem,
  claimDailyAmount,
  claimDailyReward,
  DAILY_WHEEL_PRIZES,
  defaultEconomy,
  DAILY_REWARD_COINS,
  humanOutcome,
  isDailyAvailable,
  isOwned,
  loadEconomy,
  matchFingerprint,
  migrateEconomy,
  recordWin,
  rollDailyPrize,
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
    assert.ok(isOwned(eco, 'menu', 'fiesta-tropical'));
    assert.equal(isOwned(eco, 'cardBack', 'dominicano-bandera'), false);
  });

  it('el catálogo cubre los 8 dorsos, las 8 mesas y los 7 fondos, solo con arte existente o gradientes CSS', () => {
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'cardBack').length, 8);
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'table').length, 8);
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'menu').length, 7);
    assert.equal(shopPrice('cardBack', 'cacao'), 0);
    assert.equal(shopPrice('cardBack', 'dominicano-bandera'), 400);
    assert.equal(shopPrice('table', 'tropical'), 350);
    assert.equal(shopPrice('menu', 'playa-ilustrada'), 350);
    assert.equal(shopPrice('menu', 'fiesta-tropical'), 0);
    assert.equal(shopPrice('menu', 'madera'), 0);
    assert.equal(shopPrice('table', 'no-existe'), null);
  });

  it('una victoria en Casino (100 monedas) alcanza para el primer nivel de pago (100)', () => {
    assert.equal(shopPrice('table', 'verde'), 100);
    assert.equal(shopPrice('table', 'azul'), 100);
    assert.equal(shopPrice('cardBack', 'azul'), 100);
    assert.equal(shopPrice('menu', 'verde'), 100);
    assert.equal(shopPrice('table', 'rojo'), 150);
    const eco = { ...defaultEconomy(), coins: winRewardAmount('casino', 'win', 0) };
    const result = buyItem(eco, 'table', 'verde');
    assert.equal(result.ok, true);
    assert.equal(result.state.coins, 0);
    assert.ok(isOwned(result.state, 'table', 'verde'));
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
    assert.equal(again.state.coins, 400);
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
    // 100 de la victoria + 50 por subir del nivel 1 al 2 con esos 100 XP.
    assert.equal(first.awarded, 150);
    assert.equal(first.state.coins, 150);
    assert.equal(first.state.xp, 100);
    assert.equal(first.xpGain?.gained, 100);
    assert.equal(first.xpGain?.levelBefore, 1);
    assert.equal(first.xpGain?.levelAfter, 2);
    assert.equal(first.xpGain?.levelsGained, 1);
    assert.equal(first.state.streak, 1);
    assert.equal(first.state.winsByGame.casino, 1);
    const second = recordWin(first.state, 'casino', 'win', key);
    assert.equal(second.awarded, null);
    assert.equal(second.xpGain, null);
    assert.equal(second.state.coins, 150);
    assert.equal(second.state.xp, 100);
    assert.equal(second.state.streak, 1);
  });

  it('perder reinicia la racha sin pagar ni dar XP', () => {
    const won = recordWin(defaultEconomy(), 'tresydos', 'win', 'p1');
    assert.equal(won.state.streak, 1);
    // 80 de la victoria y 80 XP: no cruzan el umbral de 100 del nivel 2,
    // así que no hay bonus de subida de nivel en esta primera victoria.
    assert.equal(won.awarded, 80);
    assert.equal(won.state.xp, 80);
    assert.equal(won.xpGain?.levelsGained, 0);
    const lost = recordWin(won.state, 'tresydos', 'loss', 'p2');
    assert.equal(lost.awarded, null);
    assert.equal(lost.xpGain, null);
    assert.equal(lost.state.streak, 0);
    assert.equal(lost.state.coins, 80);
    assert.equal(lost.state.xp, 80);
  });

  it('cuenta partidas jugadas, derrotas y mejor racha (para el perfil)', () => {
    const w1 = recordWin(defaultEconomy(), 'casino', 'win', 'p1');
    // w1: 100 monedas + 50 por subir del nivel 1 al 2 (XP 0→100).
    assert.equal(w1.awarded, 150);
    assert.equal(w1.state.coins, 150);
    assert.equal(w1.state.xp, 100);
    const w2 = recordWin(w1.state, 'casino', 'win', 'p2');
    // w2: 100 + 10 de racha, sin subir de nivel (XP 100→200, el nivel 2 pide 120).
    assert.equal(w2.awarded, 110);
    assert.equal(w2.state.coins, 260);
    assert.equal(w2.state.xp, 200);
    const w3 = recordWin(w2.state, 'casino', 'win', 'p3');
    // w3: 100 + 20 de racha + 50 por subir al nivel 3 (XP 200→300, cruza 220).
    assert.equal(w3.awarded, 170);
    assert.equal(w3.state.coins, 430);
    assert.equal(w3.state.xp, 300);
    assert.equal(w3.state.gamesPlayed, 3);
    assert.equal(w3.state.losses, 0);
    assert.equal(w3.state.bestStreak, 3);
    const lost = recordWin(w3.state, 'casino', 'loss', 'p4');
    assert.equal(lost.state.gamesPlayed, 4);
    assert.equal(lost.state.losses, 1);
    assert.equal(lost.state.streak, 0);
    assert.equal(lost.state.bestStreak, 3);
    // Un guardado viejo (sin los campos nuevos) migra a 0, no a NaN.
    const old = loadEconomy(JSON.stringify({ ...defaultEconomy(), coins: 10, gamesPlayed: undefined }), {
      cardBack: 'cacao',
      table: 'madera',
      menu: 'madera',
    });
    assert.equal(old.gamesPlayed, 0);
    assert.equal(old.losses, 0);
    assert.equal(old.bestStreak, 0);
    assert.equal(old.xp, 0);
  });
});

describe('economía: rueda diaria', () => {
  it('los segmentos cubren todos los premios y suman 100 de peso', () => {
    assert.equal(DAILY_WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0), 100);
    assert.deepEqual(
      DAILY_WHEEL_PRIZES.map((p) => p.amount),
      [25, 50, 100, 150, 250],
    );
  });

  it('el sorteo respeta los pesos (azar inyectado)', () => {
    assert.equal(rollDailyPrize(() => 0), 25);
    assert.equal(rollDailyPrize(() => 0.29), 25);
    assert.equal(rollDailyPrize(() => 0.3), 50);
    assert.equal(rollDailyPrize(() => 0.69), 50);
    assert.equal(rollDailyPrize(() => 0.7), 100);
    assert.equal(rollDailyPrize(() => 0.89), 100);
    assert.equal(rollDailyPrize(() => 0.9), 150);
    assert.equal(rollDailyPrize(() => 0.97), 150);
    assert.equal(rollDailyPrize(() => 0.99), 250);
  });

  it('el premio medio ronda las 64 monedas y nunca sale de la rueda', () => {
    let total = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const prize = rollDailyPrize();
      assert.ok([25, 50, 100, 150, 250].includes(prize));
      total += prize;
    }
    const mean = total / n;
    assert.ok(mean > 58 && mean < 71, `media ${mean}`);
  });

  it('el premio girado se cobra una sola vez al día', () => {
    const monday = new Date(2026, 10, 16, 9, 0, 0);
    const eco = defaultEconomy();
    assert.equal(isDailyAvailable(eco, monday), true);
    const first = claimDailyAmount(eco, 100, monday);
    assert.equal(first.granted, 100);
    assert.equal(first.state.coins, 100);
    assert.equal(isDailyAvailable(first.state, monday), false);
    const second = claimDailyAmount(first.state, 250, new Date(2026, 10, 16, 20, 0, 0));
    assert.equal(second.granted, 0);
    assert.equal(second.state.coins, 100);
    const tuesday = claimDailyAmount(second.state, 25, new Date(2026, 10, 17, 9, 0, 0));
    assert.equal(tuesday.granted, 25);
    assert.equal(tuesday.state.coins, 125);
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
    // El default actual (Fiesta tropical) también es gratis para quien ya jugaba.
    assert.ok(isOwned(migrated, 'menu', 'fiesta-tropical'));
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
