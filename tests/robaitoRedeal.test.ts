import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGameState } from '../src/games';
import { robaitoBotMove } from '../src/games/bots';
import { dealIntroMs, isHandCardDealt, isTableCardDealt } from '../src/games/dealTiming';
import { HAND_SIZE, TABLE_SIZE, type RobaitoState } from '../src/games/robaito';
import type { Player } from '../src/games/shared';

/**
 * Regresión del reparto de El Robaíto tras la primera mano (reportado por Alexis 2026-11-25):
 * las cartas nuevas aparecían ya completas en la mano y la animación de reparto llegaba después.
 *
 * Causa raíz: la mesa claveaba el intro de reparto en `roundNo`, que en El Robaíto es siempre 1
 * (no hay rondas); las manos nuevas suben `dealNo`. El intro nunca se reiniciaba, así que
 * `dealing` ya era falso al llegar el reparto y nada escondía las cartas nuevas. La mesa ahora
 * se clavea en `dealNo` y en los repartos 2+ no se pone nada en la mesa (la mesa queda como está).
 *
 * Lo que se testea aquí es la lógica que alimenta la animación (el motor y las reglas de
 * revelado puras de dealTiming): que el motor entrega las manos completas al instante —por eso
 * la mesa DEBE esconderlas hasta que les toque— y que el revelado es carta a carta. Que la mesa
 * use `dealNo` como clave se verifica visualmente con el harness (autoplay, web-shots/reparto-robaito/).
 */

function players(count: number): Player[] {
  const names = ['Yo', 'Daniela', 'Valentina', 'Sebastián'];
  return names.slice(0, count).map((name, i) => ({ id: i === 0 ? 'yo' : `bot-${i}`, name }));
}

/** Juega con bots hasta que se reparta la segunda mano (o se acabe la partida). */
function playUntilRedeal(count: number): RobaitoState {
  let state = createGameState('robaito', players(count)) as RobaitoState;
  let steps = 0;
  while (state.phase === 'playing' && state.dealNo === 1 && steps < 200) {
    steps++;
    const result = robaitoBotMove(state);
    assert.ok(!('error' in result), `jugada de bot ${steps}: ${'error' in result ? result.error : ''}`);
    state = result.state;
  }
  return state;
}

describe('El Robaíto: reparto de manos nuevas', () => {
  it('al acabarse la primera mano se reparten 4 nuevas a cada uno: dealNo sube y roundNo sigue en 1', () => {
    const state = playUntilRedeal(4);
    assert.equal(state.dealNo, 2, 'la segunda mano debe subir dealNo a 2');
    assert.equal(state.roundNo, 1, 'roundNo es siempre 1 en El Robaíto: no sirve como clave del reparto');
    assert.ok(state.lastEvent?.redeal, 'el evento de la jugada que vació las manos marca redeal');
  });

  it('el motor entrega las manos nuevas completas al instante: la mesa debe esconderlas hasta revelarlas', () => {
    const state = playUntilRedeal(4);
    assert.equal(state.dealNo, 2);
    for (let s = 0; s < 4; s++) {
      assert.equal(state.hands[s].length, HAND_SIZE, `el asiento ${s} ya tiene sus 4 cartas en el estado`);
    }
    assert.ok(state.deck.length < 52 - TABLE_SIZE - 4 * HAND_SIZE, 'el mazo ya descontó el reparto nuevo');
  });

  it('con 2 jugadores también hay segunda mano', () => {
    const state = playUntilRedeal(2);
    assert.equal(state.dealNo, 2);
    assert.equal(state.roundNo, 1);
    assert.equal(state.hands[0].length, HAND_SIZE);
    assert.equal(state.hands[1].length, HAND_SIZE);
  });
});

describe('revelado carta a carta del reparto (dealTiming)', () => {
  it('primer reparto: las manos se revelan por rondas de asientos y la mesa después de las manos', () => {
    const seats = 4;
    // Nada revelado: ni manos ni mesa.
    assert.equal(isHandCardDealt(0, seats, 0, 0), false);
    assert.equal(isTableCardDealt(0, seats, HAND_SIZE, TABLE_SIZE, 0), false);
    // Primer paso: solo la carta 0 del asiento 0.
    assert.equal(isHandCardDealt(1, seats, 0, 0), true);
    assert.equal(isHandCardDealt(1, seats, 1, 0), false);
    assert.equal(isHandCardDealt(1, seats, 0, 1), false);
    // 4 pasos: una carta por asiento, nadie tiene la segunda.
    for (let s = 0; s < seats; s++) assert.equal(isHandCardDealt(4, seats, s, 0), true);
    for (let s = 0; s < seats; s++) assert.equal(isHandCardDealt(4, seats, s, 1), false);
    // Manos completas (16 pasos) pero mesa aún oculta.
    for (let s = 0; s < seats; s++) assert.equal(isHandCardDealt(16, seats, s, 3), true);
    assert.equal(isTableCardDealt(16, seats, HAND_SIZE, TABLE_SIZE, 0), false);
    // La mesa se revela una a una después de las manos.
    assert.equal(isTableCardDealt(17, seats, HAND_SIZE, TABLE_SIZE, 0), true);
    assert.equal(isTableCardDealt(17, seats, HAND_SIZE, TABLE_SIZE, 1), false);
    assert.equal(isTableCardDealt(20, seats, HAND_SIZE, TABLE_SIZE, 3), true);
  });

  it('reparto de manos nuevas (cardsOnTable 0): la mesa nunca se oculta y las manos se revelan igual', () => {
    const seats = 4;
    // Con 0 cartas a la mesa, las cartas que ya hay se ven durante todo el reparto.
    for (const revealed of [0, 1, 8, 16]) {
      assert.equal(isTableCardDealt(revealed, seats, HAND_SIZE, 0, 0), true);
      assert.equal(isTableCardDealt(revealed, seats, HAND_SIZE, 0, 3), true);
    }
    // Y las manos nuevas se revelan carta a carta, en el mismo orden que el primer reparto.
    assert.equal(isHandCardDealt(0, seats, 0, 0), false);
    assert.equal(isHandCardDealt(1, seats, 0, 0), true);
    assert.equal(isHandCardDealt(6, seats, 1, 1), true);
    assert.equal(isHandCardDealt(5, seats, 2, 1), false);
    assert.equal(isHandCardDealt(16, seats, 3, 3), true);
  });

  it('duración del reparto de manos nuevas: barajar + 4 cartas por asiento, sin cartas a la mesa', () => {
    // 4 jugadores: 800 ms de barajar + 17 pasos de 280 ms = 5560 ms.
    assert.equal(dealIntroMs(4, HAND_SIZE, 0), 5560);
    assert.equal(dealIntroMs(2, HAND_SIZE, 0), 3320);
    assert.ok(dealIntroMs(4, HAND_SIZE, 0) < dealIntroMs(4, HAND_SIZE, TABLE_SIZE));
  });
});
