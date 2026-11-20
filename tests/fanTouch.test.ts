import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRAG_THRESHOLD, resolveActivation, resolveReleaseTarget, wantsDrag } from '../src/components/cagao/fanTouch';

describe('abanico: un toque casi quieto activa la carta pulsada', () => {
  it('con el dedo, soltar sobre la vecina tras derivar unos píxeles activa la pulsada', () => {
    // Se pulsó la c2, el dedo derivó 6 px y al soltar cayó sobre la c3.
    assert.equal(resolveActivation(6, 'touch', 'c2', 'c3'), 'c2');
    assert.equal(resolveActivation(0, 'touch', 'c2', 'c3'), 'c2');
  });

  it('en el límite del umbral sigue siendo un toque', () => {
    assert.equal(resolveReleaseTarget(DRAG_THRESHOLD, 'touch'), 'pressed');
    assert.equal(resolveActivation(DRAG_THRESHOLD, 'touch', 'c2', 'c3'), 'c2');
  });

  it('con el ratón, un clic casi quieto también activa la carta pulsada', () => {
    assert.equal(resolveActivation(4, 'mouse', 'c2', 'c3'), 'c2');
  });
});

describe('abanico: un deslizamiento de verdad activa la carta bajo el dedo', () => {
  it('con el dedo, soltar tras deslizar activa la carta bajo el dedo', () => {
    assert.equal(resolveReleaseTarget(11, 'touch'), 'under-finger');
    assert.equal(resolveActivation(40, 'touch', 'c2', 'c3'), 'c3');
  });

  it('si al soltar no hay carta bajo el dedo, se usa la pulsada', () => {
    assert.equal(resolveActivation(40, 'touch', 'c2', null), 'c2');
  });

  it('el lápiz se comporta como el dedo', () => {
    assert.equal(resolveActivation(6, 'pen', 'c2', 'c3'), 'c2');
    assert.equal(resolveActivation(40, 'pen', 'c2', 'c3'), 'c3');
  });
});

describe('abanico: moverse mucho con el ratón sin arrastrar no activa nada', () => {
  it('un movimiento largo de ratón no es un toque', () => {
    assert.equal(resolveReleaseTarget(11, 'mouse'), 'none');
    assert.equal(resolveActivation(40, 'mouse', 'c2', 'c3'), null);
  });
});

describe('abanico: cuándo un movimiento empieza un arrastre', () => {
  it('con el ratón vale cualquier dirección', () => {
    assert.equal(wantsDrag(20, 0, 'mouse'), true);
    assert.equal(wantsDrag(0, 20, 'mouse'), true);
    assert.equal(wantsDrag(8, 8, 'mouse'), true);
  });

  it('con el dedo, moverse de lado es deslizar por las cartas, no arrastrar', () => {
    assert.equal(wantsDrag(20, 0, 'touch'), false);
    assert.equal(wantsDrag(20, 10, 'touch'), false);
  });

  it('con el dedo, subir hacia la mesa arrastra', () => {
    assert.equal(wantsDrag(0, 20, 'touch'), true);
    assert.equal(wantsDrag(10, 8, 'touch'), true);
    assert.equal(wantsDrag(-5, -12, 'touch'), true);
  });

  it('por debajo del umbral nada es un arrastre', () => {
    assert.equal(wantsDrag(5, 5, 'mouse'), false);
    assert.equal(wantsDrag(5, 5, 'touch'), false);
    assert.equal(wantsDrag(0, DRAG_THRESHOLD, 'touch'), false);
  });
});
