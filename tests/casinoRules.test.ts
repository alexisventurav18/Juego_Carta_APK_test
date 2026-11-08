import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarJugada,
  crearCarta,
  desdeEstadoCasino,
  grupoSuelto,
  validarJugada,
  type Carta,
  type EstadoMesa,
  type GrupoMesa,
  type Palo,
  type Rango,
} from '../src/games/casinoRules';
import { createCasinoGame } from '../src/games/casino';

const c = (rango: Rango, palo: Palo): Carta => crearCarta(rango, palo);
const suelta = (rango: Rango, palo: Palo): GrupoMesa => grupoSuelto(c(rango, palo));

function grupo(id: string, tipo: 'SUMA' | 'PAR', valor: number, cartas: Carta[], propietarioId: string | null): GrupoMesa {
  return { id, tipo, valorObjetivo: valor, cartas, propietarioId };
}

function estado(mesa: GrupoMesa[], mano: Carta[]): EstadoMesa {
  return { mesa, manos: { ana: mano, luis: [] }, turnoId: 'ana' };
}

describe('validarJugada: reglas del Casino', () => {
  it('1. captura múltiple: con un 8 se lleva un 8 suelto + (5 y 3) + (6 y 2) a la vez', () => {
    const mesa = [suelta('8', 'Corazones'), suelta('5', 'Diamantes'), suelta('3', 'Tréboles'), suelta('6', 'Picas'), suelta('2', 'Corazones')];
    const e = estado(mesa, [c('8', 'Picas'), c('K', 'Picas')]);
    const ids = mesa.map((g) => g.id);

    const r = validarJugada(e, 'ana', '8-Picas', ids, 'CAPTURAR');
    assert.equal(r.valida, true);
    assert.equal(r.combinaciones?.length, 3);
    assert.equal(r.cartasCapturadas?.length, 6); // la carta jugada + las 5 de la mesa

    // Si sobra una carta que no completa ningún grupo de 8, la captura es ilegal.
    const conSobrante = estado([...mesa, suelta('7', 'Picas')], [c('8', 'Picas'), c('K', 'Picas')]);
    const mal = validarJugada(conSobrante, 'ana', '8-Picas', [...ids, '7-Picas'], 'CAPTURAR');
    assert.equal(mal.valida, false);
  });

  it('2. captura dos pares distintos: 8 se lleva dos pares de 4, y un 4 se lleva ambos como dos grupos', () => {
    const parA = grupo('par-a', 'PAR', 4, [c('4', 'Picas'), c('4', 'Corazones')], 'luis');
    const parB = grupo('par-b', 'PAR', 4, [c('4', 'Diamantes'), c('4', 'Tréboles')], 'luis');

    const con8 = validarJugada(estado([parA, parB], [c('8', 'Picas')]), 'ana', '8-Picas', ['par-a', 'par-b'], 'CAPTURAR');
    assert.equal(con8.valida, true);
    assert.deepEqual(con8.combinaciones, [['par-a', 'par-b']]); // un solo subconjunto: 4 + 4 = 8
    assert.equal(con8.cartasCapturadas?.length, 5);

    // Con un 4 en la mano, una suma de 4 (2+2) y un par de 4 se llevan juntos: dos subconjuntos de valor 4.
    const sumaDe4 = grupo('suma-4', 'SUMA', 4, [c('2', 'Picas'), c('2', 'Corazones')], 'luis');
    const parDe4 = grupo('par-4', 'PAR', 4, [c('4', 'Diamantes'), c('4', 'Tréboles')], 'luis');
    const con4 = validarJugada(estado([sumaDe4, parDe4], [c('4', 'Picas')]), 'ana', '4-Picas', ['suma-4', 'par-4'], 'CAPTURAR');
    assert.equal(con4.valida, true);
    assert.equal(con4.combinaciones?.length, 2); // dos subconjuntos, cada uno vale 4
  });

  it('3. ilegal: no se puede sumar encima de un par (par de 4 + un 2 para hacer 6)', () => {
    const par = grupo('par-4', 'PAR', 4, [c('4', 'Picas'), c('4', 'Corazones')], 'luis');
    const e = estado([par], [c('2', 'Tréboles'), c('6', 'Diamantes')]); // tiene el 6 de cierre

    const r = validarJugada(e, 'ana', '2-Tréboles', ['par-4'], 'ARMAR_SUMA');
    assert.equal(r.valida, false);
    assert.match(r.error ?? '', /par/i);

    // Control: con una carta suelta de 4 la misma suma sí es legal.
    const control = estado([suelta('4', 'Picas')], [c('2', 'Tréboles'), c('6', 'Diamantes')]);
    assert.equal(validarJugada(control, 'ana', '2-Tréboles', ['4-Picas'], 'ARMAR_SUMA').valida, true);
  });

  it('4. ilegal: armar una suma sin la carta de cierre en la mano', () => {
    const mesa = [suelta('4', 'Picas')];
    const sinCierre = estado(mesa, [c('3', 'Tréboles'), c('9', 'Diamantes')]); // 3 + 4 = 7, pero no hay 7
    const r = validarJugada(sinCierre, 'ana', '3-Tréboles', ['4-Picas'], 'ARMAR_SUMA');
    assert.equal(r.valida, false);
    assert.match(r.error ?? '', /7/);

    const conCierre = estado(mesa, [c('3', 'Tréboles'), c('7', 'Diamantes')]);
    const ok = validarJugada(conCierre, 'ana', '3-Tréboles', ['4-Picas'], 'ARMAR_SUMA');
    assert.equal(ok.valida, true);
    assert.equal(ok.nuevoGrupoResultante?.tipo, 'SUMA');
    assert.equal(ok.nuevoGrupoResultante?.valorObjetivo, 7);
    assert.equal(ok.nuevoGrupoResultante?.propietarioId, 'ana');
  });

  it('5. cierre de un par acumulado: se dobla dos veces y se cierra llevándose todo', () => {
    const inicial = estado([suelta('5', 'Tréboles')], [c('5', 'Picas'), c('5', 'Corazones'), c('5', 'Diamantes')]);

    // 1.º doblar: 5♠ sobre el 5♣ suelto (queda otro 5 en la mano).
    const paso1 = aplicarJugada(inicial, 'ana', '5-Picas', ['5-Tréboles'], 'HACER_PAR');
    assert.equal(paso1.valida, true);
    if (!paso1.valida) return;
    const par = paso1.estado.mesa[0];
    assert.equal(par.tipo, 'PAR');
    assert.equal(par.cartas.length, 2);

    // 2.º doblar: 5♥ sobre el par ya hecho (todavía conserva el 5♦ para cerrar).
    const paso2 = aplicarJugada(paso1.estado, 'ana', '5-Corazones', [par.id], 'HACER_PAR');
    assert.equal(paso2.valida, true);
    if (!paso2.valida) return;
    const parAcumulado = paso2.estado.mesa[0];
    assert.equal(parAcumulado.cartas.length, 3);
    assert.equal(parAcumulado.valorObjetivo, 5);

    // Cierre: el 5♦ se lleva el par acumulado completo (la carta jugada + 3).
    const cierre = aplicarJugada(paso2.estado, 'ana', '5-Diamantes', [parAcumulado.id], 'CAPTURAR');
    assert.equal(cierre.valida, true);
    if (!cierre.valida) return;
    assert.equal(cierre.resultado.cartasCapturadas?.length, 4);
    assert.equal(cierre.estado.mesa.length, 0);

    // Sin otra carta de 5 en la mano, doblar de nuevo es ilegal.
    const sinRespaldo = estado(paso1.estado.mesa, [c('5', 'Corazones')]);
    const mal = validarJugada(sinRespaldo, 'ana', '5-Corazones', [par.id], 'HACER_PAR');
    assert.equal(mal.valida, false);
  });
});

describe('validarJugada: reglas adicionales', () => {
  it('compromiso: no se puede descartar la carta que cierra tu propia suma, pero sí llevártela', () => {
    const miSuma = grupo('suma-9', 'SUMA', 9, [c('4', 'Picas'), c('5', 'Picas')], 'ana');
    const e = estado([miSuma], [c('2', 'Tréboles'), c('9', 'Diamantes')]);

    assert.equal(validarJugada(e, 'ana', '2-Tréboles', [], 'DESCARTAR').valida, true); // conserva el 9
    const soltar9 = validarJugada(e, 'ana', '9-Diamantes', [], 'DESCARTAR');
    assert.equal(soltar9.valida, false);
    assert.match(soltar9.error ?? '', /cerrarlo/);
    assert.equal(validarJugada(e, 'ana', '9-Diamantes', ['suma-9'], 'CAPTURAR').valida, true);
  });

  it('el As siempre vale 1: con un K se lleva A + Q (1 + 12 = 13) y el As no vale 14', () => {
    const mesa = [suelta('A', 'Corazones'), suelta('Q', 'Diamantes')];
    const conK = estado(mesa, [c('K', 'Picas')]);
    assert.equal(validarJugada(conK, 'ana', 'K-Picas', ['A-Corazones', 'Q-Diamantes'], 'CAPTURAR').valida, true);

    const as14 = estado([suelta('K', 'Corazones')], [c('A', 'Picas')]);
    assert.equal(validarJugada(as14, 'ana', 'A-Picas', ['K-Corazones'], 'CAPTURAR').valida, false);
  });

  it('el adaptador convierte el estado actual del motor al modelo GrupoMesa', () => {
    const juego = createCasinoGame(
      [
        { id: 'u-1', name: 'Ana' },
        { id: 'bot-1', name: 'Bot' },
      ],
      0,
    );
    const modelo = desdeEstadoCasino(juego);
    assert.equal(modelo.mesa.length, 4);
    assert.ok(modelo.mesa.every((g) => g.tipo === 'SUELTA' && g.cartas.length === 1 && g.propietarioId === null));
    assert.equal(modelo.manos['u-1'].length, 4);
    assert.equal(modelo.turnoId, juego.players[juego.turn].id);
  });
});
