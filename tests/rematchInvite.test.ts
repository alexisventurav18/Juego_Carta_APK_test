import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedRematchSender, isValidRematchInvite, type RematchInvite } from '../src/lib/roomRematch';
import type { Player } from '../src/games/shared';

const GOOD: RematchInvite = {
  code: 'K7X2Q',
  game: 'casino',
  fromId: 'jugador-ana-0001',
  fromName: 'Ana',
  at: 1793123456789,
};

describe('invitación a la revancha: validación en recepción', () => {
  it('acepta una invitación con forma válida', () => {
    assert.equal(isValidRematchInvite(GOOD), true);
  });

  it('rechaza códigos que no son de sala', () => {
    assert.equal(isValidRematchInvite({ ...GOOD, code: 'k7x2q' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, code: 'K7' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, code: 'K7X2Q!' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, code: '' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, code: 12345 }), false);
  });

  it('rechaza juegos que no existen', () => {
    assert.equal(isValidRematchInvite({ ...GOOD, game: 'poker' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, game: '' }), false);
  });

  it('rechaza remitentes bot o vacíos', () => {
    assert.equal(isValidRematchInvite({ ...GOOD, fromId: 'bot-1' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromId: 'BOT-2' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromId: '' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromId: '   ' }), false);
  });

  it('rechaza nombres vacíos o más largos que el límite del servidor (24)', () => {
    assert.equal(isValidRematchInvite({ ...GOOD, fromName: '' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromName: '   ' }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromName: 'A'.repeat(25) }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, fromName: 'A'.repeat(24) }), true);
  });

  it('rechaza marcas de tiempo inválidas', () => {
    assert.equal(isValidRematchInvite({ ...GOOD, at: 0 }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, at: -1 }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, at: Number.NaN }), false);
    assert.equal(isValidRematchInvite({ ...GOOD, at: 'ahora' }), false);
  });

  it('rechaza lo que no es un objeto', () => {
    assert.equal(isValidRematchInvite(null), false);
    assert.equal(isValidRematchInvite(undefined), false);
    assert.equal(isValidRematchInvite('revancha'), false);
    assert.equal(isValidRematchInvite([GOOD]), false);
    assert.equal(isValidRematchInvite({}), false);
  });
});

describe('invitación a la revancha: remitente permitido', () => {
  const players: Player[] = [
    { id: 'jugador-ana-0001', name: 'Ana' },
    { id: 'jugador-beto-0002', name: 'Beto' },
    { id: 'bot-1', name: 'Bot' },
  ];

  it('acepta a un humano de la sala', () => {
    assert.equal(isAllowedRematchSender(GOOD, players), true);
  });

  it('rechaza a quien no está en la sala', () => {
    assert.equal(isAllowedRematchSender({ ...GOOD, fromId: 'jugador-carla-0003' }, players), false);
  });

  it('rechaza a un bot de la sala', () => {
    assert.equal(isAllowedRematchSender({ ...GOOD, fromId: 'bot-1' }, players), false);
  });
});
