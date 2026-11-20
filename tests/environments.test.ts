import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GAMES } from '../src/games';
import { GAME_ENVIRONMENTS, TABLE_THEMES } from '../src/lib/visualPrefs';

describe('entornos por modo de juego', () => {
  it('cada modo tiene entorno, con mesa sugerida que existe y acento válido', () => {
    for (const game of Object.keys(GAMES) as (keyof typeof GAMES)[]) {
      const env = GAME_ENVIRONMENTS[game];
      assert.ok(env, `sin entorno para ${game}`);
      assert.ok(
        TABLE_THEMES.some((t) => t.id === env.table),
        `la mesa sugerida de ${game} no existe: ${env.table}`,
      );
      assert.match(env.accent, /^#[0-9a-f]{6}$/i, `acento inválido en ${game}`);
    }
  });

  it('cada modo tiene un acento distinto, para que la sala se distinga', () => {
    const accents = Object.values(GAME_ENVIRONMENTS).map((e) => e.accent);
    assert.equal(new Set(accents).size, accents.length);
  });
});
