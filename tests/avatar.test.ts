import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  avatarFromSeed,
  AVATAR_BACKGROUNDS,
  AVATAR_SECTIONS,
  AVATAR_SECTION_FIELDS,
  ACCESSORY_STYLES,
  BEARD_STYLES,
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
  randomizeAvatarSections,
  seededRandom,
  SHIRT_COLORS,
  type AvatarConfig,
  type AvatarSection,
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

  it('los códigos viejos de 9 números siguen valiendo y toman los valores por defecto', () => {
    const old = 'm3.2.5.1.2.0.1.0.0';
    assert.equal(isAvatarCode(old), true);
    const config = decodeAvatar(old);
    assert.deepEqual(config, {
      gender: 'm',
      skin: 3,
      hairStyle: 2,
      hairColor: 5,
      eyeType: 1,
      eyeColor: 2,
      mouthType: 0,
      mouthColor: 1,
      mustache: 0,
      mustacheColor: 0,
      shirtColor: 0,
      accessory: 0,
      beard: 0,
      background: 0,
    });
    assert.equal(encodeAvatar(config!), 'm3.2.5.1.2.0.1.0.0.0.0.0.0');
  });

  it('los códigos nuevos de 13 números redondean y los de largo intermedio se rechazan', () => {
    const code = 'm5.1.3.2.4.1.0.0.2.3.1.2.5';
    assert.equal(isAvatarCode(code), true);
    const config = decodeAvatar(code);
    assert.ok(config);
    assert.equal(config.shirtColor, 3);
    assert.equal(config.accessory, 1);
    assert.equal(config.beard, 2);
    assert.equal(config.background, 5);
    assert.equal(encodeAvatar(config), code);
    // Una barba en un código femenino se descarta al normalizar.
    assert.equal(decodeAvatar('f5.8.3.2.4.1.0.0.2.3.1.2.5')?.beard, 0);
    for (const bad of ['m3.2.5.1.2.0.1.0.0.0', 'm3.2.5.1.2.0.1.0.0.0.0', 'm3.2.5.1.2.0.1.0.0.0.0.0']) {
      assert.equal(isAvatarCode(bad), false, bad);
      assert.equal(decodeAvatar(bad), null);
    }
  });

  it('el mismo texto da siempre el mismo avatar', () => {
    assert.equal(avatarFromSeed('jugador-1'), avatarFromSeed('jugador-1'));
  });
});

describe('Avatares: campos nuevos', () => {
  it('los catálogos nuevos tienen los tamaños prometidos', () => {
    assert.equal(SHIRT_COLORS.length, 8);
    assert.equal(AVATAR_BACKGROUNDS.length, 6);
    assert.equal(ACCESSORY_STYLES.length, 5);
    assert.equal(BEARD_STYLES.length, 4);
    assert.equal(AVATAR_BACKGROUNDS[0].label, 'Amarillo');
    assert.equal(AVATAR_BACKGROUNDS[5].label, 'Dominicano');
  });

  it('el género femenino nunca tiene barba ni bigote', () => {
    for (let i = 0; i < 300; i++) {
      const c = randomAvatar(seededRandom(`fb${i}`), 'f');
      assert.equal(c.beard, 0);
      assert.equal(c.mustache, 0);
    }
    assert.deepEqual(optionsFor(BEARD_STYLES, 'f').map((o) => o.id), [0]);
    const female = normalizeAvatar({ ...randomAvatar(seededRandom('fbx'), 'm'), gender: 'f', mustache: 5, beard: 2 });
    assert.equal(female.mustache, 0);
    assert.equal(female.beard, 0);
  });

  it('la barba y los accesorios sobreviven al código de ida y vuelta', () => {
    const config: AvatarConfig = {
      gender: 'm',
      skin: 4,
      hairStyle: 1,
      hairColor: 2,
      eyeType: 0,
      eyeColor: 1,
      mouthType: 0,
      mouthColor: 0,
      mustache: 1,
      mustacheColor: 2,
      shirtColor: 3,
      accessory: 3,
      beard: 2,
      background: 5,
    };
    assert.equal(encodeAvatar(config), 'm4.1.2.0.1.0.0.1.2.3.3.2.5');
    assert.deepEqual(decodeAvatar(encodeAvatar(config)), config);
  });
});

describe('Avatares: aleatorio con candados', () => {
  const base: AvatarConfig = {
    gender: 'm',
    skin: 2,
    hairStyle: 1,
    hairColor: 1,
    eyeType: 0,
    eyeColor: 1,
    mouthType: 0,
    mouthColor: 0,
    mustache: 1,
    mustacheColor: 1,
    shirtColor: 2,
    accessory: 1,
    beard: 1,
    background: 3,
  };

  it('con todo bloqueado el avatar no cambia', () => {
    const next = randomizeAvatarSections(base, new Set(AVATAR_SECTIONS), seededRandom('all'));
    assert.deepEqual(next, base);
  });

  it('sin candados equivale a un avatar al azar con la misma semilla', () => {
    const next = randomizeAvatarSections(base, new Set(), seededRandom('eq'));
    assert.deepEqual(next, randomAvatar(seededRandom('eq'), 'm'));
  });

  it('cada sección bloqueada conserva sus campos y las demás se sortean', () => {
    for (const section of AVATAR_SECTIONS) {
      const fields = AVATAR_SECTION_FIELDS[section];
      for (let i = 0; i < 40; i++) {
        const next = randomizeAvatarSections(base, new Set([section]), seededRandom(`lock-${section}-${i}`));
        assert.equal(next.gender, base.gender);
        for (const field of fields) assert.equal(next[field], base[field], `${section}.${field}`);
        assert.ok(isAvatarCode(encodeAvatar(next)));
      }
    }
  });

  it('bloquear varias secciones a la vez también las respeta', () => {
    const locked = new Set<AvatarSection>(['skin', 'shirt', 'background']);
    for (let i = 0; i < 40; i++) {
      const next = randomizeAvatarSections(base, locked, seededRandom(`multi-${i}`));
      assert.equal(next.skin, base.skin);
      assert.equal(next.shirtColor, base.shirtColor);
      assert.equal(next.background, base.background);
    }
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
