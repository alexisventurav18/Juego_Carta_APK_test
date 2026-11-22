import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  claimAllMissions,
  dayKey,
  missionDef,
  unclaimedRewards,
  weekKey,
  type MissionProgress,
  type MissionsState,
} from '../src/lib/missions';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

const FRIDAY = new Date(2026, 10, 20, 12, 0, 0); // viernes 20 nov 2026

function progress(id: string, value: number, claimed = false): MissionProgress {
  return { id, progress: value, claimed, games: [] };
}

function stateWith(daily: MissionProgress[], weekly: MissionProgress[]): MissionsState {
  return { dailyKey: dayKey(FRIDAY), daily, weeklyKey: weekKey(FRIDAY), weekly };
}

/**
 * "Reclamar todo": una sola acción reclama las misiones diarias y semanales
 * completadas sin reclamar, suma exactamente sus recompensas y no paga dos
 * veces lo mismo.
 */
describe('misiones: reclamar todo', () => {
  it('suma exactamente las recompensas pendientes, diarias y semanales juntas', () => {
    const state = stateWith(
      [progress('d-win1', 1), progress('d-play3', 3), progress('d-win2', 1)],
      [progress('w-win5', 5)],
    );
    // d-win1 (30) y d-play3 (25) completas; d-win2 incompleta (1 de 2); w-win5 (150) completa.
    const result = claimAllMissions(state, FRIDAY);
    assert.equal(result.granted, 30 + 25 + 150, 'reclamar todo suma 205 monedas');
    assert.equal(result.claimed.length, 3, 'reclamar todo reclama 3 misiones');
    assert.deepEqual(
      result.claimed.map((def) => def.id).sort(),
      ['d-play3', 'd-win1', 'w-win5'],
      'reclamar todo reclama justo las completas',
    );
    assert.ok(result.state.daily.every((p) => p.id !== 'd-win1' || p.claimed), 'd-win1 queda marcada');
    assert.ok(result.state.weekly.every((p) => p.id !== 'w-win5' || p.claimed), 'w-win5 queda marcada');
    assert.ok(
      result.state.daily.some((p) => p.id === 'd-win2' && !p.claimed),
      'la incompleta sigue sin reclamar',
    );
  });

  it('no reclama dos veces lo mismo', () => {
    const state = stateWith([progress('d-win1', 1)], [progress('w-win5', 5)]);
    const first = claimAllMissions(state, FRIDAY);
    assert.equal(first.granted, 180, 'el primer reclamo paga 30 + 150');
    const second = claimAllMissions(first.state, FRIDAY);
    assert.equal(second.granted, 0, 'el segundo reclamo no paga nada');
    assert.equal(second.claimed.length, 0, 'el segundo reclamo no reclama nada');
  });

  it('con nada pendiente no suma nada', () => {
    const empty = claimAllMissions(stateWith([progress('d-win1', 0)], []), FRIDAY);
    assert.equal(empty.granted, 0, 'sin misiones completas no hay monedas');
    assert.equal(empty.claimed.length, 0, 'sin misiones completas no hay reclamos');
    const allClaimed = claimAllMissions(
      stateWith([progress('d-win1', 1, true)], [progress('w-win5', 5, true)]),
      FRIDAY,
    );
    assert.equal(allClaimed.granted, 0, 'todo ya reclamado no vuelve a pagar');
    assert.deepEqual(unclaimedRewards(allClaimed.state), { count: 0, coins: 0 }, 'nada pendiente');
  });

  it('unclaimedRewards cuenta y suma lo pendiente', () => {
    const state = stateWith(
      [progress('d-win1', 1), progress('d-play3', 2)],
      [progress('w-win5', 5), progress('w-play15', 15)],
    );
    // d-win1 30, w-win5 150, w-play15 120; d-play3 incompleta.
    assert.deepEqual(unclaimedRewards(state), { count: 3, coins: 300 }, '3 pendientes por 300 monedas');
    assert.equal(missionDef('d-win1')?.reward, 30, 'la recompensa de d-win1 es 30');
  });
});

describe('misiones: botón Reclamar todo en el modal', () => {
  it('el modal tiene el botón, muestra el total pendiente y se apaga sin nada que reclamar', () => {
    const modal = read('src/components/MissionsModal.tsx');
    assert.ok(modal.includes('Reclamar todo'), 'MissionsModal: botón "Reclamar todo"');
    assert.ok(modal.includes('claimAllMissionRewards()'), 'MissionsModal: reclama con claimAllMissionRewards()');
    assert.ok(modal.includes('disabled={pending.count === 0}'), 'MissionsModal: el botón se deshabilita sin pendientes');
    assert.ok(modal.includes('unclaimedRewards(economy.missions)'), 'MissionsModal: el total viene de unclaimedRewards');
    assert.ok(modal.includes('¡Reclamaste'), 'MissionsModal: confirma el total ganado');
    assert.ok(modal.includes("playSound('coin')"), 'MissionsModal: al reclamar todo suena la moneda');
  });

  it('la economía expone claimAllMissionRewards sobre claimAllMissions', () => {
    const economy = read('src/lib/economy.ts');
    assert.ok(economy.includes('export function claimAllMissionRewards'), 'economy: existe claimAllMissionRewards()');
    assert.ok(economy.includes('claimAllMissionsPure(economy.missions)'), 'economy: reclama sobre el estado guardado');
    assert.ok(economy.includes('coins: economy.coins + result.granted'), 'economy: las monedas se suman una sola vez');
  });
});
