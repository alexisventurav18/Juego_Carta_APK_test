import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { CARD_FACE_THEMES, DEFAULT_CARD_FACE, cardFaceTheme } from '../src/lib/cardThemes';
import { CARD_BACK_THEMES, DEFAULT_VISUAL_PREFS } from '../src/lib/visualPrefs';
import { SHOP_ITEMS, shopPrice } from '../src/lib/economy';

/** Temas de baraja nuevos: dorso SVG + cara a juego, sin imágenes. */
const NEW_THEMES = ['carnaval', 'cafetal', 'amanecer-caribe', 'arena-playa', 'selva', 'atardecer'] as const;

/** Temas de carros: siluetas genéricas dibujadas en SVG, sin marcas ni modelos reales. */
const CAR_THEMES = ['concho-clasico', 'velocidad-nocturna', 'aventura-4x4'] as const;

// CardAssets.tsx no se puede importar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el código fuente,
// como hace newArt.test.ts.
const here = dirname(fileURLToPath(import.meta.url));
const cardAssets = readFileSync(join(here, '..', 'src', 'components', 'cagao', 'CardAssets.tsx'), 'utf8');
const cardBackImages = cardAssets.slice(
  cardAssets.indexOf('export const CARD_BACK_IMAGES'),
  cardAssets.indexOf('};', cardAssets.indexOf('export const CARD_BACK_IMAGES')),
);
const playingCard = readFileSync(join(here, '..', 'src', 'components', 'cagao', 'PlayingCard.tsx'), 'utf8');
const appSource = readFileSync(join(here, '..', 'src', 'App.tsx'), 'utf8');
const storeSource = readFileSync(join(here, '..', 'src', 'components', 'Store.tsx'), 'utf8');

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('temas de baraja: dorso + cara', () => {
  it('los 6 temas nuevos y los 3 de carros están en el catálogo de dorsos', () => {
    for (const id of [...NEW_THEMES, ...CAR_THEMES]) {
      assert.ok(
        CARD_BACK_THEMES.some((t) => t.id === id),
        `tema nuevo sin registrar: ${id}`,
      );
    }
    assert.equal(CARD_BACK_THEMES.length, 19);
    assert.equal(SHOP_ITEMS.filter((i) => i.category === 'cardBack').length, 19);
  });

  it('cada dorso tiene cara definida, con los 7 campos y colores válidos', () => {
    for (const theme of CARD_BACK_THEMES) {
      const face = CARD_FACE_THEMES[theme.id];
      assert.ok(face, `dorso sin cara: ${theme.id}`);
      for (const key of ['bg', 'frame', 'red', 'ink', 'accent', 'crestA', 'crestB'] as const) {
        assert.equal(typeof face[key], 'string', `${theme.id}: ${key} no es texto`);
        assert.ok(face[key].length > 0, `${theme.id}: ${key} vacío`);
        assert.ok(
          key === 'frame' ? HEX.test(face[key]) || face[key] === 'transparent' : HEX.test(face[key]),
          `${theme.id}: ${key} no es color válido: ${face[key]}`,
        );
      }
      assert.equal(cardFaceTheme(theme.id), face, `${theme.id}: cardFaceTheme no devuelve su cara`);
    }
  });

  it('el dorso por defecto no cambia: cara crema de siempre', () => {
    assert.equal(DEFAULT_VISUAL_PREFS.cardBack, 'cacao');
    assert.deepEqual(cardFaceTheme('cacao'), DEFAULT_CARD_FACE);
    assert.deepEqual(DEFAULT_CARD_FACE, {
      bg: '#f7ecce',
      frame: 'transparent',
      red: '#b3202a',
      ink: '#1d1b2e',
      accent: '#f1e0b3',
      crestA: '#f8dc84',
      crestB: '#8a5f12',
    });
  });

  it('los temas nuevos cambian la cara (fondo o marco distintos del default)', () => {
    for (const id of NEW_THEMES) {
      const face = cardFaceTheme(id);
      assert.ok(
        face.bg !== DEFAULT_CARD_FACE.bg || face.frame !== DEFAULT_CARD_FACE.frame,
        `tema ${id} con cara igual a la de siempre`,
      );
    }
  });

  it('los dorsos nuevos son SVG en código (sin .webp) y tienen entrada en CARD_BACK_IMAGES', () => {
    for (const id of NEW_THEMES) {
      assert.ok(
        cardBackImages.includes(`'${id}':`) || cardBackImages.includes(`${id}:`),
        `dorso nuevo sin entrada en CARD_BACK_IMAGES: ${id}`,
      );
      assert.ok(
        cardAssets.includes(`BACK_${id.replace(/-/g, '_').toUpperCase()}`),
        `dorso nuevo sin SVG propio: ${id}`,
      );
    }
    // Ningún dorso nuevo apunta a un .webp: el arte viaja por GitHub.
    for (const id of NEW_THEMES) {
      const at = cardBackImages.search(new RegExp(`['"]?${id}['"]?\\s*:`));
      assert.ok(at >= 0, `dorso nuevo sin entrada: ${id}`);
      assert.ok(!cardBackImages.slice(at, at + 160).includes('publicAsset'), `dorso ${id} apunta a imagen`);
    }
  });

  it('los dorsos nuevos cuestan 150 o 250, como los tiers de dorsos', () => {
    for (const id of NEW_THEMES) {
      const price = shopPrice('cardBack', id);
      assert.ok(price === 150 || price === 250, `precio de ${id}: ${price}`);
    }
  });

  it('la cara lee las variables del tema con los valores de siempre como respaldo', () => {
    for (const fallback of [
      'var(--card-face-bg, #f7ecce)',
      'var(--card-face-red, #b3202a)',
      'var(--card-face-ink, #1d1b2e)',
      'var(--card-face-frame, transparent)',
      'var(--card-face-accent, #f1e0b3)',
      'var(--card-face-crest-a, #f8dc84)',
      'var(--card-face-crest-b, #8a5f12)',
    ]) {
      assert.ok(
        playingCard.includes(fallback) || cardAssets.includes(fallback),
        `falta el respaldo de la cara: ${fallback}`,
      );
    }
  });

  it('App.tsx inyecta las 7 variables de la cara del dorso equipado', () => {
    for (const variable of [
      '--card-face-bg',
      '--card-face-frame',
      '--card-face-red',
      '--card-face-ink',
      '--card-face-accent',
      '--card-face-crest-a',
      '--card-face-crest-b',
    ]) {
      assert.ok(appSource.includes(`'${variable}'`), `App no inyecta ${variable}`);
    }
    assert.ok(appSource.includes('cardFaceTheme(visualPrefs.cardBack)'), 'App no usa cardFaceTheme');
  });

  it('la Tienda muestra la cara de muestra de cada dorso, no solo el reverso', () => {
    assert.ok(storeSource.includes('SAMPLE_FACE_CARD'), 'Tienda sin carta de muestra');
    assert.ok(storeSource.includes('<PlayingCard card={SAMPLE_FACE_CARD}'), 'Tienda sin vista previa de cara');
    assert.ok(storeSource.includes('cardFaceTheme(item.id'), 'Tienda no tiñe la muestra con el tema');
  });

  it('los temas de carros tienen dorso SVG propio en código y cara a juego, a 150 o 250', () => {
    for (const id of CAR_THEMES) {
      const face = cardFaceTheme(id);
      assert.ok(face.bg !== DEFAULT_CARD_FACE.bg, `carro ${id} con cara igual a la de siempre`);
      assert.ok(face.frame !== 'transparent', `carro ${id} sin marco en la cara`);
      assert.ok(
        cardBackImages.includes(`'${id}':`) || cardBackImages.includes(`${id}:`),
        `carro sin entrada en CARD_BACK_IMAGES: ${id}`,
      );
      assert.ok(
        cardAssets.includes(`BACK_${id.replace(/-/g, '_').toUpperCase()}`),
        `carro sin SVG propio: ${id}`,
      );
      const at = cardBackImages.search(new RegExp(`['"]?${id}['"]?\\s*:`));
      assert.ok(at >= 0, `carro sin entrada: ${id}`);
      assert.ok(!cardBackImages.slice(at, at + 160).includes('publicAsset'), `carro ${id} apunta a imagen`);
      const price = shopPrice('cardBack', id);
      assert.ok(price === 150 || price === 250, `precio de ${id}: ${price}`);
    }
  });

  it('ningún tema menciona una marca de autos ni un modelo real', () => {
    // Marcas y modelos reales conocidos: ni en nombres, etiquetas, textos ni
    // comentarios del código de temas, dorsos, catálogo y economía. Los
    // dorsos de carros son siluetas genéricas dibujadas en SVG.
    const FORBIDDEN = [
      'ferrari', 'lamborghini', 'porsche', 'ford', 'toyota', 'jeep', 'mustang',
      'chevrolet', 'chevy', 'honda', 'bmw', 'mercedes', 'benz', 'audi', 'nissan',
      'tesla', 'bugatti', 'mclaren', 'bentley', 'maserati', 'subaru', 'mazda',
      'hyundai', 'kia', 'volkswagen', 'vw', 'volvo', 'peugeot', 'renault', 'fiat',
      'jaguar', 'dodge', 'lexus', 'infiniti', 'acura', 'cadillac', 'lincoln',
      'hummer', 'aston', 'lotus', 'alfa', 'romeo', 'corvette', 'camaro',
      'challenger', 'charger', 'wrangler', 'civic', 'corolla', 'camry', 'accord',
      'shelby', 'saleen', 'delorean', 'koenigsegg', 'pagani', 'rimac', 'lucid',
      'rivian', 'polestar', 'byd', 'supra', 'nsx', 'miata', 'cayenne', 'macan',
      'panamera', 'taycan', 'jimny', 'defender', 'discovery', 'evoque', 'beetle',
      'raptor', 'bronco', 'tacoma', 'tundra', 'silverado', 'cherokee', 'compass',
      'renegade', 'gladiator', 'patrol', 'outlander', 'lancer', 'pajero', 'hilux',
      'fortuner', 'yaris', 'prius', 'celica', 'wrx', 'impreza', 'forester',
      'outback', 'elantra', 'sonata', 'tucson', 'palisade', 'telluride', 'sorento',
      'sportage', 'altima', 'sentra', 'maxima', 'murano', 'pathfinder', 'armada',
      'rogue', 'kicks', 'qashqai', 'juke', 'micra', 'clio', 'megane', 'duster',
      'sandero', 'logan', 'golf', 'polo', 'gtr', 'gt-r', '911', 'f-150',
      'land cruiser', 'range rover', 'grand cherokee', '4runner',
    ];
    const sources: [string, string][] = [
      ['cardThemes.ts', readFileSync(join(here, '..', 'src', 'lib', 'cardThemes.ts'), 'utf8')],
      ['CardAssets.tsx', cardAssets],
      ['visualPrefs.ts', readFileSync(join(here, '..', 'src', 'lib', 'visualPrefs.ts'), 'utf8')],
      ['economy.ts', readFileSync(join(here, '..', 'src', 'lib', 'economy.ts'), 'utf8')],
      ['Store.tsx', storeSource],
    ];
    for (const [file, source] of sources) {
      for (const brand of FORBIDDEN) {
        const pattern = new RegExp(`\\b${brand.replace(/-/g, '\\-')}\\b`, 'i');
        assert.ok(!pattern.test(source), `${file} menciona una marca o modelo: ${brand}`);
      }
    }
  });

  it('las caras marcadas se distinguen del clásico y mantienen contraste legible', () => {
    const hexToRgb = (hex: string): [number, number, number] => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
    const distance = (a: string, b: string): number => {
      const [r1, g1, b1] = hexToRgb(a);
      const [r2, g2, b2] = hexToRgb(b);
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    };
    const luminance = (hex: string): number => {
      const linear = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const [r, g, b] = hexToRgb(hex).map(linear);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (fg: string, bg: string): number => {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    // Las caras marcadas (6 temas + 3 carros) se alejan claramente del clásico.
    for (const id of [...NEW_THEMES, ...CAR_THEMES]) {
      const d = distance(cardFaceTheme(id).bg, DEFAULT_CARD_FACE.bg);
      assert.ok(d >= 30, `cara de ${id} poco marcada: distancia ${d.toFixed(1)}`);
    }
    // En todos los temas, tinta negra y roja leen con contraste sobre el fondo.
    for (const theme of CARD_BACK_THEMES) {
      const face = cardFaceTheme(theme.id);
      assert.ok(
        contrast(face.ink, face.bg) >= 4.5,
        `${theme.id}: tinta negra sin contraste (${contrast(face.ink, face.bg).toFixed(2)})`,
      );
      assert.ok(
        contrast(face.red, face.bg) >= 4.5,
        `${theme.id}: tinta roja sin contraste (${contrast(face.red, face.bg).toFixed(2)})`,
      );
    }
  });
});
