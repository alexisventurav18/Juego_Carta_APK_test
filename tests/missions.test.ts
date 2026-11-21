import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyMatch,
  claimMission,
  dayKey,
  defaultMissions,
  isMissionComplete,
  refreshMissions,
  timeUntilReset,
  unclaimedCompleted,
  weekKey,
  type MissionProgress,
  type MissionsState,
} from '../src/lib/missions';
import { awardMatchWithStats, getEconomy, loadEconomy } from '../src/lib/economy';
import { getVisualPrefs } from '../src/lib/visualPrefs';

const FRIDAY = new Date(2026, 10, 20, 12, 0, 0); // viernes 20 nov 2026
const MONDAY = new Date(2026, 10, 16, 12, 0, 0); // lunes 16 nov 2026

function progress(id: string): MissionProgress {
  return { id, progress: 0, claimed: false, games: [] };
}

function stateWith(dailyIds: string[], weeklyIds: string[]): MissionsState {
  return {
    dailyKey: dayKey(FRIDAY),
    daily: dailyIds.map(progress),
    weeklyKey: weekKey(FRIDAY),
    weekly: weeklyIds.map(progress),
  };
}

describe('misiones: claves de día y semana', () => {
  it('dayKey usa la fecha local con ceros', () => {
    assert.equal(dayKey(new Date(2026, 0, 5, 9, 30)), '2026-01-05');
  });

  it('weekKey es el lunes de esa semana, también en domingo', () => {
    assert.equal(weekKey(FRIDAY), '2026-11-16');
    assert.equal(weekKey(MONDAY), '2026-11-16');
    assert.equal(weekKey(new Date(2026, 10, 22, 12, 0, 0)), '2026-11-16'); // domingo
  });
});

describe('misiones: selección diaria y semanal', () => {
  it('elige 3 diarias y 3 semanales, siempre las mismas para la misma fecha', () => {
    const a = defaultMissions(FRIDAY);
    const b = defaultMissions(FRIDAY);
    assert.equal(a.daily.length, 3);
    assert.equal(a.weekly.length, 3);
    assert.deepEqual(a, b);
    assert.equal(new Set(a.daily.map((p) => p.id)).size, 3);
    assert.equal(new Set(a.weekly.map((p) => p.id)).size, 3);
  });

  it('regenera solo el periodo que cambió de fecha', () => {
    const state = stateWith(['d-win1', 'd-play3', 'd-modes2'], ['w-win5']);
    const next = refreshMissions(state, new Date(2026, 10, 21, 12, 0, 0)); // sábado
    assert.notEqual(next.dailyKey, state.dailyKey);
    assert.equal(next.weeklyKey, state.weeklyKey);
    assert.deepEqual(next.weekly, state.weekly);
  });

  it('regenera la semana cuando cambia el lunes', () => {
    const state = stateWith(['d-win1'], ['w-win5']);
    const next = refreshMissions(state, new Date(2026, 10, 23, 12, 0, 0)); // lunes siguiente
    assert.notEqual(next.weeklyKey, state.weeklyKey);
    assert.equal(next.weekly.length, 3);
  });
});

describe('misiones: progreso por partida', () => {
  it('una victoria avanza ganar y jugar, y se anuncia al completarse una sola vez', () => {
    const state = stateWith(['d-win1', 'd-play3'], []);
    const first = applyMatch(state, { game: 'casino', outcome: 'win' }, FRIDAY);
    assert.equal(first.state.daily[0].progress, 1);
    assert.equal(first.state.daily[1].progress, 1);
    assert.deepEqual(
      first.completed.map((d) => d.id),
      ['d-win1'],
    );
    const second = applyMatch(first.state, { game: 'casino', outcome: 'win' }, FRIDAY);
    assert.equal(second.state.daily[0].progress, 2);
    assert.deepEqual(second.completed, []);
  });

  it('una derrota avanza jugar pero no ganar, y un empate cuenta como victoria', () => {
    const state = stateWith(['d-win1', 'd-play3'], []);
    const lost = applyMatch(state, { game: 'robaito', outcome: 'loss' }, FRIDAY);
    assert.equal(lost.state.daily[0].progress, 0);
    assert.equal(lost.state.daily[1].progress, 1);
    const tied = applyMatch(lost.state, { game: 'robaito', outcome: 'tie' }, FRIDAY);
    assert.equal(tied.state.daily[0].progress, 1);
  });

  it('las misiones de un modo solo cuentan partidas de ese modo', () => {
    const state = stateWith(['d-win-casino'], []);
    const other = applyMatch(state, { game: 'robaito', outcome: 'win' }, FRIDAY);
    assert.equal(other.state.daily[0].progress, 0);
    const mine = applyMatch(other.state, { game: 'casino', outcome: 'win' }, FRIDAY);
    assert.equal(mine.state.daily[0].progress, 1);
  });

  it('las misiones de modos cuentan cada modo una sola vez', () => {
    const state = stateWith(['d-modes2'], ['w-modes3']);
    const one = applyMatch(state, { game: 'casino', outcome: 'loss' }, FRIDAY);
    assert.equal(one.state.daily[0].progress, 1);
    assert.equal(one.state.weekly[0].progress, 0); // perder no cuenta para ganar en modos
    const same = applyMatch(one.state, { game: 'casino', outcome: 'win' }, FRIDAY);
    assert.equal(same.state.daily[0].progress, 1); // el mismo modo no suma dos veces
    assert.equal(same.state.weekly[0].progress, 1);
    const two = applyMatch(same.state, { game: 'tresydos', outcome: 'win' }, FRIDAY);
    assert.equal(two.state.daily[0].progress, 2);
    assert.equal(two.state.weekly[0].progress, 2);
    assert.deepEqual(
      two.completed.map((d) => d.id),
      ['d-modes2'],
    );
  });

  it('las capturas y los viraos del Casino suman en sus misiones', () => {
    const state = stateWith(['d-capture15', 'd-virao1'], ['w-capture60']);
    const first = applyMatch(
      state,
      { game: 'casino', outcome: 'win', capturedCards: 10, viraos: 0 },
      FRIDAY,
    );
    assert.equal(first.state.daily[0].progress, 10);
    assert.equal(first.state.daily[1].progress, 0);
    assert.deepEqual(first.completed, []);
    const second = applyMatch(
      first.state,
      { game: 'casino', outcome: 'loss', capturedCards: 8, viraos: 1 },
      FRIDAY,
    );
    assert.equal(second.state.daily[0].progress, 18);
    assert.equal(second.state.daily[1].progress, 1);
    assert.equal(second.state.weekly[0].progress, 18);
    assert.deepEqual(
      second.completed.map((d) => d.id),
      ['d-capture15', 'd-virao1'],
    );
  });

  it('las capturas de otros modos no cuentan', () => {
    const state = stateWith(['d-capture15'], []);
    const next = applyMatch(state, { game: 'robaito', outcome: 'win', capturedCards: 99 }, FRIDAY);
    assert.equal(next.state.daily[0].progress, 0);
  });
});

describe('misiones: reclamar', () => {
  it('paga la recompensa una sola vez y solo si está completa', () => {
    let state = stateWith(['d-win1', 'd-play3'], []);
    const incomplete = claimMission(state, 'daily', 'd-play3', FRIDAY);
    assert.equal(incomplete.granted, 0);
    state = applyMatch(state, { game: 'casino', outcome: 'win' }, FRIDAY).state;
    assert.equal(unclaimedCompleted(state), 1);
    const first = claimMission(state, 'daily', 'd-win1', FRIDAY);
    assert.equal(first.granted, 30);
    assert.equal(first.state.daily[0].claimed, true);
    assert.equal(unclaimedCompleted(first.state), 0);
    const second = claimMission(first.state, 'daily', 'd-win1', FRIDAY);
    assert.equal(second.granted, 0);
  });

  it('reclamar en el periodo equivocado no paga', () => {
    const state = applyMatch(stateWith(['d-win1'], []), { game: 'casino', outcome: 'win' }, FRIDAY).state;
    assert.equal(claimMission(state, 'weekly', 'd-win1', FRIDAY).granted, 0);
  });

  it('isMissionComplete respeta el objetivo', () => {
    const done = { id: 'd-play3', progress: 3, claimed: false, games: [] };
    const pending = { id: 'd-play3', progress: 2, claimed: false, games: [] };
    assert.equal(isMissionComplete(done), true);
    assert.equal(isMissionComplete(pending), false);
  });
});

describe('misiones: tiempo hasta el reinicio', () => {
  it('diarias: minutos si falta menos de una hora', () => {
    assert.equal(timeUntilReset('daily', new Date(2026, 10, 20, 23, 30)), '30 min');
  });

  it('diarias: horas y minutos al mediodía', () => {
    assert.equal(timeUntilReset('daily', new Date(2026, 10, 20, 12, 0)), '12 h 0 min');
  });

  it('semanales: días hasta el lunes', () => {
    assert.equal(timeUntilReset('weekly', new Date(2026, 10, 16, 0, 0)), '7 d 0 h');
    assert.equal(timeUntilReset('weekly', new Date(2026, 10, 21, 12, 0)), '1 d 12 h');
  });
});

describe('misiones: integración con la economía', () => {
  it('una partida premiada avanza las misiones y paga las monedas juntas', () => {
    const before = getEconomy();
    const result = awardMatchWithStats('misiones-test-1', 'casino', 'win', {
      game: 'casino',
      outcome: 'win',
      capturedCards: 20,
      viraos: 1,
    });
    // 100 de la victoria + 50 por subir del nivel 1 al 2 con esos 100 XP.
    assert.equal(result.awarded, 150);
    const after = getEconomy();
    assert.equal(after.coins, before.coins + 150);
    assert.equal(after.xp, before.xp + 100);
    assert.equal(result.xpGain?.levelsGained, 1);
    assert.ok(after.missions.daily.some((p) => p.progress > 0));
    assert.ok(after.missions.weekly.some((p) => p.progress > 0));
  });

  it('la misma partida no se cuenta dos veces', () => {
    const before = getEconomy();
    const again = awardMatchWithStats('misiones-test-1', 'casino', 'win', {
      game: 'casino',
      outcome: 'win',
      capturedCards: 20,
      viraos: 1,
    });
    assert.equal(again.awarded, null);
    assert.deepEqual(again.completed, []);
    assert.deepEqual(getEconomy(), before);
  });

  it('un guardado viejo sin misiones arranca con las de hoy', () => {
    const raw = JSON.stringify({ coins: 250, wins: 3 });
    const eco = loadEconomy(raw, getVisualPrefs());
    assert.equal(eco.coins, 250);
    assert.equal(eco.missions.daily.length, 3);
    assert.equal(eco.missions.weekly.length, 3);
    assert.equal(eco.missions.dailyKey, dayKey());
  });
});
