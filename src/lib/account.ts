import { Capacitor } from '@capacitor/core';
import { getPlayerId, restoreIdentity } from './identity';
import { applySnapshot, downloadProgress } from './progress';
import { callRawDirect } from './rooms';
import { supabase } from './supabase';

/*
 * Cuentas reales, lado del teléfono.
 *
 * El login NUNCA es obligatorio: sin cuenta, el juego funciona exactamente
 * como hoy (identidad del dispositivo + código de respaldo). La cuenta es
 * solo una forma más segura de guardar y recuperar el progreso en otro
 * teléfono: Google, Facebook o un código de 6 dígitos por correo.
 *
 * Flujo OAuth (Google/Facebook) con PKCE:
 *  - Web: `signInWithOAuth` redirige al proveedor y vuelve al origen; el
 *    cliente de Supabase canjea el `code` solo al cargar.
 *  - Nativo (Capacitor): `signInWithOAuth` con `skipBrowserRedirect` da la
 *    URL, se abre con @capacitor/browser y el retorno llega por el esquema
 *    `com.cartasdominicanas.app://login-callback` (intent-filter en
 *    AndroidManifest.xml); el `code` se canjea con `exchangeCodeForSession`.
 *    No hace falta keystore ni SHA-1 para esto.
 *
 * Para que funcione, Alexis debe crear el cliente OAuth en Google Cloud
 * Console / la app en Meta for Developers y habilitar el proveedor en el
 * dashboard de Supabase con la redirección
 * https://wfxbixnkgzdssevkdgwx.supabase.co/auth/v1/callback. Sin eso, el
 * botón falla con un error de Supabase ("provider is not enabled").
 *
 * Tras entrar, la UI decide con `afterSignIn()`:
 *  - cuenta sin vínculo -> vincular mi progreso actual;
 *  - cuenta vinculada a OTRO jugador -> ofrecer restaurar ese progreso
 *    (rota la clave: el teléfono viejo deja de valer hasta que se
 *    auto-repare con su sesión, ver `rooms.ts`);
 *  - cuenta vinculada a mí -> ya está.
 * El código de respaldo sigue existiendo como alternativa (no se toca).
 */

export type OAuthProvider = 'google' | 'facebook';
export type AccountProvider = OAuthProvider | 'email';

/** URI a la que vuelve la app tras el login en el proveedor (nativo). */
export const NATIVE_REDIRECT_URI = 'com.cartasdominicanas.app://login-callback';

const LINK_KEY = 'cartas.accountLink';
const LOCAL_ONLY_KEY = 'cartas.accountLocalOnly';
const NATIVE_AUTH_TIMEOUT_MS = 5 * 60_000;

export interface LinkedAccount {
  provider: AccountProvider;
  email: string | null;
  linkedAt: number;
}

type AccountStatusPayload = {
  kind: 'account_status';
  linked: boolean;
  playerId: string | null;
  provider: AccountProvider | null;
  email: string | null;
};
type AccountLinkedPayload = { kind: 'account_linked'; provider: AccountProvider; email: string | null };
type AccountRestoredPayload = {
  kind: 'account_restored';
  playerId: string;
  key: string;
  provider: AccountProvider;
  email: string | null;
};

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la cuenta no se recuerda al recargar, pero el juego sigue.
  }
}

/**
 * `code` de autorización en una URL de retorno (query `?code=...`). Puro:
 * se prueba sin navegador. En web lo consume Supabase solo; en nativo lo
 * extraemos del `appUrlOpen`.
 */
export function extractAuthCode(url: string): string | null {
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
}

/** Error del proveedor en una URL de retorno (`?error=access_denied...`). */
export function extractAuthError(url: string): string | null {
  try {
    return new URL(url).searchParams.get('error');
  } catch {
    return null;
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Vínculo guardado en este teléfono (caché para mostrarlo sin pedir al servidor). */
export function getLinkedAccount(): LinkedAccount | null {
  try {
    const parsed = JSON.parse(readStorage(LINK_KEY) ?? 'null') as Partial<LinkedAccount> | null;
    if (!parsed || (parsed.provider !== 'google' && parsed.provider !== 'facebook' && parsed.provider !== 'email')) {
      return null;
    }
    return {
      provider: parsed.provider,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      linkedAt: typeof parsed.linkedAt === 'number' ? parsed.linkedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeLinkState(link: LinkedAccount): void {
  writeStorage(LINK_KEY, JSON.stringify(link));
}

function clearLinkState(): void {
  writeStorage(LINK_KEY, null);
}

/**
 * El jugador eligió "Seguir sin cuenta": juega solo local y NO se le
 * vuelve a insistir en cada arranque. La sección Cuenta sigue ofreciendo
 * entrar cuando quiera (al entrar, la elección se borra).
 */
export function hasChosenLocalOnly(): boolean {
  return readStorage(LOCAL_ONLY_KEY) === '1';
}

export function chooseLocalOnly(): void {
  writeStorage(LOCAL_ONLY_KEY, '1');
}

export function clearLocalOnlyChoice(): void {
  writeStorage(LOCAL_ONLY_KEY, null);
}

/** Access token de la sesión de Supabase, o null si no hay sesión. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** ¿Hay sesión de Supabase y con qué correo? (para la UI, sin pedir al servidor). */
export async function getAccountState(): Promise<{
  hasSession: boolean;
  sessionEmail: string | null;
  linked: LinkedAccount | null;
  localOnly: boolean;
}> {
  const { data } = await supabase.auth.getSession();
  return {
    hasSession: !!data.session,
    sessionEmail: data.session?.user?.email ?? null,
    linked: getLinkedAccount(),
    localOnly: hasChosenLocalOnly(),
  };
}

/** Estado del vínculo en el servidor (la verdad; la caché local puede estar vieja). */
export async function fetchAccountStatus(): Promise<AccountStatusPayload | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const data = await callRawDirect<AccountStatusPayload>({ action: 'account_status', accessToken: token });
  if (data.kind !== 'account_status') throw new Error('Respuesta inesperada del servidor.');
  return data;
}

/**
 * Qué debe hacer la UI justo después de entrar (Google/Facebook/correo):
 * si la cuenta ya tiene progreso de OTRO teléfono, hay que restaurar;
 * si no tiene vínculo, se puede vincular el progreso actual; si ya es
 * mía, no hay nada que hacer.
 */
export async function afterSignIn(): Promise<
  | { step: 'already-linked' }
  | { step: 'needs-restore'; playerId: string; provider: AccountProvider; email: string | null }
  | { step: 'link-available' }
  | { step: 'no-session' }
> {
  const status = await fetchAccountStatus();
  if (!status) return { step: 'no-session' };
  if (!status.linked) return { step: 'link-available' };
  if (status.playerId === getPlayerId()) {
    if (status.provider) {
      writeLinkState({ provider: status.provider, email: status.email, linkedAt: Date.now() });
    }
    clearLocalOnlyChoice();
    return { step: 'already-linked' };
  }
  return {
    step: 'needs-restore',
    playerId: status.playerId ?? '',
    provider: status.provider ?? 'email',
    email: status.email,
  };
}

/**
 * Entrar con Google o Facebook.
 *  - Web: devuelve 'redirected' (la página se va al proveedor y vuelve sola).
 *  - Nativo: abre el navegador, espera el retorno por el esquema de la app
 *    y canjea el código; devuelve 'signed-in' con la sesión ya lista.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<'redirected' | 'signed-in'> {
  if (!Capacitor.isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error('No se pudo abrir el inicio de sesión. Inténtalo de nuevo.');
    return 'redirected';
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_REDIRECT_URI, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error('No se pudo abrir el inicio de sesión. Inténtalo de nuevo.');
  await signInNative(data.url);
  return 'signed-in';
}

/**
 * Flujo nativo: abre la URL de autorización en el navegador del sistema y
 * espera el retorno a la app (`appUrlOpen`) con el `code`. Los plugins se
 * importan aquí (no arriba) para que la web y los tests no carguen código
 * nativo que no necesitan.
 */
async function signInNative(url: string): Promise<void> {
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')]);
  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // El listener se registra ANTES de abrir el navegador, para no perder el retorno.
  const handle = await App.addListener('appUrlOpen', ({ url: callbackUrl }) => {
    if (extractAuthError(callbackUrl)) {
      rejectCode(new Error('No se pudo entrar con esa cuenta.'));
      return;
    }
    const code = extractAuthCode(callbackUrl);
    if (code) resolveCode(code);
  });
  try {
    await Browser.open({ url });
    const code = await Promise.race([
      codePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('El inicio de sesión tardó demasiado. Inténtalo de nuevo.')), NATIVE_AUTH_TIMEOUT_MS),
      ),
    ]);
    await Browser.close().catch(() => undefined);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error('No se pudo completar el inicio de sesión. Inténtalo de nuevo.');
  } finally {
    await handle.remove().catch(() => undefined);
  }
}

/** Envía el código de 6 dígitos al correo (sin contraseña; crea la cuenta si no existe). */
export async function sendEmailCode(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) throw new Error('Escribe un correo válido.');
  const { error } = await supabase.auth.signInWithOtp({ email: clean });
  if (error) throw new Error('No se pudo enviar el código. Revisa el correo e inténtalo de nuevo.');
}

/** Verifica el código de 6 dígitos y deja la sesión lista. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) throw new Error('El código tiene 6 dígitos.');
  const { error } = await supabase.auth.verifyOtp({ email: clean, token, type: 'email' });
  if (error) throw new Error('Código incorrecto o vencido. Pide uno nuevo.');
}

/**
 * Vincula la sesión actual (Google/Facebook/correo) con el progreso de
 * este teléfono. Si ya estaba vinculada a mí, no da error.
 */
export async function linkCurrentIdentity(): Promise<LinkedAccount> {
  const token = await getAccessToken();
  if (!token) throw new Error('Primero entra con tu cuenta.');
  const data = await callRawDirect<AccountLinkedPayload>({ action: 'link_account', accessToken: token });
  if (data.kind !== 'account_linked') throw new Error('Respuesta inesperada del servidor.');
  const link: LinkedAccount = { provider: data.provider, email: data.email, linkedAt: Date.now() };
  writeLinkState(link);
  clearLocalOnlyChoice();
  return link;
}

/**
 * Restaura el progreso vinculado a la cuenta en este teléfono: el servidor
 * rota la clave (la vieja deja de valer), se guarda la identidad nueva y
 * se baja la foto de la nube. Devuelve false si no hay sesión o no hay
 * vínculo (sin lanzar, para la auto-reparación silenciosa).
 */
export async function restoreFromAccount(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  let data: AccountRestoredPayload;
  try {
    data = await callRawDirect<AccountRestoredPayload>({ action: 'restore_account', accessToken: token });
  } catch {
    return false;
  }
  if (data.kind !== 'account_restored') return false;
  if (!restoreIdentity(data.playerId, data.key)) return false;
  writeLinkState({ provider: data.provider, email: data.email, linkedAt: Date.now() });
  clearLocalOnlyChoice();
  // La foto de la nube llega con la identidad nueva (reutiliza el flujo de siempre).
  try {
    const copy = await downloadProgress();
    if (copy.snapshot) applySnapshot(copy.snapshot, copy.profile, copy.updatedAt);
  } catch {
    // Sin copia o sin conexión: el juego sigue con la identidad restaurada.
  }
  return true;
}

/** Quita el vínculo entre la cuenta y este jugador (la identidad local sigue intacta). */
export async function unlinkAccount(): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No hay sesión activa.');
  await callRawDirect({ action: 'unlink_account', accessToken: token });
  clearLinkState();
}

/** Cierra la sesión de Supabase en este teléfono (el vínculo en el servidor sigue; al entrar se recupera). */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  clearLinkState();
}
