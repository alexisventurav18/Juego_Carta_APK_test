import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MUSIC_THEMES, MUSIC_THEME_IDS, themeForGame, type MusicThemeId } from '../src/lib/musicThemes';

/**
 * Pruebas de los temas de la música de fondo: los 5 temas existen, sus parámetros están en rangos
 * válidos y suaves, y cada modo de juego elige el tema que le toca. El programador (music.ts) no se
 * prueba aquí porque necesita un AudioContext real.
 */

const ALL_IDS: MusicThemeId[] = ['lobby', 'casino', 'tresydos', 'cagao', 'robaito'];

describe('temas de música de fondo', () => {
  it('existen los 5 temas: menú y un tema por modo', () => {
    assert.deepEqual([...MUSIC_THEME_IDS].sort(), [...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      const theme = MUSIC_THEMES[id];
      assert.equal(theme.id, id);
      assert.ok(theme.name.length > 0);
    }
  });

  it('todos los parámetros están en rangos válidos y suaves', () => {
    for (const id of ALL_IDS) {
      const theme = MUSIC_THEMES[id];
      assert.ok(theme.bpm >= 60 && theme.bpm <= 140, `${id}: bpm ${theme.bpm}`);
      assert.ok(theme.chords.length >= 2, `${id}: al menos 2 acordes`);
      for (const chord of theme.chords) {
        assert.ok(chord.root >= 21 && chord.root <= 108, `${id}: raíz ${chord.root}`);
        assert.ok(chord.notes.length >= 3, `${id}: al menos 3 notas por acorde`);
        assert.equal(new Set(chord.notes).size, chord.notes.length, `${id}: notas repetidas`);
        for (const note of chord.notes) {
          assert.ok(note >= 21 && note <= 108, `${id}: nota ${note}`);
        }
      }
      assert.equal(theme.arpeggio.length, theme.stepsPerChord, `${id}: arpegio y pasos por acorde`);
      assert.ok(theme.stepsPerChord >= 4, `${id}: pasos por acorde`);
      for (const index of theme.arpeggio) {
        assert.ok(index >= 0 && index < theme.chords[0].notes.length, `${id}: índice ${index}`);
      }
      assert.ok(theme.wave === 'triangle' || theme.wave === 'sine', `${id}: onda ${theme.wave}`);
      // Más suave que el tema único anterior (arpegio 0.16, bajo 0.26, güiro 0.05).
      assert.ok(theme.pluckVol > 0 && theme.pluckVol <= 0.12, `${id}: arpegio ${theme.pluckVol}`);
      assert.ok(theme.bassVol > 0 && theme.bassVol <= 0.18, `${id}: bajo ${theme.bassVol}`);
      assert.ok(theme.guiraVol >= 0 && theme.guiraVol <= 0.03, `${id}: güiro ${theme.guiraVol}`);
      assert.ok(theme.pluckCutoff >= 800 && theme.pluckCutoff <= 3000, `${id}: filtro ${theme.pluckCutoff}`);
      assert.ok(theme.attack >= 0.005 && theme.attack <= 0.1, `${id}: ataque ${theme.attack}`);
      assert.ok(theme.pluckLen >= 1 && theme.pluckLen <= 4, `${id}: duración ${theme.pluckLen}`);
    }
  });

  it('los temas se distinguen entre sí (tempo o acordes)', () => {
    const bpms = new Set(ALL_IDS.map((id) => MUSIC_THEMES[id].bpm));
    assert.ok(bpms.size >= 4, 'casi cada tema tiene su propio tempo');
    const progressions = new Set(ALL_IDS.map((id) => JSON.stringify(MUSIC_THEMES[id].chords)));
    assert.ok(progressions.size >= 4, 'casi cada tema tiene su propia progresión');
  });

  it('Casino no tiene güiro y suena con onda seno, lento y cálido', () => {
    const theme = MUSIC_THEMES.casino;
    assert.equal(theme.guiraVol, 0);
    assert.equal(theme.wave, 'sine');
    assert.ok(theme.bpm <= 90);
    assert.ok(theme.attack >= 0.05);
  });

  it('El Robaíto es el más rápido y brillante', () => {
    const theme = MUSIC_THEMES.robaito;
    assert.ok(theme.bpm >= 110);
    assert.ok(theme.pluckCutoff >= 2000);
    assert.ok(theme.guiraVol > 0);
  });

  it('El Cagao es staccato suave', () => {
    const theme = MUSIC_THEMES.cagao;
    assert.ok(theme.pluckLen < 2);
    assert.ok(theme.pluckVol <= 0.11);
  });

  it('cada modo de juego elige su tema y sin juego suena el del menú', () => {
    assert.equal(themeForGame('casino'), 'casino');
    assert.equal(themeForGame('tresydos'), 'tresydos');
    assert.equal(themeForGame('cagao'), 'cagao');
    assert.equal(themeForGame('robaito'), 'robaito');
    assert.equal(themeForGame(null), 'lobby');
    assert.equal(themeForGame(undefined), 'lobby');
  });
});
