import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  currentTournament,
  isoWeekNumber,
  lastFinishedTournament,
  makeFriendCode,
  matchOutcomes,
  nextTournament,
  pointsFor,
  previousSeasonId,
  prizeForPlace,
  seasonId,
  tournamentAt,
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
} from '../src/games/ranking';
import type { GameState } from '../src/games';

describe('ranking: puntos', () => {
  it('victoria paga el total del juego, empate la mitad y derrota 0', () => {
    assert.equal(pointsFor('casino', 'win'), 100);
    assert.equal(pointsFor('casino', 'tie'), 50);
    assert.equal(pointsFor('casino', 'loss'), 0);
    assert.equal(pointsFor('tresydos', 'win'), 80);
    assert.equal(pointsFor('tresydos', 'tie'), 40);
    assert.equal(pointsFor('robaito', 'win'), 70);
    assert.equal(pointsFor('robaito', 'tie'), 35);
    assert.equal(pointsFor('cagao', 'win'), 60);
    assert.equal(pointsFor('cagao', 'tie'), 30);
  });

  it('el podio paga 500/300/150 y fuera de él 0', () => {
    assert.equal(prizeForPlace(1), 500);
    assert.equal(prizeForPlace(2), 300);
    assert.equal(prizeForPlace(3), 150);
    assert.equal(prizeForPlace(4), 0);
    assert.equal(prizeForPlace(0), 0);
  });
});

describe('ranking: temporadas', () => {
  it('la temporada es el mes en Santo Domingo, no en UTC', () => {
    // 2026-11-01 03:59 UTC todavía es 31 de octubre en la isla.
    assert.equal(seasonId(new Date('2026-11-01T03:59:59Z')), '2026-10');
    assert.equal(seasonId(new Date('2026-11-01T04:00:00Z')), '2026-11');
    assert.equal(seasonId(new Date('2026-12-31T23:00:00Z')), '2026-12');
  });

  it('la temporada anterior cruza el año', () => {
    assert.equal(previousSeasonId(new Date('2026-11-21T12:00:00Z')), '2026-10');
    assert.equal(previousSeasonId(new Date('2026-01-15T12:00:00Z')), '2025-12');
  });
});

describe('ranking: torneos', () => {
  it('la semana ISO del sábado 21 de noviembre de 2026 es la 47', () => {
    assert.equal(isoWeekNumber(new Date('2026-11-21T12:00:00Z')), 47);
    assert.equal(isoWeekNumber(new Date('2026-01-01T12:00:00Z')), 1);
    assert.equal(isoWeekNumber(new Date('2027-01-02T12:00:00Z')), 53);
  });

  it('el juego rota casino -> tresydos -> cagao -> robaito por semana ISO', () => {
    assert.equal(currentTournament(new Date('2026-11-21T12:00:00Z')).game, 'robaito');
    assert.equal(currentTournament(new Date('2026-11-28T12:00:00Z')).game, 'casino');
    assert.equal(currentTournament(new Date('2026-12-05T12:00:00Z')).game, 'tresydos');
    assert.equal(currentTournament(new Date('2026-12-12T12:00:00Z')).game, 'cagao');
  });

  it('la ventana es de sábado 00:00 a domingo 23:59 en Santo Domingo', () => {
    const tournament = currentTournament(new Date('2026-11-28T12:00:00Z'));
    assert.equal(tournament.id, '2026-11-28-casino');
    assert.equal(tournament.startsAt, Date.UTC(2026, 10, 28, 4));
    assert.equal(tournament.endsAt, Date.UTC(2026, 10, 30, 4));
    assert.equal(tournament.status, 'active');
    // Domingo 23:59 AST = lunes 03:59 UTC: todavía activo.
    assert.equal(currentTournament(new Date('2026-11-30T03:59:00Z')).status, 'active');
    // Lunes 00:00 AST = lunes 04:00 UTC: terminado.
    assert.equal(currentTournament(new Date('2026-11-30T04:00:00Z')).status, 'finished');
    // El miércoles, el vigente es el del fin de semana que pasó.
    const wednesday = currentTournament(new Date('2026-12-02T12:00:00Z'));
    assert.equal(wednesday.id, '2026-11-28-casino');
    assert.equal(wednesday.status, 'finished');
  });

  it('tournamentAt solo devuelve el torneo dentro de su ventana', () => {
    assert.ok(tournamentAt(new Date('2026-11-28T12:00:00Z')));
    assert.equal(tournamentAt(new Date('2026-12-02T12:00:00Z')), null);
  });

  it('nextTournament es el del próximo sábado, en estado upcoming', () => {
    const next = nextTournament(new Date('2026-12-02T12:00:00Z'));
    assert.equal(next.id, '2026-12-05-tresydos');
    assert.equal(next.status, 'upcoming');
    assert.equal(next.startsAt, Date.UTC(2026, 11, 5, 4));
  });

  it('lastFinishedTournament es el anterior cuando el vigente está activo', () => {
    const last = lastFinishedTournament(new Date('2026-11-28T12:00:00Z'));
    assert.equal(last.id, '2026-11-21-robaito');
    assert.equal(last.status, 'finished');
    const done = lastFinishedTournament(new Date('2026-12-02T12:00:00Z'));
    assert.equal(done.id, '2026-11-28-casino');
  });
});

describe('ranking: código de amigo', () => {
  it('tiene 6 caracteres del alfabeto sin 0/O/1/I', () => {
    for (let i = 0; i < 20; i++) {
      const code = makeFriendCode();
      assert.equal(code.length, FRIEND_CODE_LENGTH);
      for (const ch of code) assert.ok(FRIEND_CODE_ALPHABET.includes(ch), `carácter ${ch}`);
    }
    assert.notEqual(makeFriendCode(), makeFriendCode());
  });
});

function fakePlayers(count: number) {
  return Array.from({ length: count }, (_, seat) => ({ id: `jugador-${seat}`, name: `J${seat}` }));
}

describe('ranking: ganadores por modo', () => {
  it('Casino: gana el equipo de winnerTeam; sin ganador, empate de todos', () => {
    const won = matchOutcomes({ game: 'casino', players: fakePlayers(4), winnerTeam: 0 } as unknown as GameState);
    assert.deepEqual(
      won.map((o) => o.outcome),
      ['win', 'loss', 'win', 'loss'],
    );
    const tied = matchOutcomes({ game: 'casino', players: fakePlayers(2), winnerTeam: null } as unknown as GameState);
    assert.deepEqual(
      tied.map((o) => o.outcome),
      ['tie', 'tie'],
    );
  });

  it('Tres y Dos: gana winnerSeat', () => {
    const outcomes = matchOutcomes({ game: 'tresydos', players: fakePlayers(3), winnerSeat: 2 } as unknown as GameState);
    assert.deepEqual(
      outcomes.map((o) => o.outcome),
      ['loss', 'loss', 'win'],
    );
  });

  it('El Cagao: pierden solo quien queda con el A♠', () => {
    const outcomes = matchOutcomes({ game: 'cagao', players: fakePlayers(4), loserSeat: 1 } as unknown as GameState);
    assert.deepEqual(
      outcomes.map((o) => o.outcome),
      ['win', 'loss', 'win', 'win'],
    );
  });

  it('El Robaíto: un ganador gana; varios empatan entre ellos', () => {
    const single = matchOutcomes({ game: 'robaito', players: fakePlayers(3), winnerSeats: [1] } as unknown as GameState);
    assert.deepEqual(
      single.map((o) => o.outcome),
      ['loss', 'win', 'loss'],
    );
    const tied = matchOutcomes({ game: 'robaito', players: fakePlayers(4), winnerSeats: [0, 2] } as unknown as GameState);
    assert.deepEqual(
      tied.map((o) => o.outcome),
      ['tie', 'loss', 'tie', 'loss'],
    );
  });
});
