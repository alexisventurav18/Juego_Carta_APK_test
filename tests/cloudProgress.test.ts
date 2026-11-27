import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { sanitizeProgressSnapshot, type ProgressSnapshot } from '../src/games/progress';
import {
  handleRequest,
  type RoomRequest,
  type RoomResponse,
  type RoomStore,
  type SocialPayload,
} from '../src/games/roomService';
import { getEconomy } from '../src/lib/economy';
import { decodeRecoveryCode, encodeRecoveryCode } from '../src/lib/recoveryCode';
import { MemoryStore } from './memoryStore';

const KEY_A = 'clave-secreta-de-ana-0123456789';
const A = { playerId: 'jugador-ana-0001', key: KEY_A };

async function okData(store: RoomStore, req: RoomRequest): Promise<SocialPayload> {
  const res = await handleRequest(store, req);
  assert.ok(res.ok, res.ok ? '' : res.error);
  assert.ok('data' in res, 'se esperaban datos');
  return res.data;
}
async function fail(store: RoomStore, req: unknown): Promise<string> {
  const res: RoomResponse = await handleRequest(store, req);
  assert.ok(!res.ok, 'se esperaba un error');
  return res.ok ? '' : res.error;
}
async function makeProfile(store: MemoryStore, auth: typeof A, name: string) {
  const res = await handleRequest(store, { action: 'create', game: 'casino', name, ...auth });
  assert.ok(res.ok, res.ok ? '' : res.error);
}

async function withFixedNow(ms: number, fn: () => Promise<void>): Promise<void> {
  const original = Date.now;
  Date.now = () => ms;
  try {
    await fn();
  } finally {
    Date.now = original;
  }
}

/** Foto completa: con `awarded[]` y `lastDailyDate`, que son el anti-doble-pago. */
function fullSnapshot(): ProgressSnapshot {
  return {
    economy: {
      coins: 420,
      wins: 7,
      gamesPlayed: 12,
      losses: 5,
      streak: 3,
      bestStreak: 4,
      winsByGame: { casino: 4, tresydos: 2, robaito: 1, cagao: 0 },
      xp: 860,
      lastDailyDate: '2026-11-22',
      ownedCardBacks: ['larimar'],
      ownedTables: ['mar-caribe'],
      ownedMenus: ['fiesta-tropical'],
      awarded: ['partida-1', 'rueda-2026-11-22'],
      missions: { daily: [{ id: 'm1', done: true }], weekly: [] },
      dailyStreak: { days: 3, lastDate: '2026-11-22' },
      achievements: {
        unlocked: ['primera-casino'],
        claimed: [],
        modesWonToday: { date: '2026-11-22', games: ['casino'] },
      },
      adsRemoved: false,
    },
    visualPrefs: { cardBack: 'larimar', table: 'mar-caribe', menu: 'fiesta-tropical' },
  };
}

describe('foto del progreso: ida y vuelta con awarded[] y lastDailyDate', () => {
  it('una foto válida sobrevive entera (monedas, XP, cosméticos, awarded, rueda)', () => {
    const snapshot = sanitizeProgressSnapshot(fullSnapshot());
    assert.deepEqual(snapshot, fullSnapshot(), 'la foto vuelve tal cual se mandó');
  });

  it('lo que no es una foto se rechaza entero', () => {
    assert.equal(sanitizeProgressSnapshot(null), null);
    assert.equal(sanitizeProgressSnapshot('nope'), null);
    assert.equal(sanitizeProgressSnapshot({ economy: 'nope' }), null);
    assert.equal(sanitizeProgressSnapshot({}), null);
  });

  it('los números imposibles se ponen a 0 y las listas raras se vacían, sin tumbar la foto', () => {
    const snapshot = sanitizeProgressSnapshot({
      economy: {
        ...fullSnapshot().economy,
        coins: -50,
        xp: Number.NaN,
        winsByGame: { casino: 'muchas' },
        ownedCardBacks: 'larimar',
        awarded: [1, 2, 'partida-1', 'partida-1'],
        lastDailyDate: 'ayer',
        missions: 'nada',
      },
      visualPrefs: { cardBack: 7 },
    });
    assert.ok(snapshot, 'la foto se acepta con los campos limpios');
    assert.equal(snapshot?.economy.coins, 0, 'monedas negativas → 0');
    assert.equal(snapshot?.economy.xp, 0, 'XP no numérico → 0');
    assert.deepEqual(snapshot?.economy.winsByGame, { casino: 0, tresydos: 0, robaito: 0, cagao: 0 });
    assert.deepEqual(snapshot?.economy.ownedCardBacks, [], 'dorsos no-lista → vacío');
    assert.deepEqual(snapshot?.economy.awarded, ['partida-1'], 'awarded sin duplicados ni números');
    assert.equal(snapshot?.economy.lastDailyDate, null, 'fecha de rueda inválida → null');
    assert.equal(snapshot?.economy.missions, null, 'misiones sin forma → null');
    assert.equal(snapshot?.visualPrefs, null, 'temas sin forma → null');
  });

  it('awarded[] se recorta a los últimos 50', () => {
    const awarded = Array.from({ length: 80 }, (_, i) => `partida-${i}`);
    const snapshot = sanitizeProgressSnapshot({ economy: { ...fullSnapshot().economy, awarded } });
    assert.equal(snapshot?.economy.awarded.length, 50, 'awarded nunca pasa de 50');
  });
});

describe('código de respaldo: generar → validar → identidad reconstruida', () => {
  const PLAYER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef';

  it('el código redondo reconstruye la identidad exacta', () => {
    const code = encodeRecoveryCode(PLAYER_ID, KEY);
    assert.ok(code, 'el código se genera');
    assert.equal(code?.split('-').length, 11, 'el código tiene 11 grupos de 6');
    assert.deepEqual(decodeRecoveryCode(code!), { playerId: PLAYER_ID, key: KEY });
  });

  it('el id sin guiones genera el mismo código', () => {
    const withDashes = encodeRecoveryCode(PLAYER_ID, KEY);
    const withoutDashes = encodeRecoveryCode(PLAYER_ID.replace(/-/g, ''), KEY);
    assert.equal(withoutDashes, withDashes, 'con o sin guiones, el código es el mismo');
  });

  it('la lectura tolera minúsculas, espacios y guiones', () => {
    const code = encodeRecoveryCode(PLAYER_ID, KEY)!;
    const messy = code.toLowerCase().replace(/-/g, '  ');
    assert.deepEqual(decodeRecoveryCode(messy), { playerId: PLAYER_ID, key: KEY });
  });

  it('un código corrupto se rechaza sin tocar el servidor', () => {
    const code = encodeRecoveryCode(PLAYER_ID, KEY)!;
    // Corromper la carga: un carácter distinto cambia los bytes y el checksum ya no cuadra.
    const corruptedPayload = `B${code.slice(1)}`;
    assert.notEqual(corruptedPayload[0], code[0]);
    assert.equal(decodeRecoveryCode(corruptedPayload), null, 'carga corrupta → null');
    // Corromper el control: el último carácter ya no es el checksum calculado.
    const last = code[code.length - 1];
    const replacement = last === 'A' ? 'B' : 'A';
    const corruptedCheck = `${code.slice(0, -1)}${replacement}`;
    assert.equal(decodeRecoveryCode(corruptedCheck), null, 'checksum corrupto → null');
  });

  it('códigos cortos, basura o identidades con mal formato se rechazan', () => {
    assert.equal(decodeRecoveryCode('ABCD'), null);
    assert.equal(decodeRecoveryCode('no-es-un-código'), null);
    assert.equal(decodeRecoveryCode(''), null);
    assert.equal(encodeRecoveryCode(PLAYER_ID, 'clave-corta'), null, 'clave corta no genera código');
    assert.equal(encodeRecoveryCode('no-es-un-id', KEY), null, 'id inválido no genera código');
  });
});

describe('servidor: save_progress / load_progress con store simulado', () => {
  it('guarda la foto y la baja con el perfil (nombre, monedas, XP, cosméticos)', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const saved = await okData(store, { action: 'save_progress', economy: fullSnapshot(), baseUpdatedAt: 0, ...A });
    assert.equal(saved.kind, 'progress_saved', 'la foto se guarda');
    assert.ok(saved.kind === 'progress_saved' && saved.updatedAt > 0, 'la foto queda fechada');
    const loaded = await okData(store, { action: 'load_progress', ...A });
    assert.equal(loaded.kind, 'progress', 'la foto se baja');
    if (loaded.kind !== 'progress') return;
    assert.deepEqual(loaded.economy, fullSnapshot(), 'la foto bajada es la guardada');
    assert.equal(loaded.profile?.name, 'Ana', 'el perfil viaja con la foto');
  });

  it('bajar sin copia devuelve null, no un error', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const loaded = await okData(store, { action: 'load_progress', ...A });
    assert.equal(loaded.kind, 'progress');
    if (loaded.kind !== 'progress') return;
    assert.equal(loaded.economy, null, 'sin respaldo no hay foto');
    assert.equal(loaded.updatedAt, null, 'sin respaldo no hay fecha');
    assert.equal(loaded.profile?.name, 'Ana', 'el perfil sí existe');
  });

  it('la copia vieja no pisa a la nueva: gana la más reciente por updatedAt', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const snap1 = { ...fullSnapshot(), economy: { ...fullSnapshot().economy, coins: 100 } };
    const snap2 = { ...fullSnapshot(), economy: { ...fullSnapshot().economy, coins: 200 } };
    const snap3 = { ...fullSnapshot(), economy: { ...fullSnapshot().economy, coins: 300 } };
    await withFixedNow(1000, async () => {
      const saved = await okData(store, { action: 'save_progress', economy: snap1, baseUpdatedAt: 0, ...A });
      assert.equal(saved.kind, 'progress_saved');
    });
    await withFixedNow(2000, async () => {
      const saved = await okData(store, { action: 'save_progress', economy: snap2, baseUpdatedAt: 1000, ...A });
      assert.equal(saved.kind, 'progress_saved', 'con la fecha al día, la subida pasa');
    });
    // Subida vieja sin baseUpdatedAt: la nube tiene la copia de las 2000.
    const conflict = await okData(store, { action: 'save_progress', economy: snap3, ...A });
    assert.equal(conflict.kind, 'progress_conflict', 'la copia vieja se rechaza con conflicto');
    if (conflict.kind !== 'progress_conflict') return;
    assert.equal(conflict.updatedAt, 2000, 'el conflicto trae la fecha de la nube');
    assert.equal(conflict.economy.economy.coins, 200, 'el conflicto trae la copia de la nube, no la vieja');
    // Y con la fecha al día, la misma subida sí pasa.
    await withFixedNow(3000, async () => {
      const saved = await okData(store, { action: 'save_progress', economy: snap3, baseUpdatedAt: 2000, ...A });
      assert.equal(saved.kind, 'progress_saved', 'con la fecha de la nube, la subida pasa');
    });
    const loaded = await okData(store, { action: 'load_progress', ...A });
    if (loaded.kind !== 'progress') return;
    assert.equal(loaded.economy?.economy.coins, 300, 'al final queda la última copia aceptada');
  });

  it('sin perfil no hay respaldo ni descarga', async () => {
    const store = new MemoryStore();
    const saveError = await fail(store, { action: 'save_progress', economy: fullSnapshot(), ...A });
    assert.match(saveError, /perfil/i, 'guardar sin perfil explica que no hay perfil');
    const loadError = await fail(store, { action: 'load_progress', ...A });
    assert.match(loadError, /perfil/i, 'bajar sin perfil explica que no hay perfil');
  });

  it('una foto con mal formato se rechaza', async () => {
    const store = new MemoryStore();
    await makeProfile(store, A, 'Ana');
    const error = await fail(store, { action: 'save_progress', economy: 'nope', ...A });
    assert.match(error, /formato/i, 'la foto inválida se rechaza con mensaje claro');
  });
});

// --- Cliente real (progress.ts) con el fetch stubbeado, como friendsCrash ---
let stub: ((body: Record<string, unknown>) => unknown) | null = null;
let capturedBody: Record<string, unknown> | null = null;
let uploadProgress: typeof import('../src/lib/progress').uploadProgress;
let downloadProgress: typeof import('../src/lib/progress').downloadProgress;
let applySnapshot: typeof import('../src/lib/progress').applySnapshot;

before(async () => {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
    url: unknown,
    init?: { body?: unknown },
  ) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    capturedBody = body;
    const payload = stub ? stub(body) : { ok: false, error: 'sin stub' };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  ({ uploadProgress, downloadProgress, applySnapshot } = await import('../src/lib/progress'));
});

describe('cliente: subir y bajar la foto con el sobre del servidor', () => {
  it('uploadProgress() sube la foto con baseUpdatedAt y acepta el guardado', async () => {
    stub = (body) =>
      body.action === 'save_progress'
        ? { ok: true, data: { kind: 'progress_saved', updatedAt: 123456 } }
        : { ok: false, error: 'sin stub' };
    const result = await uploadProgress();
    assert.equal(result, 'saved', 'la subida se acepta');
    assert.equal(capturedBody?.action, 'save_progress', 'la acción es save_progress');
    assert.equal(capturedBody?.baseUpdatedAt, 0, 'sin copia previa, baseUpdatedAt es 0');
    const economy = (capturedBody?.economy as Record<string, unknown> | undefined)?.economy as
      | Record<string, unknown>
      | undefined;
    assert.ok(economy && typeof economy.coins === 'number', 'la foto lleva la economía');
    assert.ok(Array.isArray(economy?.awarded), 'la foto lleva awarded[]');
  });

  it('uploadProgress() devuelve conflict cuando la nube tiene una copia más nueva', async () => {
    stub = () => ({ ok: true, data: { kind: 'progress_conflict', economy: fullSnapshot(), updatedAt: 999999 } });
    assert.equal(await uploadProgress(), 'conflict', 'la copia vieja no pisa a la nube');
  });

  it('downloadProgress() devuelve la foto y el perfil', async () => {
    stub = (body) =>
      body.action === 'load_progress'
        ? { ok: true, data: { kind: 'progress', economy: fullSnapshot(), updatedAt: 123456, profile: { name: 'Ana', level: 5 } } }
        : { ok: false, error: 'sin stub' };
    const copy = await downloadProgress();
    assert.equal(copy.snapshot?.economy.coins, 420, 'la foto bajada trae las monedas');
    assert.deepEqual(copy.snapshot?.economy.awarded, ['partida-1', 'rueda-2026-11-22'], 'la foto trae awarded[]');
    assert.equal(copy.snapshot?.economy.lastDailyDate, '2026-11-22', 'la foto trae la fecha de la rueda');
    assert.equal(copy.snapshot?.visualPrefs?.cardBack, 'larimar', 'la foto trae el dorso equipado');
    assert.equal(copy.profile?.name, 'Ana', 'el perfil viaja con la foto');
    assert.equal(copy.updatedAt, 123456, 'la copia trae su fecha');
  });

  it('applySnapshot() restaura monedas, XP y awarded en el teléfono', async () => {
    applySnapshot(fullSnapshot(), { name: 'Ana' }, 123456);
    const economy = getEconomy();
    assert.equal(economy.coins, 420, 'las monedas se restauran');
    assert.equal(economy.xp, 860, 'la XP se restaura');
    assert.deepEqual(economy.awarded, ['partida-1', 'rueda-2026-11-22'], 'awarded[] se restaura: no se cobra dos veces');
  });
});
