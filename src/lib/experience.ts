import { botLevelFor, MAX_LEVEL, type GameId } from '../games/shared';
// Se reexportan para que el resto de la app los importe desde aquí.
export { MAX_LEVEL, botLevelFor };

/** Resultado de una partida, igual que WinOutcome en economy.ts (sin importarlo, para no crear un ciclo). */
export type XpOutcome = 'win' | 'tie' | 'loss';

/**
 * Experiencia y niveles de Cartas Dominicanas.
 *
 * Referencias: la barra de XP animada de Duolingo, el subidón de nivel de
 * Clash Royale / Brawl Stars y la barra de Fortnite: ganar una partida
 * siempre suma XP visible, y al cruzar un nivel hay estallido, sonido y
 * vibración. Módulo puro y sin React: solo importa el tipo GameId, para que
 * la economía pueda usarlo sin ciclos de importación.
 *
 * La curva es lineal y generosa al principio: el nivel 1→2 cuesta 100 XP,
 * exactamente una victoria en Casino, para que el primer subidón llegue
 * en la primera partida. Cada nivel cuesta 20 XP más que el anterior.
 * El nivel máximo y el nivel de los bots viven en `../games/shared` para
 * que el servidor (Edge Function) pueda usarlos sin importar este módulo.
 */

/**
 * XP que da ganar una partida, según el modo. Son los mismos números que
 * WIN_REWARDS en economy.ts (las monedas por victoria): la XP y las
 * monedas avanzan juntas, y un empate paga la mitad en ambas.
 */
export const XP_PER_WIN: Record<GameId, number> = {
  casino: 100,
  tresydos: 80,
  robaito: 70,
  cagao: 60,
};

/** Progreso dentro de un nivel: en qué nivel estás y cuánto te falta. */
export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpNeeded: number;
}

/** Resultado de sumar XP: antes y después, y cuántos niveles se cruzaron. */
export interface XpGain {
  totalXp: number;
  gained: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  xpBefore: LevelProgress;
  xpAfter: LevelProgress;
}

/** XP necesaria para pasar del nivel L al L+1; 0 en el nivel máximo. */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  if (level < 1) return xpToNextLevel(1);
  return 100 + 20 * (level - 1);
}

/** En qué nivel estás con `totalXp` XP acumuladas y cuánto llevas del nivel. */
export function levelFromXp(totalXp: number): LevelProgress {
  let remaining = Math.max(0, Math.floor(totalXp) || 0);
  let level = 1;
  while (level < MAX_LEVEL) {
    const needed = xpToNextLevel(level);
    if (remaining < needed) return { level, xpIntoLevel: remaining, xpNeeded: needed };
    remaining -= needed;
    level += 1;
  }
  return { level: MAX_LEVEL, xpIntoLevel: 0, xpNeeded: 0 };
}

/** Fracción 0..1 del nivel actual que llevas recorrida (1 en nivel máximo). */
export function xpProgress(totalXp: number): number {
  const progress = levelFromXp(totalXp);
  if (progress.xpNeeded <= 0) return 1;
  return progress.xpIntoLevel / progress.xpNeeded;
}

/** XP que da una partida según el resultado: victoria completa, empate la mitad, derrota nada. */
export function xpGainForWin(game: GameId, outcome: XpOutcome): number {
  if (outcome === 'loss') return 0;
  const base = XP_PER_WIN[game];
  return outcome === 'tie' ? Math.floor(base / 2) : base;
}

/** Suma `gained` XP a `totalXp` y describe el antes y el después. */
export function addXp(totalXp: number, gained: number): XpGain {
  const before = Math.max(0, Math.floor(totalXp) || 0);
  const gain = Math.max(0, Math.floor(gained) || 0);
  const xpBefore = levelFromXp(before);
  const total = before + gain;
  const xpAfter = levelFromXp(total);
  return {
    totalXp: total,
    gained: gain,
    levelBefore: xpBefore.level,
    levelAfter: xpAfter.level,
    levelsGained: xpAfter.level - xpBefore.level,
    xpBefore,
    xpAfter,
  };
}

/** Un tramo de la animación de la barra: de un porcentaje a otro dentro de un nivel. */
export interface XpPhase {
  level: number;
  fromPct: number;
  toPct: number;
  gainedInSegment: number;
  leveledUp: boolean;
}

/**
 * Plan de animación para una ganancia de XP: un segmento por cada nivel que
 * se atraviesa. El segmento que cruza un nivel termina lleno (toPct 1) y
 * marca leveledUp; el siguiente empieza vacío (fromPct 0). Sin cruzar
 * nivel hay un solo segmento; en el nivel máximo también uno solo, lleno.
 */
export function xpGainPhases(gain: XpGain): XpPhase[] {
  const { xpBefore, xpAfter, gained, levelBefore, levelAfter } = gain;
  const progressBefore = xpBefore.xpNeeded <= 0 ? 1 : xpBefore.xpIntoLevel / xpBefore.xpNeeded;
  const progressAfter = xpAfter.xpNeeded <= 0 ? 1 : xpAfter.xpIntoLevel / xpAfter.xpNeeded;
  // Ya en el nivel máximo antes de ganar la XP: la barra ya está llena,
  // no hay nada que animar. Pero si SE CRUZA el 100 con esta ganancia, el
  // camino normal de abajo sí muestra el estallido de "¡Subiste al nivel 100!".
  if (levelBefore >= MAX_LEVEL) {
    return [{ level: MAX_LEVEL, fromPct: 1, toPct: 1, gainedInSegment: gained, leveledUp: false }];
  }
  if (levelBefore === levelAfter) {
    return [{ level: levelBefore, fromPct: progressBefore, toPct: progressAfter, gainedInSegment: gained, leveledUp: false }];
  }
  const phases: XpPhase[] = [
    {
      level: levelBefore,
      fromPct: progressBefore,
      toPct: 1,
      gainedInSegment: xpBefore.xpNeeded - xpBefore.xpIntoLevel,
      leveledUp: true,
    },
  ];
  for (let level = levelBefore + 1; level < levelAfter; level += 1) {
    phases.push({ level, fromPct: 0, toPct: 1, gainedInSegment: xpToNextLevel(level), leveledUp: true });
  }
  phases.push({
    level: levelAfter,
    fromPct: 0,
    toPct: progressAfter,
    gainedInSegment: xpAfter.xpIntoLevel,
    leveledUp: false,
  });
  return phases;
}
