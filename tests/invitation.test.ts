import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRoomInviteUrl } from '../src/lib/invitation';

describe('Enlaces de invitación', () => {
  it('incluye el código de sala en la URL web actual', () => {
    assert.equal(
      createRoomInviteUrl('ABC12', undefined, 'https://cartas.example/play?old=value#table'),
      'https://cartas.example/play?join=ABC12',
    );
  });

  it('usa la URL pública configurada para crear enlaces desde la app nativa', () => {
    assert.equal(
      createRoomInviteUrl('ABC12', 'https://cartas.example', 'capacitor://localhost'),
      'https://cartas.example/?join=ABC12',
    );
  });

  it('no comparte un enlace local de la app nativa si falta la URL pública', () => {
    assert.equal(createRoomInviteUrl('ABC12', undefined, 'capacitor://localhost'), null);
  });
});
