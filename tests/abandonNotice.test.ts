import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostSeat, type Player } from '../src/games/shared';
import { abandonNoticeText, detectAbandonedPlayers } from '../src/lib/abandonedPlayers';

const human = (id: string, name: string): Player => ({ id, name });
const bot = (n: number): Player => ({ id: `bot-${n}`, name: `Bot ${n}` });

describe('anfitrión efectivo (hostSeat)', () => {
  it('mientras el asiento 0 siga siendo humano, el anfitrión es él', () => {
    assert.equal(hostSeat([human('a', 'Ana'), human('b', 'Beto')]), 0);
    assert.equal(hostSeat([human('a', 'Ana')]), 0);
  });

  it('si el asiento 0 lo ocupa un bot, hereda el primer humano que queda', () => {
    assert.equal(hostSeat([bot(1), human('b', 'Beto')]), 1);
    assert.equal(hostSeat([bot(1), bot(2), human('c', 'Carla')]), 2);
  });

  it('sin humanos, devuelve 0', () => {
    assert.equal(hostSeat([bot(1), bot(2)]), 0);
    assert.equal(hostSeat([]), 0);
  });
});

describe('detección de abandono (detectAbandonedPlayers)', () => {
  it('en la primera carga no hay nada que detectar', () => {
    assert.deepEqual(detectAbandonedPlayers(null, [human('a', 'Ana'), human('b', 'Beto')]), []);
  });

  it('sin cambios no avisa', () => {
    const prev = [human('a', 'Ana'), human('b', 'Beto')];
    assert.deepEqual(detectAbandonedPlayers(prev, [...prev]), []);
  });

  it('detecta al humano sustituido por un bot en su mismo asiento', () => {
    assert.deepEqual(
      detectAbandonedPlayers([human('a', 'Ana'), human('b', 'Beto')], [bot(1), human('b', 'Beto')]),
      ['Ana'],
    );
    assert.deepEqual(
      detectAbandonedPlayers([human('a', 'Ana'), human('b', 'Beto')], [human('a', 'Ana'), bot(1)]),
      ['Beto'],
    );
  });

  it('detecta varios abandonos a la vez', () => {
    assert.deepEqual(
      detectAbandonedPlayers(
        [human('a', 'Ana'), human('b', 'Beto'), human('c', 'Carla')],
        [human('a', 'Ana'), bot(1), bot(2)],
      ),
      ['Beto', 'Carla'],
    );
  });

  it('no confunde añadir bots al final (matchmaking) con un abandono', () => {
    assert.deepEqual(
      detectAbandonedPlayers([human('a', 'Ana')], [human('a', 'Ana'), bot(1), bot(2)]),
      [],
    );
  });

  it('no confunde que un humano salga de una sala en espera (los demás se recorren)', () => {
    assert.deepEqual(detectAbandonedPlayers([human('a', 'Ana'), human('b', 'Beto')], [human('b', 'Beto')]), []);
  });
});

describe('texto del aviso de abandono (abandonNoticeText)', () => {
  it('un jugador', () => {
    assert.equal(abandonNoticeText(['Ana']), 'Ana abandonó la partida. Un bot ocupa su lugar.');
  });

  it('dos jugadores', () => {
    assert.equal(
      abandonNoticeText(['Ana', 'Beto']),
      'Ana y Beto abandonaron la partida. Un bot ocupa el lugar de cada uno.',
    );
  });

  it('tres jugadores', () => {
    assert.equal(
      abandonNoticeText(['Ana', 'Beto', 'Carla']),
      'Ana, Beto y Carla abandonaron la partida. Un bot ocupa el lugar de cada uno.',
    );
  });
});
