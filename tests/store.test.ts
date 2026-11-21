import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// La Tienda no se puede renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado en el
// código fuente, como hace waitingRoom.test.ts.
const store = readFileSync('src/components/Store.tsx', 'utf8');

describe('la Tienda baja con scroll bajo una cabecera fija', () => {
  it('el panel tiene una sola zona con scroll y la cabecera fuera de ella', () => {
    assert.ok(store.includes('store-scroll'), 'la zona de scroll tiene su clase');
    assert.ok(store.includes('min-h-0 flex-1 overflow-y-auto'), 'la zona ocupa el resto del panel y baja');
    assert.ok(store.includes('overscroll-contain'), 'el scroll no se escapa al fondo de la app');
    const headerAt = store.indexOf('Tienda');
    const scrollAt = store.indexOf('store-scroll');
    assert.ok(headerAt > 0 && scrollAt > headerAt, 'la cabecera va antes de la zona de scroll');
    assert.ok(!store.includes('grid min-h-0 flex-1'), 'la rejilla ya no es la que baja sola');
  });

  it('la vista previa tiene la forma real de lo que se vende', () => {
    assert.ok(store.includes('aspect-[2.5/3.5] w-24'), 'el dorso se ve como una carta, grande');
    assert.ok(store.includes("aspect-[16/10]"), 'la mesa se ve como un tapete ancho');
    assert.ok(store.includes("aspect-[16/9]"), 'el fondo se ve como una imagen ancha');
    assert.ok(!store.includes('h-20 w-full shrink-0 bg-cover'), 'la banda de 80 px que recortaba el diseño ya no existe');
  });

  it('el precio se ve sobre la vista previa y en el botón de comprar', () => {
    assert.ok(store.includes('absolute right-2 top-2'), 'la insignia de precio vive sobre la vista previa');
    assert.ok(store.includes('Comprar · {item.price}'), 'el botón de comprar lleva el precio');
  });

  it('tocar la tarjeta compra o equipa sin doble toque', () => {
    assert.ok(store.includes('onClick={() => activate(item)}'), 'la vista previa es un botón que activa la tarjeta');
    assert.ok(!store.includes('onDoubleClick'), 'ya no hace falta el doble toque');
    assert.ok(store.includes('aria-label={`${item.label}:'), 'la vista previa anuncia qué hace al tocarla');
  });

  it('el estado se ve a simple vista sobre la vista previa', () => {
    assert.ok(store.includes('Equipado'), 'lo equipado lleva su insignia dorada');
    assert.ok(store.includes('Bloqueado'), 'lo que no alcanza lleva su candado');
  });

  it('cada pestaña dice cuántos diseños tiene', () => {
    assert.ok(store.includes('{items.length} diseños'), 'la pista de la pestaña lleva el conteo');
  });
});
