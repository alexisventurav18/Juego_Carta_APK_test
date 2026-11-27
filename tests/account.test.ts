import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generatePlayerSecret, type TokenValidator } from '../src/games/account';
import {
  handleRequest,
  type RoomRequest,
  type RoomResponse,
  type RoomStore,
  type SocialPayload,
} from '../src/games/roomService';
import { extractAuthCode, extractAuthError, isValidEmail } from '../src/lib/account';
import { callWithRepair, isIdentityError } from '../src/lib/rooms';
import { MemoryStore } from './memoryStore';

const KEY_A = 'clave-secreta-de-ana-0123456789';
const KEY_B = 'clave-secreta-de-beto-0123456789';
const A = { playerId: 'jugador-ana-0001', key: KEY_A };
const B = { playerId: 'jugador-beto-0001', key: KEY_B };

/** Validador doble: solo 'token-valido' pertenece a ese usuario de Auth. */
function validatorFor(userId: string, email: string | null = 'ana@example.com', provider = 'google'): TokenValidator {
  return async (token: string) => (token === 'token-valido' ? { userId, email, provider } : null);
}

async function okData(store: RoomStore, req: RoomRequest, validator?: TokenValidator): Promise<SocialPayload> {
  const res = await handleRequest(store, req, validator);
  assert.ok(res.ok, res.ok ? '' : res.error);
  assert.ok('data' in res, 'se esperaban datos');
  return res.data;
}

async function fail(store: RoomStore, req: unknown, validator?: TokenValidator): Promise<string> {
  const res: RoomResponse = await handleRequest(store, req, validator);
  assert.ok(!res.ok, 'se esperaba un error');
  return res.ok ? '' : res.error;
}

async function makeProfile(store: MemoryStore, auth: typeof A, name: string) {
  const res = await handleRequest(store, { action: 'create', game: 'casino', name, ...auth });
  assert.ok(res.ok, res.ok ? '' : res.error);
}

describe('generatePlayerSecret', () => {
  it('genera 48 hex (24 bytes) y nunca repite', () => {
    const a = generatePlayerSecret();
    const b = generatePlayerSecret();
    assert.match(a, /^[0-9a-f]{48}$/);
    assert.match(b, /^[0-9a-f]{48}$/);
    assert.notEqual(a, b);
  });
});

describe('callback de OAuth (puro)', () => {
  it('extrae el code de la URL de retorno', () => {
    assert.equal(extractAuthCode('com.cartasdominicanas.app://login-callback?code=abc123'), 'abc123');
    assert.equal(extractAuthCode('https://juego.test/?code=xyz&state=1'), 'xyz');
    assert.equal(extractAuthCode('com.cartasdominicanas.app://login-callback'), null);
    assert.equal(extractAuthCode('no-es-una-url'), null);
  });

  it('extrae el error del proveedor', () => {
    assert.equal(extractAuthError('com.cartasdominicanas.app://login-callback?error=access_denied'), 'access_denied');
    assert.equal(extractAuthError('com.cartasdominicanas.app://login-callback?code=abc'), null);
  });

  it('valida correos para el OTP', () => {
    assert.equal(isValidEmail('ana@example.com'), true);
    assert.equal(isValidEmail('ana+alias@correo.co'), true);
    assert.equal(isValidEmail('ana@'), false);
    assert.equal(isValidEmail('anaexample.com'), false);
    assert.equal(isValidEmail(''), false);
  });
});

describe('link_account', () => {
  it('liga la cuenta al jugador y es idempotente', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const data = await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    assert.equal(data.kind, 'account_linked');
    if (data.kind !== 'account_linked') return;
    assert.equal(data.provider, 'google');
    assert.equal(data.email, 'ana@example.com');
    // Ligar de nuevo la misma cuenta al mismo jugador no da error.
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const status = await okData(store, { action: 'account_status', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.equal(status.kind, 'account_status');
    if (status.kind !== 'account_status') return;
    assert.equal(status.linked, true);
    assert.equal(status.playerId, A.playerId);
  });

  it('una cuenta no se liga a dos jugadores', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await makeProfile(store, B, 'Beto');
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const error = await fail(store, { action: 'link_account', accessToken: 'token-valido', ...B }, validatorFor('auth-ana'));
    assert.match(error, /otro jugador/);
  });

  it('un jugador no se liga a dos cuentas', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const error = await fail(
      store,
      { action: 'link_account', accessToken: 'token-valido', ...A },
      validatorFor('auth-ana-facebook', 'ana@facebook.com', 'facebook'),
    );
    assert.match(error, /otra cuenta/);
  });

  it('sin validador de JWT no se puede verificar la cuenta', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const error = await fail(store, { action: 'link_account', accessToken: 'token-valido', ...A });
    assert.match(error, /no está disponible/);
  });

  it('token inválido y clave de dispositivo incorrecta se rechazan', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const badToken = await fail(store, { action: 'link_account', accessToken: 'token-falso', ...A }, validatorFor('auth-ana'));
    assert.match(badToken, /Sesión no válida/);
    const badKey = await fail(
      store,
      { action: 'link_account', accessToken: 'token-valido', playerId: A.playerId, key: 'clave-incorrecta-0123456789' },
      validatorFor('auth-ana'),
    );
    assert.match(badKey, /No pudimos verificar tu identidad/);
  });
});

describe('restore_account', () => {
  it('sin vínculo no hay nada que restaurar', async () => {
    const store = new MemoryStore();
    const error = await fail(store, { action: 'restore_account', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.match(error, /no tiene ningún progreso vinculado/);
  });

  it('rota la clave: la nueva vale y la vieja ya no', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const data = await okData(store, { action: 'restore_account', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.equal(data.kind, 'account_restored');
    if (data.kind !== 'account_restored') return;
    assert.equal(data.playerId, A.playerId);
    assert.match(data.key, /^[0-9a-f]{48}$/);
    assert.notEqual(data.key, KEY_A);
    // La clave nueva autentica; la vieja ya no.
    await okData(store, { action: 'load_progress', playerId: A.playerId, key: data.key });
    const oldKeyError = await fail(store, { action: 'load_progress', ...A });
    assert.match(oldKeyError, /No pudimos verificar tu identidad/);
  });

  it('la clave nueva también vale en las salas donde ya estaba', async () => {
    const store = new MemoryStore();
    const created = await handleRequest(store, { action: 'create', game: 'casino', name: 'Ana', ...A });
    assert.ok(created.ok && 'room' in created);
    const roomId = created.room.id;
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const restored = await okData(store, { action: 'restore_account', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.equal(restored.kind, 'account_restored');
    if (restored.kind !== 'account_restored') return;
    const view = await handleRequest(store, { action: 'view', roomId, playerId: A.playerId, key: restored.key });
    assert.ok(view.ok, view.ok ? '' : view.error);
    const oldView = await handleRequest(store, { action: 'view', roomId, ...A });
    assert.ok(!oldView.ok);
  });
});

describe('unlink_account y account_status', () => {
  it('desvincula y el estado lo refleja; restaurar después ya no puede', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const unlinked = await okData(store, { action: 'unlink_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    assert.equal(unlinked.kind, 'account_unlinked');
    const status = await okData(store, { action: 'account_status', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.equal(status.kind, 'account_status');
    if (status.kind !== 'account_status') return;
    assert.equal(status.linked, false);
    assert.equal(status.playerId, null);
    const error = await fail(store, { action: 'restore_account', accessToken: 'token-valido' }, validatorFor('auth-ana'));
    assert.match(error, /no tiene ningún progreso vinculado/);
  });

  it('desvincular una cuenta que no es mía se rechaza', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    await makeProfile(store, B, 'Beto');
    await okData(store, { action: 'link_account', accessToken: 'token-valido', ...A }, validatorFor('auth-ana'));
    const error = await fail(store, { action: 'unlink_account', accessToken: 'token-valido', ...B }, validatorFor('auth-ana'));
    assert.match(error, /no está vinculada a este jugador/);
  });

  it('account_status sin vínculo dice que no hay nada ligado', async () => {
    const store = new MemoryStore();
    const status = await okData(store, { action: 'account_status', accessToken: 'token-valido' }, validatorFor('auth-nadie'));
    assert.equal(status.kind, 'account_status');
    if (status.kind !== 'account_status') return;
    assert.equal(status.linked, false);
  });
});

describe('auto-reparación del cliente (rooms.ts)', () => {
  const IDENTITY_ERROR = new Error('Ese jugador ya existe con otra clave.');
  const OTHER_ERROR = new Error('La sala está llena.');

  it('clasifica los errores de identidad (clave rotada) y solo esos', () => {
    for (const message of [
      'Clave de jugador no válida.',
      'No pudimos verificar tu identidad.',
      'Ese jugador ya existe con otra clave.',
      'No estás en esta sala.',
    ]) {
      assert.equal(isIdentityError(message), true, message);
    }
    assert.equal(isIdentityError('La sala está llena.'), false);
    assert.equal(isIdentityError('No se pudo contactar con el servidor de partidas.'), false);
  });

  it('repara una vez y reintenta: la llamada termina bien', async () => {
    let attempts = 0;
    let repairs = 0;
    const result = await callWithRepair(
      async () => {
        attempts++;
        if (attempts === 1) throw IDENTITY_ERROR;
        return 'sala-ok';
      },
      async () => {
        repairs++;
        return true;
      },
    );
    assert.equal(result, 'sala-ok');
    assert.equal(attempts, 2);
    assert.equal(repairs, 1);
  });

  it('si el reintento vuelve a fallar, solo se repara una vez', async () => {
    let attempts = 0;
    let repairs = 0;
    await assert.rejects(
      callWithRepair(
        async () => {
          attempts++;
          throw IDENTITY_ERROR;
        },
        async () => {
          repairs++;
          return true;
        },
      ),
      /Ese jugador ya existe con otra clave/,
    );
    assert.equal(attempts, 2);
    assert.equal(repairs, 1);
  });

  it('si la reparación falla, sale el error original sin reintentar', async () => {
    let attempts = 0;
    let repairs = 0;
    await assert.rejects(
      callWithRepair(
        async () => {
          attempts++;
          throw IDENTITY_ERROR;
        },
        async () => {
          repairs++;
          return false;
        },
      ),
      /Ese jugador ya existe con otra clave/,
    );
    assert.equal(attempts, 1);
    assert.equal(repairs, 1);
  });

  it('un error que no es de identidad no intenta reparar', async () => {
    let attempts = 0;
    let repairs = 0;
    await assert.rejects(
      callWithRepair(
        async () => {
          attempts++;
          throw OTHER_ERROR;
        },
        async () => {
          repairs++;
          return true;
        },
      ),
      /La sala está llena/,
    );
    assert.equal(attempts, 1);
    assert.equal(repairs, 0);
  });
});
