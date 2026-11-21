import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_LEVEL,
  addXp,
  levelFromXp,
  xpGainForWin,
  xpGainPhases,
  xpProgress,
  xpToNextLevel,
} from '../src/lib/experience';

/**
 * Pruebas de la curva de experiencia: niveles hasta 100, XP por victoria y
 * el plan de animación de la barra. Las importaciones son relativas porque
 * tsx no resuelve el alias `@/` que usa Vite.
 */

describe('experiencia: curva de niveles', () => {
  it('el nivel 1→2 cuesta 100 XP (una victoria en Casino) y cada nivel cuesta 20 más', () => {
    assert.equal(xpToNextLevel(1), 100);
    assert.equal(xpToNextLevel(2), 120);
    assert.equal(xpToNextLevel(3), 140);
    assert.equal(xpToNextLevel(99), 2060);
    assert.equal(xpToNextLevel(100), 0);
    assert.equal(xpToNextLevel(101), 0);
  });

  it('levelFromXp en los bordes de nivel', () => {
    assert.deepEqual(levelFromXp(0), { level: 1, xpIntoLevel: 0, xpNeeded: 100 });
    assert.deepEqual(levelFromXp(99), { level: 1, xpIntoLevel: 99, xpNeeded: 100 });
    assert.deepEqual(levelFromXp(100), { level: 2, xpIntoLevel: 0, xpNeeded: 120 });
    assert.deepEqual(levelFromXp(219), { level: 2, xpIntoLevel: 119, xpNeeded: 120 });
    assert.deepEqual(levelFromXp(220), { level: 3, xpIntoLevel: 0, xpNeeded: 140 });
  });

  it('llegar al nivel 100 cuesta 106920 XP en total', () => {
    assert.equal(levelFromXp(106919).level, 99);
    assert.deepEqual(levelFromXp(106920), { level: MAX_LEVEL, xpIntoLevel: 0, xpNeeded: 0 });
    assert.equal(levelFromXp(200000).level, MAX_LEVEL);
  });

  it('la XP negativa se trata como 0', () => {
    assert.deepEqual(levelFromXp(-5), { level: 1, xpIntoLevel: 0, xpNeeded: 100 });
    assert.equal(xpProgress(-10), 0);
  });

  it('xpProgress es la fracción dentro del nivel (1 en el máximo)', () => {
    assert.equal(xpProgress(0), 0);
    assert.equal(xpProgress(50), 0.5);
    assert.equal(xpProgress(100), 0);
    assert.equal(xpProgress(160), 0.5);
    assert.equal(xpProgress(106920), 1);
  });
});

describe('experiencia: ganar XP', () => {
  it('xpGainForWin paga la base en victoria, la mitad en empate y nada al perder', () => {
    assert.equal(xpGainForWin('casino', 'win'), 100);
    assert.equal(xpGainForWin('tresydos', 'win'), 80);
    assert.equal(xpGainForWin('robaito', 'win'), 70);
    assert.equal(xpGainForWin('cagao', 'win'), 60);
    assert.equal(xpGainForWin('casino', 'tie'), 50);
    assert.equal(xpGainForWin('cagao', 'tie'), 30);
    assert.equal(xpGainForWin('casino', 'loss'), 0);
  });

  it('addXp con una subida de nivel registra el antes y el después', () => {
    const gain = addXp(0, 100);
    assert.equal(gain.totalXp, 100);
    assert.equal(gain.gained, 100);
    assert.equal(gain.levelBefore, 1);
    assert.equal(gain.levelAfter, 2);
    assert.equal(gain.levelsGained, 1);
    assert.deepEqual(gain.xpBefore, { level: 1, xpIntoLevel: 0, xpNeeded: 100 });
    assert.deepEqual(gain.xpAfter, { level: 2, xpIntoLevel: 0, xpNeeded: 120 });
  });

  it('addXp con varias subidas a la vez', () => {
    // 500 XP cruzan los niveles 1, 2 y 3 (100+120+140=360) y dejan 140/160 del 4.
    const gain = addXp(0, 500);
    assert.equal(gain.totalXp, 500);
    assert.equal(gain.levelBefore, 1);
    assert.equal(gain.levelAfter, 4);
    assert.equal(gain.levelsGained, 3);
    assert.deepEqual(gain.xpAfter, { level: 4, xpIntoLevel: 140, xpNeeded: 160 });
  });

  it('addXp con +5000 desde 0 llega al nivel 19', () => {
    const gain = addXp(0, 5000);
    assert.equal(gain.levelAfter, 19);
    assert.equal(gain.levelsGained, 18);
    assert.deepEqual(gain.xpAfter, { level: 19, xpIntoLevel: 140, xpNeeded: 460 });
  });

  it('sumar XP en el nivel 100 mantiene el nivel 100', () => {
    const gain = addXp(106920, 500);
    assert.equal(gain.totalXp, 107420);
    assert.equal(gain.levelBefore, 100);
    assert.equal(gain.levelAfter, 100);
    assert.equal(gain.levelsGained, 0);
    assert.deepEqual(gain.xpAfter, { level: 100, xpIntoLevel: 0, xpNeeded: 0 });
  });
});

describe('experiencia: plan de animación de la barra', () => {
  it('sin cruzar nivel hay un solo segmento sin subidón', () => {
    const phases = xpGainPhases(addXp(0, 50));
    assert.equal(phases.length, 1);
    assert.deepEqual(phases[0], { level: 1, fromPct: 0, toPct: 0.5, gainedInSegment: 50, leveledUp: false });
  });

  it('cruzando un nivel hay dos segmentos: el primero termina lleno y sube', () => {
    const phases = xpGainPhases(addXp(0, 150));
    assert.equal(phases.length, 2);
    assert.deepEqual(phases[0], { level: 1, fromPct: 0, toPct: 1, gainedInSegment: 100, leveledUp: true });
    assert.deepEqual(phases[1], { level: 2, fromPct: 0, toPct: 50 / 120, gainedInSegment: 50, leveledUp: false });
  });

  it('cruzando varios niveles hay un segmento por nivel atravesado', () => {
    const phases = xpGainPhases(addXp(0, 500));
    assert.equal(phases.length, 4);
    assert.deepEqual(
      phases.map((phase) => phase.level),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      phases.map((phase) => phase.leveledUp),
      [true, true, true, false],
    );
    assert.equal(
      phases.reduce((sum, phase) => sum + phase.gainedInSegment, 0),
      500,
    );
    assert.equal(phases[3].toPct, 140 / 160);
  });

  it('en el nivel máximo hay un solo segmento lleno', () => {
    const phases = xpGainPhases(addXp(106920, 100));
    assert.equal(phases.length, 1);
    assert.deepEqual(phases[0], { level: 100, fromPct: 1, toPct: 1, gainedInSegment: 100, leveledUp: false });
  });

  it('cruzar al nivel 100 sí muestra el estallido de subida', () => {
    // A 100 XP del máximo: 100 XP completan el 99 y 50 sobran ya en el 100.
    const phases = xpGainPhases(addXp(106820, 150));
    assert.equal(phases.length, 2);
    assert.deepEqual(phases[0], { level: 99, fromPct: 1960 / 2060, toPct: 1, gainedInSegment: 100, leveledUp: true });
    assert.deepEqual(phases[1], { level: 100, fromPct: 0, toPct: 1, gainedInSegment: 0, leveledUp: false });
  });
});
