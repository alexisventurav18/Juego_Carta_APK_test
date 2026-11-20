import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getResumableRoomId, storeRoomId } from '../src/lib/identity';

/** Imitación mínima de Storage para Node, donde no hay localStorage. */
function stubStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('cierre definitivo de la app', () => {
  it('en una sesión nueva no se reanuda la sala guardada', () => {
    const local = stubStorage();
    const session = stubStorage();
    (globalThis as unknown as { localStorage: unknown }).localStorage = local;
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = session;
    storeRoomId('sala-vieja');
    assert.equal(getResumableRoomId(), null);
    assert.equal(local.getItem('cartas.roomId'), null);
  });

  it('en la misma sesión la sala guardada sí se reanuda', () => {
    const local = stubStorage();
    const session = stubStorage();
    (globalThis as unknown as { localStorage: unknown }).localStorage = local;
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = session;
    storeRoomId('sala-vieja');
    assert.equal(getResumableRoomId(), null); // Primera llamada: sesión nueva.
    storeRoomId('sala-actual');
    assert.equal(getResumableRoomId(), 'sala-actual');
  });
});
