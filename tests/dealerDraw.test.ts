import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEALER_DRAW_INITIAL_MS,
  DEALER_DRAW_MAX_STEP_MS,
  DEALER_DRAW_MIN_STEP_MS,
  dealerDrawDelays,
  dealerDrawHighlight,
  dealerDrawSteps,
  dealerDrawTotalMs,
} from '../src/lib/dealerDraw';

describe('sorteo del repartidor: la curva de tiempos', () => {
  it('da vueltas completas más lo que falta para el repartidor', () => {
    assert.equal(dealerDrawSteps(4, 0), 12);
    assert.equal(dealerDrawSteps(4, 3), 15);
    assert.equal(dealerDrawSteps(2, 1), 11);
    assert.equal(dealerDrawSteps(3, 2), 14);
    assert.equal(dealerDrawSteps(6, 5), 23);
  });

  it('el último paso aterriza en el repartidor', () => {
    for (let players = 2; players <= 6; players++) {
      for (let dealer = 0; dealer < players; dealer++) {
        const steps = dealerDrawSteps(players, dealer);
        assert.equal(dealerDrawHighlight(players, steps), dealer, `${players} jugadores, reparte ${dealer}`);
      }
    }
  });

  it('las demoras crecen paso a paso (frena, no acelera)', () => {
    for (let players = 2; players <= 6; players++) {
      for (let dealer = 0; dealer < players; dealer++) {
        const delays = dealerDrawDelays(players, dealer);
        assert.equal(delays.length, dealerDrawSteps(players, dealer) - 1);
        for (let i = 1; i < delays.length; i++) {
          assert.ok(delays[i] >= delays[i - 1], `paso ${i} no debe ser más rápido que el ${i - 1}`);
        }
        // La frenada se nota: el último salto dura al menos el doble que el primero.
        assert.ok(
          delays[delays.length - 1] >= delays[0] * 2,
          `último salto (${delays[delays.length - 1]} ms) debe durar al menos el doble que el primero (${delays[0]} ms)`,
        );
      }
    }
  });

  it('cada demora está entre el mínimo y el máximo', () => {
    for (let players = 2; players <= 6; players++) {
      for (let dealer = 0; dealer < players; dealer++) {
        for (const delay of dealerDrawDelays(players, dealer)) {
          assert.ok(delay >= DEALER_DRAW_MIN_STEP_MS && delay <= DEALER_DRAW_MAX_STEP_MS, `${delay} ms fuera de rango`);
        }
      }
    }
  });

  it('la duración total ronda los 3,5-4,5 s con 2 a 6 jugadores', () => {
    for (let players = 2; players <= 6; players++) {
      for (let dealer = 0; dealer < players; dealer++) {
        const total = dealerDrawTotalMs(players, dealer);
        assert.ok(total >= 3300 && total <= 4500, `${players} jugadores, reparte ${dealer}: ${total} ms`);
      }
    }
    // El caso típico (4 jugadores) queda en el centro del rango.
    assert.ok(dealerDrawTotalMs(4, 3) >= 3500 && dealerDrawTotalMs(4, 3) <= 4300);
  });

  it('la pausa inicial es corta y forma parte del total', () => {
    assert.equal(DEALER_DRAW_INITIAL_MS, 250);
    const delays = dealerDrawDelays(4, 2);
    assert.equal(
      dealerDrawTotalMs(4, 2),
      DEALER_DRAW_INITIAL_MS + delays.reduce((sum, d) => sum + d, 0),
    );
  });
});
