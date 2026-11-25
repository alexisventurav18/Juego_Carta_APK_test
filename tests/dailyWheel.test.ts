import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOMINICAN_PALETTE,
  WHEEL_COLORS,
  WHEEL_LABEL_COLORS,
} from '../src/lib/dominicanPalette';
import { DAILY_WHEEL_PRIZES } from '../src/lib/economy';

// Contraste WCAG, calculado aquí de forma independiente (no reutiliza el
// código de la app): luminancia relativa y ratio de contraste.

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('rueda diaria', () => {
  it('cada premio tiene un color distinto, tomado de la paleta dominicana', () => {
    assert.equal(WHEEL_COLORS.length, DAILY_WHEEL_PRIZES.length);
    assert.equal(new Set(WHEEL_COLORS).size, WHEEL_COLORS.length);
    const palette = new Set(Object.values(DOMINICAN_PALETTE));
    for (const color of WHEEL_COLORS) {
      assert.match(color, /^#[0-9A-Fa-f]{6}$/);
      assert.ok(palette.has(color), color);
    }
    // El +250 (mayor) ya no repite el azul del +25: queda en ámbar.
    assert.equal(WHEEL_COLORS[4], DOMINICAN_PALETTE.ambar);
    assert.notEqual(WHEEL_COLORS[4], WHEEL_COLORS[0]);
  });

  it('el texto de cada segmento contrasta al menos 4,5:1 con su fondo', () => {
    assert.equal(WHEEL_LABEL_COLORS.length, WHEEL_COLORS.length);
    WHEEL_COLORS.forEach((bg, i) => {
      const ratio = contrastRatio(bg, WHEEL_LABEL_COLORS[i]);
      assert.ok(ratio >= 4.5, `${bg} con ${WHEEL_LABEL_COLORS[i]}: ${ratio.toFixed(2)}`);
    });
  });

  it('los premios y las probabilidades no cambiaron', () => {
    assert.deepEqual(
      DAILY_WHEEL_PRIZES.map((p) => p.amount),
      [25, 50, 100, 150, 250],
    );
    assert.deepEqual(
      DAILY_WHEEL_PRIZES.map((p) => p.weight),
      [30, 40, 20, 8, 2],
    );
    assert.deepEqual(
      DAILY_WHEEL_PRIZES.map((p) => p.label),
      ['+25', '+50', '+100', '+150', '¡+250!'],
    );
  });
});
