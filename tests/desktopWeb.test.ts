import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Las mesas no se pueden renderizar en Node: su cadena de imports usa el
// alias `@/` y el runner tsx no lo resuelve. Se comprueba el marcado y el
// CSS en el código fuente, como hacen lobbyWeb.test.ts y store.test.ts.
const css = readFileSync('src/index.css', 'utf8');
const layout = readFileSync('src/components/table/TableLayout.tsx', 'utf8');
const casino = readFileSync('src/components/CasinoTable.tsx', 'utf8');
const store = readFileSync('src/components/Store.tsx', 'utf8');

// La media query de escritorio grande: ancho Y altura mínima. Un teléfono
// en horizontal mide ~800x360: si la condición fuera solo de ancho, las
// reglas se aplicarían en el APK y romperían la mesa.
const DESKTOP = '@media (min-width: 640px) and (min-height: 600px)';

/**
 * Escritorio grande (navegador): la mesa crece con la ventana. Antes, los
 * topes de cartas pensados para ~360 px de alto dejaban el fieltro grande
 * y vacío y las cartas pequeñas en 1600x900; la Tienda cabía en 3 columnas
 * con scroll para 8 diseños.
 */
describe('escritorio grande: la mesa crece', () => {
  it('la media query exige ancho Y altura mínima (el teléfono queda fuera)', () => {
    assert.ok(css.includes(DESKTOP), 'index.css tiene la media query de escritorio grande');
    // Sin la condición de altura, un teléfono en horizontal (800 px de ancho)
    // entraría en la media query y la mesa se rompería en el APK.
    assert.ok(DESKTOP.includes('min-height: 600px'), 'la condición incluye altura mínima');
    assert.ok(DESKTOP.includes('min-width: 640px'), 'la condición incluye ancho mínimo');
  });

  it('los topes de carta son variables para que el CSS de escritorio los suba', () => {
    assert.ok(layout.includes("'--ch': 'clamp(58px, 23.5dvh, var(--ch-max, 157px))'"), 'la mano usa --ch-max con tope de teléfono 157px');
    assert.ok(layout.includes("'--oh': 'clamp(34px, 12.3dvh, var(--oh-max, 83px))'"), 'los rivales usan --oh-max con tope de teléfono 83px');
    assert.ok(layout.includes("'--ph': 'clamp(45px, 17.9dvh, var(--ph-max, 108px))'"), 'la pila usa --ph-max con tope de teléfono 108px');
    assert.ok(casino.includes("'--ch': 'clamp(54px, 21.3dvh, var(--ch-max, 143px))'"), 'Casino usa --ch-max con su tope propio 143px');
  });

  it('en escritorio los topes suben y el tablero se ensancha', () => {
    const block = css.slice(css.indexOf(DESKTOP));
    assert.ok(block.includes('--ch-max: 208px'), 'la mano sube a 208px en escritorio');
    assert.ok(block.includes('--oh-max: 96px'), 'los rivales suben a 96px en escritorio (antes 104px: la fila superior deja hueco al tablero)');
    assert.ok(block.includes('--ph-max: 148px'), 'la pila sube a 148px en escritorio');
    assert.ok(block.includes('grid-template-rows: auto auto minmax(0, 1fr) 28% !important'), 'la fila de tu zona baja al 28% en escritorio');
    assert.ok(block.includes('height: 36px'), 'la barra de controles baja a 36px en escritorio');
    assert.ok(block.includes('.cu-mano'), 'CartaUI (mano de Casino) tiene regla de escritorio');
    assert.ok(block.includes('13.5rem'), 'la mano de Casino sube a 13.5rem en escritorio');
    assert.ok(block.includes('.cu-mesa'), 'CartaUI (mesa de Casino) tiene regla de escritorio');
    assert.ok(block.includes('12rem'), 'la mesa de Casino sube a 12rem en escritorio');
    assert.ok(block.includes('grid-template-columns: 11% minmax(0, 1fr) 11% !important'), 'las columnas laterales bajan a 11% en escritorio');
  });

  it('la raíz de la mesa y la rejilla tienen su clase de enganche', () => {
    assert.ok(layout.includes('className="table-stage fixed inset-0'), 'la raíz de la mesa lleva .table-stage');
    assert.ok(layout.includes('className="table-grid absolute grid"'), 'la rejilla lleva .table-grid');
  });

  it('Casino respeta su achique de mesa llena también en escritorio', () => {
    // Casino baja --mesa-h-sm a 9.5dvh con la mesa llena; la regla de
    // escritorio de .cu-mesa usa esa variable, no un valor fijo.
    const block = css.slice(css.indexOf(DESKTOP));
    assert.ok(block.includes('var(--mesa-h-sm, 20dvh)'), 'la mesa de Casino sigue leyendo --mesa-h-sm en escritorio');
    assert.ok(block.includes('var(--mano-h-sm, 24dvh)'), 'la mano de Casino sigue leyendo --mano-h-sm en escritorio');
  });
});

describe('escritorio grande: la Tienda usa el ancho', () => {
  it('el panel es más ancho y la rejilla tiene 4 columnas en escritorio', () => {
    assert.ok(store.includes('[@media(min-width:640px)_and_(min-height:600px)]:max-w-4xl'), 'el panel de Tienda sube a max-w-4xl en escritorio');
    assert.ok(store.includes('[@media(min-width:640px)_and_(min-height:600px)]:grid-cols-4'), 'la rejilla de Tienda tiene 4 columnas en escritorio');
    assert.ok(store.includes('max-w-2xl'), 'en teléfono la Tienda sigue en max-w-2xl');
    assert.ok(store.includes('sm:grid-cols-3'), 'en teléfono la rejilla sigue en 3 columnas como mucho');
  });
});
