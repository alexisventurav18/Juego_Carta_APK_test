import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { DEFAULT_VISUAL_PREFS, CARD_BACK_THEMES, MENU_THEMES, TABLE_THEMES } from '../src/lib/visualPrefs';
import { SHOP_ITEMS, shopPrice } from '../src/lib/economy';

/** Arte ilustrado nuevo (vía 2): ids que no existían antes de este cambio. */
const NEW_CARD_BACKS = ['palma-real', 'larimar-mar'];
const NEW_TABLES = ['arena-playa', 'selva', 'atardecer-mesa'];
const NEW_MENUS = ['amanecer-caribe', 'carnaval', 'cafetal'];

// CardAssets.tsx no se puede importar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el código fuente,
// como hace seatPlaque.test.ts con PlayerSeat.tsx.
const cardAssets = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'cagao', 'CardAssets.tsx'),
  'utf8',
);
const cardBackImages = cardAssets.slice(
  cardAssets.indexOf('export const CARD_BACK_IMAGES'),
  cardAssets.indexOf('};', cardAssets.indexOf('export const CARD_BACK_IMAGES')),
);

/** Extrae la ruta de `url("...")` o devuelve null si no es una url. */
function urlPath(image: string): string | null {
  const match = image.match(/^url\("([^"]+)"\)$/);
  return match ? match[1] : null;
}

/** Resuelve una ruta de publicAsset ('/images/...') a un archivo en public/. */
function publicFileExists(assetPath: string): boolean {
  const clean = assetPath.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  const here = dirname(fileURLToPath(import.meta.url));
  return existsSync(join(here, '..', 'public', clean));
}

describe('arte ilustrado nuevo (vía 2)', () => {
  it('los ids nuevos existen en el catálogo y no colisionan entre sí', () => {
    const all = [
      ...CARD_BACK_THEMES.map((t) => t.id),
      ...TABLE_THEMES.map((t) => t.id),
      ...MENU_THEMES.map((t) => t.id),
    ];
    for (const id of [...NEW_CARD_BACKS, ...NEW_TABLES, ...NEW_MENUS]) {
      assert.ok(all.includes(id as never), `id nuevo sin registrar: ${id}`);
    }
    // Sin duplicados dentro de cada catálogo.
    for (const list of [CARD_BACK_THEMES, TABLE_THEMES, MENU_THEMES]) {
      const ids = list.map((t) => t.id);
      assert.equal(new Set(ids).size, ids.length, 'ids duplicados en un catálogo');
    }
    // Sin duplicados en la tienda (categoría + id).
    const keys = SHOP_ITEMS.map((item) => `${item.category}:${item.id}`);
    assert.equal(new Set(keys).size, keys.length, 'artículos duplicados en SHOP_ITEMS');
  });

  it('cada tema del catálogo tiene precio en la tienda', () => {
    for (const theme of CARD_BACK_THEMES) {
      assert.notEqual(shopPrice('cardBack', theme.id), null, `dorso sin precio: ${theme.id}`);
    }
    for (const theme of TABLE_THEMES) {
      assert.notEqual(shopPrice('table', theme.id), null, `mesa sin precio: ${theme.id}`);
    }
    for (const theme of MENU_THEMES) {
      assert.notEqual(shopPrice('menu', theme.id), null, `fondo sin precio: ${theme.id}`);
    }
  });

  it('cada tema con imagen .webp apunta a un archivo que existe en public/', () => {
    for (const theme of [...TABLE_THEMES, ...MENU_THEMES]) {
      const path = urlPath(theme.image);
      if (path && path.endsWith('.webp')) {
        assert.ok(publicFileExists(path), `falta el archivo: ${theme.id} -> ${path}`);
      }
    }
    // Los dorsos .webp se declaran en CARD_BACK_IMAGES con publicAsset('images/...').
    for (const match of cardBackImages.matchAll(/publicAsset\('(images\/[^']+\.webp)'\)/g)) {
      assert.ok(publicFileExists(`/${match[1]}`), `falta el archivo de dorso: ${match[1]}`);
    }
  });

  it('los dorsos nuevos usan .webp y el resto del catálogo de dorsos sigue completo', () => {
    for (const id of NEW_CARD_BACKS) {
      const entry = new RegExp(`'${id}':\\s*` + '`url\\("\\$\\{publicAsset\\(\'images/temas/cartas/[^\']+\\.webp\'\\)\\}"\\)`');
      assert.ok(entry.test(cardBackImages), `el dorso ${id} debe apuntar a un .webp en CARD_BACK_IMAGES`);
    }
    for (const theme of CARD_BACK_THEMES) {
      assert.ok(
        cardBackImages.includes(`'${theme.id}':`) || cardBackImages.includes(`${theme.id}:`),
        `dorso del catálogo sin entrada en CARD_BACK_IMAGES: ${theme.id}`,
      );
    }
  });

  it('los defaults no cambiaron: dorso cacao y menú fiesta-tropical', () => {
    assert.equal(DEFAULT_VISUAL_PREFS.cardBack, 'cacao');
    assert.equal(DEFAULT_VISUAL_PREFS.menu, 'fiesta-tropical');
    assert.equal(DEFAULT_VISUAL_PREFS.table, 'madera');
  });

  it('los precios nuevos usan los tiers existentes (menús 350, mesas 300-350, dorsos 250-300)', () => {
    for (const id of NEW_MENUS) assert.equal(shopPrice('menu', id), 350, `precio de ${id}`);
    for (const id of NEW_TABLES) {
      const price = shopPrice('table', id);
      assert.ok(price === 300 || price === 350, `precio de ${id}: ${price}`);
    }
    for (const id of NEW_CARD_BACKS) {
      const price = shopPrice('cardBack', id);
      assert.ok(price === 250 || price === 300, `precio de ${id}: ${price}`);
    }
  });
});
