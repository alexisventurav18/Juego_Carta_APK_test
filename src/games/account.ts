import {
  authenticateProfile,
  hashKey,
  readAuth,
  RoomError,
  type RoomResponse,
  type RoomStore,
} from './roomService';

/*
 * Cuentas reales: vínculo entre la cuenta de Supabase Auth (Google,
 * Facebook o correo) y la identidad del jugador (player_profiles).
 *
 * La cuenta es la fuente de verdad para recuperar el progreso en otro
 * teléfono; la clave de dispositivo sigue siendo la credencial para las
 * acciones de sala (cambio mínimo: nada de lo que ya existe cambia de
 * autenticación).
 *
 * Este módulo no sabe de Supabase: recibe un validador de JWT que aporta
 * la Edge Function (service role, `auth.getUser`) y en los tests se
 * inyecta un doble. La Edge Function copia solo `src/games/*` (ver
 * `scripts/syncFunctions.ts`), así que nada de aquí puede importar de
 * `src/lib`.
 *
 * Seguridad:
 *  - El JWT nunca se guarda: solo se valida y se usa su `sub` (el id del
 *    usuario de Auth) como clave del vínculo.
 *  - El vínculo es uno a uno en ambos sentidos: una cuenta no se puede
 *    ligar a dos jugadores ni un jugador a dos cuentas.
 *  - `restore_account` ROTA la clave: genera un secreto nuevo, guarda
 *    solo su hash y devuelve el secreto UNA vez por el canal autenticado
 *    (HTTPS + JWT válido). El servidor nunca puede devolver la clave
 *    vieja porque solo guarda hashes; por eso la rotación es lo que hace
 *    que el teléfono nuevo sea el dueño y el viejo deje de valer.
 */

export type AccountProvider = 'google' | 'facebook' | 'email';

export interface AccountLink {
  authUserId: string;
  playerId: string;
  provider: AccountProvider;
  providerEmail: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Resultado de validar un JWT de Supabase Auth. */
export interface ValidatedAccount {
  userId: string;
  email: string | null;
  /** Proveedor de Auth (`app_metadata.provider`): 'google' | 'facebook' | 'email'... */
  provider: string | null;
}

/**
 * Valida un access token de Supabase Auth. Devuelve null si no es válido
 * o caducó. Lo implementa la Edge Function con `auth.getUser`.
 */
export type TokenValidator = (accessToken: string) => Promise<ValidatedAccount | null>;

const MAX_TOKEN_LENGTH = 8192;

function isAccountProvider(value: unknown): value is AccountProvider {
  return value === 'google' || value === 'facebook' || value === 'email';
}

/** Secreto nuevo de jugador: 24 bytes aleatorios en hex (48 caracteres), igual que el del cliente. */
export function generatePlayerSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readAccessToken(req: Record<string, unknown>): string {
  const token = req.accessToken;
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new RoomError('Sesión no válida. Vuelve a entrar con tu cuenta.');
  }
  return token;
}

async function validateAccountToken(
  validator: TokenValidator | undefined,
  req: Record<string, unknown>,
): Promise<ValidatedAccount> {
  if (!validator) throw new RoomError('La verificación de cuenta no está disponible en este servidor.');
  const account = await validator(readAccessToken(req));
  if (!account) throw new RoomError('Sesión no válida. Vuelve a entrar con tu cuenta.');
  return account;
}

/** Proveedor del vínculo: el del JWT validado; si falta, el que manda el cliente si es válido. */
function readProvider(account: ValidatedAccount, req: Record<string, unknown>): AccountProvider {
  if (isAccountProvider(account.provider)) return account.provider;
  if (isAccountProvider(req.provider)) return req.provider;
  throw new RoomError('No se pudo determinar el proveedor de la cuenta.');
}

/**
 * Liga la cuenta (Google/Facebook/correo) con el jugador actual. Idempotente:
 * ligar de nuevo la misma cuenta al mismo jugador devuelve el vínculo sin error.
 */
export async function linkAccount(
  store: RoomStore,
  req: Record<string, unknown>,
  validator: TokenValidator | undefined,
): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const account = await validateAccountToken(validator, req);
  const provider = readProvider(account, req);
  const byUser = await store.getAccountLink(account.userId);
  if (byUser && byUser.playerId !== auth.playerId) {
    throw new RoomError('Esta cuenta ya está vinculada a otro jugador. Entra con ella en ese teléfono o desvincúlala allí primero.');
  }
  const byPlayer = await store.getAccountLinkByPlayer(auth.playerId);
  if (byPlayer && byPlayer.authUserId !== account.userId) {
    throw new RoomError('Este jugador ya está vinculado a otra cuenta. Desvincula esa cuenta primero.');
  }
  const now = Date.now();
  await store.upsertAccountLink({
    authUserId: account.userId,
    playerId: auth.playerId,
    provider,
    providerEmail: account.email,
    createdAt: byUser?.createdAt ?? now,
    updatedAt: now,
  });
  return { ok: true, data: { kind: 'account_linked', provider, email: account.email } };
}

/**
 * Recupera la identidad vinculada a la cuenta: rota la clave del jugador
 * (la vieja deja de valer en este teléfono y en cualquier otro) y devuelve
 * el secreto nuevo para que el cliente lo guarde y baje su progreso.
 */
export async function restoreAccount(
  store: RoomStore,
  req: Record<string, unknown>,
  validator: TokenValidator | undefined,
): Promise<RoomResponse> {
  const account = await validateAccountToken(validator, req);
  const link = await store.getAccountLink(account.userId);
  if (!link) {
    throw new RoomError('Esta cuenta no tiene ningún progreso vinculado. Vincúlala primero en el teléfono donde juegas.');
  }
  const key = generatePlayerSecret();
  const newHash = await hashKey(key);
  const rotated = await store.rotatePlayerKey(link.playerId, newHash);
  if (!rotated) throw new RoomError('No encontramos el perfil vinculado a esta cuenta.');
  // Las salas donde ya estaba también aceptan la clave nueva.
  await store.updateRoomKeys(link.playerId, newHash);
  return {
    ok: true,
    data: { kind: 'account_restored', playerId: link.playerId, key, provider: link.provider, email: link.providerEmail },
  };
}

/**
 * Quita el vínculo entre la cuenta y el jugador. La identidad local
 * (clave, progreso, salas) sigue intacta: solo se pierde la forma de
 * recuperarla con esa cuenta.
 */
export async function unlinkAccount(
  store: RoomStore,
  req: Record<string, unknown>,
  validator: TokenValidator | undefined,
): Promise<RoomResponse> {
  const auth = readAuth(req);
  await authenticateProfile(store, auth);
  const account = await validateAccountToken(validator, req);
  const link = await store.getAccountLink(account.userId);
  if (!link || link.playerId !== auth.playerId) {
    throw new RoomError('Esta cuenta no está vinculada a este jugador.');
  }
  await store.deleteAccountLink(account.userId);
  return { ok: true, data: { kind: 'account_unlinked' } };
}

/**
 * Estado del vínculo de la cuenta: no exige identidad de dispositivo,
 * para que un teléfono nuevo sepa si esa cuenta ya tiene progreso antes
 * de decidir entre restaurar o vincular.
 */
export async function accountStatus(
  store: RoomStore,
  req: Record<string, unknown>,
  validator: TokenValidator | undefined,
): Promise<RoomResponse> {
  const account = await validateAccountToken(validator, req);
  const link = await store.getAccountLink(account.userId);
  return {
    ok: true,
    data: {
      kind: 'account_status',
      linked: link !== null,
      playerId: link?.playerId ?? null,
      provider: link?.provider ?? null,
      email: link?.providerEmail ?? null,
    },
  };
}
