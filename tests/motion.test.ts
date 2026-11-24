import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { GAMES } from '../src/games';
import type { GameId } from '../src/games/shared';
import { isValidHex } from '../src/lib/dominicanPalette';
import {
  COIN_RAIN_COUNT,
  getMotionConfig,
  getMotionConfigForAccent,
  MAX_AMBIENT_PARTICLES,
  MIN_AMBIENT_PARTICLES,
  MOTION_CONFIGS,
} from '../src/lib/motion';
import { GAME_ENVIRONMENTS } from '../src/lib/visualPrefs';

const GAME_IDS = Object.keys(GAMES) as GameId[];
const AMBIENT_KINDS = ['sparkles', 'bubbles', 'embers', 'drops'];

/** Extrae el cuerpo de un bloque `@keyframes <nombre>` contando llaves. */
function keyframeBody(css: string, name: string): string | null {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start < 0) return null;
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

const MOTION_CSS = readFileSync(new URL('../src/motion.css', import.meta.url), 'utf8');
/** El CSS sin comentarios: las reglas se comprueban sobre el código, no sobre la prosa. */
const MOTION_CSS_CODE = MOTION_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('config de movimiento por modo (MOTION_CONFIGS)', () => {
  it('cada modo tiene config válida: tipo distinto, acento de la paleta y pocas partículas', () => {
    for (const game of GAME_IDS) {
      const config = getMotionConfig(game);
      assert.equal(config.game, game);
      assert.ok(AMBIENT_KINDS.includes(config.kind), `tipo inválido en ${game}: ${config.kind}`);
      assert.ok(isValidHex(config.accent), `acento inválido en ${game}: ${config.accent}`);
      assert.equal(
        config.accent,
        GAME_ENVIRONMENTS[game].accent,
        `el acento de ${game} no coincide con su entorno de mesa`,
      );
      assert.ok(
        config.particleCount >= MIN_AMBIENT_PARTICLES && config.particleCount <= MAX_AMBIENT_PARTICLES,
        `partículas fuera de límite en ${game}: ${config.particleCount}`,
      );
      assert.ok(config.minDurationS > 0 && config.maxDurationS > config.minDurationS, `duración inválida en ${game}`);
    }
  });

  it('cada modo tiene un tipo de partícula y un acento distintos', () => {
    assert.equal(new Set(Object.values(MOTION_CONFIGS).map((c) => c.kind)).size, GAME_IDS.length);
    assert.equal(new Set(Object.values(MOTION_CONFIGS).map((c) => c.accent)).size, GAME_IDS.length);
  });

  it('el acento del modo resuelve su config; uno desconocido o ausente no rompe nada', () => {
    for (const game of GAME_IDS) {
      assert.equal(getMotionConfigForAccent(GAME_ENVIRONMENTS[game].accent).game, game);
    }
    assert.equal(getMotionConfigForAccent('#ff0000').game, 'casino');
    assert.equal(getMotionConfigForAccent(undefined).game, 'casino');
  });

  it('la lluvia de monedas trae 20-24 monedas', () => {
    assert.ok(COIN_RAIN_COUNT >= 20 && COIN_RAIN_COUNT <= 24, `monedas: ${COIN_RAIN_COUNT}`);
  });
});

describe('motion.css: seguridad y movimiento reducido', () => {
  it('existe el bloque de prefers-reduced-motion que apaga todas las animaciones nuevas', () => {
    const mediaAt = MOTION_CSS.indexOf('@media (prefers-reduced-motion: reduce)');
    assert.ok(mediaAt >= 0, 'falta el bloque @media (prefers-reduced-motion: reduce)');
    const block = MOTION_CSS.slice(mediaAt);
    for (const cls of [
      '.ambient-sparkles',
      '.ambient-bubbles',
      '.ambient-embers',
      '.ambient-drops',
      '.coin-rain-piece',
      '.capture-glow',
    ]) {
      assert.ok(block.includes(cls), `reduced-motion no apaga ${cls}`);
    }
    assert.ok(block.includes('animation: none'), 'reduced-motion no pone animation: none');
  });

  it('las capas decorativas usan pointer-events none', () => {
    for (const cls of ['.ambient-layer', '.ambient-particle', '.coin-rain-layer', '.coin-rain-piece', '.capture-glow']) {
      const rule = new RegExp(`\\${cls}\\s*\\{[^}]*pointer-events:\\s*none`, 's');
      assert.ok(rule.test(MOTION_CSS), `${cls} no tiene pointer-events: none`);
    }
  });

  it('existen los keyframes de cada ambiente, de la lluvia y del brillo de captura', () => {
    for (const name of [
      'ambient-sparkle-rise',
      'ambient-bubble-float',
      'ambient-ember-rise',
      'ambient-drop-fall',
      'coin-fall',
      'capture-glow-pulse',
    ]) {
      assert.ok(keyframeBody(MOTION_CSS, name) !== null, `falta @keyframes ${name}`);
    }
  });

  it('los keyframes solo animan transform y opacity (nada de layout, filtro ni sombra)', () => {
    const forbidden = ['width', 'height', 'top:', 'left:', 'margin', 'padding', 'box-shadow', 'filter'];
    for (const name of [
      'ambient-sparkle-rise',
      'ambient-bubble-float',
      'ambient-ember-rise',
      'ambient-drop-fall',
      'coin-fall',
      'capture-glow-pulse',
    ]) {
      const body = keyframeBody(MOTION_CSS, name);
      assert.ok(body !== null, `falta @keyframes ${name}`);
      for (const prop of forbidden) {
        assert.ok(!body.includes(prop), `@keyframes ${name} anima ${prop}`);
      }
    }
    assert.ok(!MOTION_CSS_CODE.includes('will-change'), 'motion.css usa will-change');
    assert.ok(!MOTION_CSS_CODE.includes('filter:'), 'motion.css usa filter');
  });
});
