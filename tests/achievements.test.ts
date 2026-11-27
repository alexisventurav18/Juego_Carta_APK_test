import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACHIEVEMENTS,
  achievementProgress,
  claimAchievement,
  claimAllAchievements,
  defaultAchievements,
  defaultDailyStreak,
  evaluateAchievements,
  getAchievement,
  recordDailyVisit,
  sanitizeAchievements,
  streakBonusForDay,
  unclaimedAchievementRewards,
  type AchievementSnapshot,
} from '../src/lib/achievements';
import { claimDailyAmount, defaultEconomy, loadEconomy } from '../src/lib/economy';
import { sanitizeProgressSnapshot } from '../src/games/progress';
import { DEFAULT_VISUAL_PREFS } from '../src/lib/visualPrefs';

/** Foto vacía para evaluar logros: todo a cero salvo lo que el test ponga. */
function snap(overrides: Partial<AchievementSnapshot> = {}): AchievementSnapshot {
  return {
    winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
    gamesPlayed: 0,
    bestStreak: 0,
    level: 1,
    modesWonToday: [],
    casinoCapturesThisMatch: 0,
    robaitoCardsThisMatch: 0,
    robaitoWon: false,
    wheelStreakDays: 0,
    ...overrides,
  };
}

describe('logros: catálogo', () => {
  it('son 12, con ids únicos, recompensas entre 50 y 250 e iconos válidos', () => {
    assert.equal(ACHIEVEMENTS.length, 12);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    assert.equal(ids.size, ACHIEVEMENTS.length);
    const icons = new Set([
      'trophy',
      'spade',
      'skull',
      'zap',
      'flame',
      'crown',
      'layers',
      'star',
      'target',
      'coins',
      'sparkles',
      'calendar',
    ]);
    for (const def of ACHIEVEMENTS) {
      assert.ok(def.title.length > 0, def.id);
      assert.ok(def.description.length > 0, def.id);
      assert.ok(def.reward >= 50 && def.reward <= 250, `${def.id}: ${def.reward}`);
      assert.ok(icons.has(def.icon), `${def.id}: ${def.icon}`);
      assert.ok(def.target >= 1, def.id);
    }
  });

  it('hay un logro de primera victoria por modo', () => {
    for (const id of ['primera-casino', 'primera-tresydos', 'primera-cagao', 'primera-robaito']) {
      assert.ok(getAchievement(id), id);
    }
  });
});

describe('logros: condiciones de desbloqueo', () => {
  it('primera victoria en cada modo desbloquea su logro', () => {
    for (const game of ['casino', 'tresydos', 'robaito', 'cagao'] as const) {
      const { newlyUnlocked } = evaluateAchievements(
        defaultAchievements(),
        snap({ winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0, [game]: 1 } }),
      );
      assert.deepEqual(
        newlyUnlocked.map((a) => a.id),
        [`primera-${game}`],
        game,
      );
    }
  });

  it('racha de 5 a las 5 victorias seguidas, no a las 4; la de 10 a las 10', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ bestStreak: 4 })).newlyUnlocked.map((a) => a.id),
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ bestStreak: 5 })).newlyUnlocked.map((a) => a.id),
      ['racha-5'],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ bestStreak: 10 })).newlyUnlocked.map((a) => a.id),
      ['racha-5', 'racha-10'],
    );
  });

  it('ganar en los 4 modos el mismo día desbloquea Todoterreno total', () => {
    const day = new Date(2026, 10, 27, 12, 0, 0);
    let state = defaultAchievements();
    for (const game of ['casino', 'tresydos', 'cagao'] as const) {
      const result = evaluateAchievements(state, snap(), { wonGame: game, date: day });
      state = result.state;
      assert.deepEqual(result.newlyUnlocked, []);
    }
    const last = evaluateAchievements(state, snap(), { wonGame: 'robaito', date: day });
    assert.deepEqual(
      last.newlyUnlocked.map((a) => a.id),
      ['cuatro-modos-dia'],
    );
    assert.deepEqual(last.state.modesWonToday.games, ['casino', 'tresydos', 'cagao', 'robaito']);
  });

  it('ganar los 4 modos en días distintos no lo desbloquea', () => {
    let state = defaultAchievements();
    const days = [new Date(2026, 10, 24), new Date(2026, 10, 25), new Date(2026, 10, 26), new Date(2026, 10, 27)];
    const games = ['casino', 'tresydos', 'cagao', 'robaito'] as const;
    for (let i = 0; i < 4; i++) {
      const result = evaluateAchievements(state, snap(), { wonGame: games[i], date: days[i] });
      state = result.state;
      assert.deepEqual(result.newlyUnlocked, []);
    }
    assert.deepEqual(state.modesWonToday.games, ['robaito']);
  });

  it('100 partidas jugadas desbloquea Veterano de mesa', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ gamesPlayed: 99 })).newlyUnlocked,
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ gamesPlayed: 100 })).newlyUnlocked.map((a) => a.id),
      ['cien-partidas'],
    );
  });

  it('nivel 10 desbloquea Estrella en ascenso', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ level: 9 })).newlyUnlocked,
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ level: 10 })).newlyUnlocked.map((a) => a.id),
      ['nivel-10'],
    );
  });

  it('capturar 20 cartas en Casino desbloquea Cazador de mesa', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ casinoCapturesThisMatch: 19 })).newlyUnlocked,
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ casinoCapturesThisMatch: 20 })).newlyUnlocked.map(
        (a) => a.id,
      ),
      ['cazador-casino'],
    );
  });

  it('ganar El Robaíto con 30 cartas desbloquea El Robaíto mayor; con 29 o perdiendo, no', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ robaitoCardsThisMatch: 30, robaitoWon: true }))
        .newlyUnlocked.map((a) => a.id),
      ['roba-todo'],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ robaitoCardsThisMatch: 29, robaitoWon: true }))
        .newlyUnlocked,
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ robaitoCardsThisMatch: 40, robaitoWon: false }))
        .newlyUnlocked,
      [],
    );
  });

  it('girar la rueda 7 días seguidos desbloquea Una semana de suerte', () => {
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ wheelStreakDays: 6 })).newlyUnlocked,
      [],
    );
    assert.deepEqual(
      evaluateAchievements(defaultAchievements(), snap({ wheelStreakDays: 7 })).newlyUnlocked.map((a) => a.id),
      ['rueda-7'],
    );
  });

  it('cada logro se desbloquea una sola vez', () => {
    const first = evaluateAchievements(defaultAchievements(), snap({ gamesPlayed: 100 }));
    assert.deepEqual(
      first.newlyUnlocked.map((a) => a.id),
      ['cien-partidas'],
    );
    const second = evaluateAchievements(first.state, snap({ gamesPlayed: 101 }));
    assert.deepEqual(second.newlyUnlocked, []);
    assert.equal(second.state, first.state, 'sin cambios no se crea un estado nuevo');
  });

  it('la barra de progreso muestra el avance de cada logro', () => {
    const state = defaultAchievements();
    assert.deepEqual(achievementProgress(getAchievement('racha-5')!, state, snap({ bestStreak: 3 })), {
      current: 3,
      target: 5,
    });
    assert.deepEqual(achievementProgress(getAchievement('cien-partidas')!, state, snap({ gamesPlayed: 40 })), {
      current: 40,
      target: 100,
    });
    assert.deepEqual(achievementProgress(getAchievement('rueda-7')!, state, snap({ wheelStreakDays: 2 })), {
      current: 2,
      target: 7,
    });
    // Los logros por partida no acumulan: 0/1 hasta desbloquearse.
    assert.deepEqual(
      achievementProgress(getAchievement('cazador-casino')!, state, snap({ casinoCapturesThisMatch: 12 })),
      { current: 0, target: 1 },
    );
  });
});

describe('logros: reclamo idempotente', () => {
  it('un logro desbloqueado se cobra una sola vez', () => {
    const unlocked = evaluateAchievements(defaultAchievements(), snap({ gamesPlayed: 100 })).state;
    const first = claimAchievement(unlocked, 'cien-partidas');
    assert.equal(first.granted, 150);
    const second = claimAchievement(first.state, 'cien-partidas');
    assert.equal(second.granted, 0);
    assert.equal(second.state, first.state);
  });

  it('un logro bloqueado no paga nada', () => {
    const result = claimAchievement(defaultAchievements(), 'cien-partidas');
    assert.equal(result.granted, 0);
  });

  it('Reclamar todo cobra cada logro una sola vez', () => {
    const unlocked = evaluateAchievements(
      defaultAchievements(),
      snap({ gamesPlayed: 100, bestStreak: 5, wheelStreakDays: 7 }),
    ).state;
    assert.equal(unclaimedAchievementRewards(unlocked).count, 3);
    const first = claimAllAchievements(unlocked);
    assert.equal(first.count, 3);
    assert.equal(first.granted, 150 + 100 + 150);
    assert.equal(unclaimedAchievementRewards(first.state).count, 0);
    const second = claimAllAchievements(first.state);
    assert.equal(second.granted, 0);
    assert.equal(second.count, 0);
  });

  it('lo guardado con forma rara se limpia sin tumbar los logros', () => {
    assert.deepEqual(sanitizeAchievements(null), defaultAchievements());
    assert.deepEqual(sanitizeAchievements({ unlocked: ['cien-partidas', 'inventado'] }), {
      unlocked: ['cien-partidas'],
      claimed: [],
      modesWonToday: { date: null, games: [] },
    });
    // Reclamado sin desbloquear no vale: no se puede cobrar lo que no se tiene.
    assert.deepEqual(sanitizeAchievements({ unlocked: [], claimed: ['cien-partidas'] }), {
      unlocked: [],
      claimed: [],
      modesWonToday: { date: null, games: [] },
    });
  });
});

describe('racha diaria', () => {
  it('el primer día es 1, el día consecutivo suma y el mismo día dos veces no suma', () => {
    const monday = new Date(2026, 10, 16, 9, 0, 0);
    const day1 = recordDailyVisit(defaultDailyStreak(), monday);
    assert.deepEqual(day1, { days: 1, lastDate: '2026-11-16' });
    const sameDay = recordDailyVisit(day1, new Date(2026, 10, 16, 20, 0, 0));
    assert.equal(sameDay, day1, 'misma referencia: no cambia');
    const day2 = recordDailyVisit(day1, new Date(2026, 10, 17, 9, 0, 0));
    assert.deepEqual(day2, { days: 2, lastDate: '2026-11-17' });
  });

  it('saltarse un día reinicia la racha a 1', () => {
    const streak = { days: 5, lastDate: '2026-11-16' };
    const afterSkip = recordDailyVisit(streak, new Date(2026, 10, 18, 9, 0, 0));
    assert.deepEqual(afterSkip, { days: 1, lastDate: '2026-11-18' });
  });

  it('el extra de la rueda es +50 el día 1, +10 por día más, hasta +150', () => {
    assert.equal(streakBonusForDay(0), 0);
    assert.equal(streakBonusForDay(1), 50);
    assert.equal(streakBonusForDay(2), 60);
    assert.equal(streakBonusForDay(7), 110);
    assert.equal(streakBonusForDay(11), 150);
    assert.equal(streakBonusForDay(30), 150);
  });

  it('el cobro de la rueda suma el extra de la racha y solo una vez al día', () => {
    const monday = new Date(2026, 10, 16, 9, 0, 0);
    const first = claimDailyAmount(defaultEconomy(), 100, monday);
    assert.equal(first.granted, 150, '100 de la rueda + 50 de racha (día 1)');
    assert.equal(first.streakBonus, 50);
    assert.equal(first.streakDays, 1);
    assert.equal(first.state.coins, 150);
    const second = claimDailyAmount(first.state, 250, new Date(2026, 10, 16, 20, 0, 0));
    assert.equal(second.granted, 0);
    const tuesday = claimDailyAmount(first.state, 25, new Date(2026, 10, 17, 9, 0, 0));
    assert.equal(tuesday.granted, 85, '25 de la rueda + 60 de racha (día 2)');
    assert.equal(tuesday.state.coins, 235);
  });
});

describe('logros y racha: viaje con la nube', () => {
  it('la economía cargada conserva los logros y la racha guardados', () => {
    const saved = JSON.stringify({
      ...defaultEconomy(),
      coins: 420,
      dailyStreak: { days: 6, lastDate: '2026-11-27' },
      achievements: {
        unlocked: ['primera-casino', 'rueda-7'],
        claimed: ['primera-casino'],
        modesWonToday: { date: '2026-11-27', games: ['casino'] },
      },
    });
    const loaded = loadEconomy(saved, DEFAULT_VISUAL_PREFS);
    assert.deepEqual(loaded.dailyStreak, { days: 6, lastDate: '2026-11-27' });
    assert.deepEqual(loaded.achievements.unlocked, ['primera-casino', 'rueda-7']);
    assert.deepEqual(loaded.achievements.claimed, ['primera-casino']);
    assert.equal(loaded.coins, 420);
  });

  it('una economía vieja sin los campos nuevos arranca con los valores por defecto', () => {
    const loaded = loadEconomy(JSON.stringify({ coins: 10 }), DEFAULT_VISUAL_PREFS);
    assert.deepEqual(loaded.dailyStreak, { days: 0, lastDate: null });
    assert.deepEqual(loaded.achievements, defaultAchievements());
  });

  it('la foto de la nube guarda la racha y los logros tal cual', () => {
    const snapshot = sanitizeProgressSnapshot({
      economy: {
        coins: 420,
        wins: 7,
        gamesPlayed: 12,
        losses: 5,
        streak: 3,
        bestStreak: 4,
        winsByGame: { casino: 4, tresydos: 2, robaito: 1, cagao: 0 },
        xp: 860,
        lastDailyDate: '2026-11-22',
        ownedCardBacks: [],
        ownedTables: [],
        ownedMenus: [],
        awarded: ['partida-1'],
        missions: { daily: [], weekly: [] },
        dailyStreak: { days: 6, lastDate: '2026-11-22' },
        achievements: {
          unlocked: ['primera-casino'],
          claimed: [],
          modesWonToday: { date: '2026-11-22', games: ['casino'] },
        },
      },
      visualPrefs: null,
    });
    assert.ok(snapshot);
    assert.deepEqual(snapshot?.economy.dailyStreak, { days: 6, lastDate: '2026-11-22' });
    assert.deepEqual(snapshot?.economy.achievements, {
      unlocked: ['primera-casino'],
      claimed: [],
      modesWonToday: { date: '2026-11-22', games: ['casino'] },
    });
  });

  it('la foto sin racha ni logros se guarda con los valores por defecto, y lo inválido se anula', () => {
    const snapshot = sanitizeProgressSnapshot({
      economy: {
        coins: 10,
        wins: 0,
        gamesPlayed: 0,
        losses: 0,
        streak: 0,
        bestStreak: 0,
        winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
        xp: 0,
        lastDailyDate: null,
        ownedCardBacks: [],
        ownedTables: [],
        ownedMenus: [],
        awarded: [],
        missions: { daily: [], weekly: [] },
        dailyStreak: 'seis días',
        achievements: { unlocked: 'primera-casino' },
      },
      visualPrefs: null,
    });
    assert.ok(snapshot);
    assert.deepEqual(snapshot?.economy.dailyStreak, { days: 0, lastDate: null });
    assert.equal(snapshot?.economy.achievements, null);
  });
});
