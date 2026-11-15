import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  avatarFromSeed,
  decodeAvatar,
  encodeAvatar,
  EYE_TYPES,
  HAIR_STYLES,
  isAvatarCode,
  MOUTH_TYPES,
  MUSTACHE_STYLES,
  normalizeAvatar,
  optionsFor,
  randomAvatar,
  seededRandom,
} from '../src/games/avatar';
import { createSoloPlayers } from '../src/games';

describe('Avatares: códigos', () => {
  it('codifica y decodifica sin perder datos', () => {
    for (let i = 0; i < 200; i++) {
      const config = randomAvatar(seededRandom(`t${i}`));
      const code = encodeAvatar(config);
      assert.ok(isAvatarCode(code), code);
      assert.deepEqual(decodeAvatar(code), config);
    }
  });

  it('rechaza textos que no son un avatar', () => {
    for (const bad of ['', 'x3.1.1.1.1.1.1.1.1', 'm3.1.1', 'm3.1.1.1.1.1.1.1.1.1', 'm3.a.1.1.1.1.1.1.1', 42, null, undefined, 'm100.1.1.1.1.1.1.1.1']) {
      assert.equal(isAvatarCode(bad), false, String(bad));
      assert.equal(decodeAvatar(bad), null);
    }
  });

  it('corrige índices fuera del catálogo en vez de romper', () => {
    const config = decodeAvatar('m99.99.99.99.99.99.99.99.99');
    assert.ok(config);
    assert.ok(config.skin < 8 && config.hairColor < 11);
    assert.ok(optionsFor(HAIR_STYLES, 'm').some((o) => o.id === config.hairStyle));
  });

  it('el mismo texto da siempre el mismo avatar', () => {
    assert.equal(avatarFromSeed('jugador-1'), avatarFromSeed('jugador-1'));
  });
});

describe('Avatares: filtro por género', () => {
  it('cada género solo recibe estilos que le corresponden', () => {
    for (let i = 0; i < 300; i++) {
      for (const gender of ['m', 'f'] as const) {
        const c = randomAvatar(seededRandom(`g${gender}${i}`), gender);
        assert.equal(c.gender, gender);
        for (const [catalog, id] of [
          [HAIR_STYLES, c.hairStyle],
          [EYE_TYPES, c.eyeType],
          [MOUTH_TYPES, c.mouthType],
          [MUSTACHE_STYLES, c.mustache],
        ] as const) {
          assert.ok(optionsFor(catalog, gender).some((o) => o.id === id), `${gender} ${id}`);
        }
      }
    }
  });

  it('el género femenino nunca tiene bigote', () => {
    for (let i = 0; i < 300; i++) assert.equal(randomAvatar(seededRandom(`f${i}`), 'f').mustache, 0);
    assert.deepEqual(optionsFor(MUSTACHE_STYLES, 'f').map((o) => o.id), [0]);
  });

  it('al cambiar de género se descarta lo que no existe para el nuevo', () => {
    const male = normalizeAvatar({ ...randomAvatar(seededRandom('x'), 'm'), hairStyle: 4, mustache: 5, eyeType: 4, mouthType: 6 });
    const female = normalizeAvatar({ ...male, gender: 'f' });
    assert.equal(female.mustache, 0);
    assert.ok(optionsFor(HAIR_STYLES, 'f').some((o) => o.id === female.hairStyle));
    assert.ok(optionsFor(EYE_TYPES, 'f').some((o) => o.id === female.eyeType));
    assert.ok(optionsFor(MOUTH_TYPES, 'f').some((o) => o.id === female.mouthType));
  });
});

describe('Avatares: bots y salas', () => {
  it('los bots reciben un avatar válido y cada juego respeta su número de jugadores', () => {
    const players = createSoloPlayers('cagao', { id: 'h', name: 'Yo' }, 6);
    assert.equal(players.length, 6);
    for (const bot of players.slice(1)) assert.ok(isAvatarCode(bot.avatar), bot.name);
    assert.equal(new Set(players.map((p) => p.name)).size, 6);
  });
});
