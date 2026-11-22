import { encodeAvatar, isAvatarCode, randomAvatar } from '../games/avatar';

const PLAYER_ID_KEY = 'cartas.playerId';
const PLAYER_SECRET_KEY = 'cartas.playerKey';
const PLAYER_NAME_KEY = 'cartas.playerName';
const ROOM_ID_KEY = 'cartas.roomId';
const AVATAR_KEY = 'cartas.avatar';
const AVATAR_CHOSEN_KEY = 'cartas.avatarChosen';

// Algunos navegadores (modo privado, cookies bloqueadas) lanzan errores al usar localStorage.
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
    // Sin almacenamiento: la sesión sigue funcionando, solo no se recuerda al recargar.
  }
}

export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let sessionPlayerId: string | null = null;

export function getPlayerId(): string {
  const existing = readStorage(PLAYER_ID_KEY) ?? sessionPlayerId;
  if (existing) return existing;
  const id = randomId();
  sessionPlayerId = id;
  writeStorage(PLAYER_ID_KEY, id);
  return id;
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let sessionPlayerKey: string | null = null;

/**
 * Starts a fresh local player identity. This is useful on shared devices and
 * during local multiplayer tests, where two browser profiles must not reuse
 * the same player credentials.
 */
export function resetPlayerIdentity(): void {
  sessionPlayerId = null;
  sessionPlayerKey = null;
  writeStorage(PLAYER_ID_KEY, null);
  writeStorage(PLAYER_SECRET_KEY, null);
  writeStorage(PLAYER_NAME_KEY, null);
  writeStorage(AVATAR_KEY, null);
  writeStorage(AVATAR_CHOSEN_KEY, null);
  sessionAvatar = null;
  writeStorage(ROOM_ID_KEY, null);
}

/**
 * Restaura la identidad desde un código de respaldo (playerId + clave
 * secreta). Devuelve false si el formato no es válido. No toca el nombre
 * ni el avatar: esos llegan del perfil del servidor al descargar el
 * progreso. La sala guardada sí se limpia: pertenecía a la identidad
 * anterior.
 */
export function restoreIdentity(playerId: string, key: string): boolean {
  const idHex = playerId.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(idHex) || !/^[0-9a-f]{48}$/.test(key.toLowerCase())) return false;
  const normalizedId =
    `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20)}`;
  sessionPlayerId = normalizedId;
  sessionPlayerKey = key.toLowerCase();
  writeStorage(PLAYER_ID_KEY, normalizedId);
  writeStorage(PLAYER_SECRET_KEY, key.toLowerCase());
  writeStorage(ROOM_ID_KEY, null);
  return true;
}

/**
 * Clave secreta del jugador: demuestra ante el servidor que eres tú (el id es público).
 * Nunca se muestra ni se comparte; el servidor solo guarda su hash.
 */
export function getPlayerKey(): string {
  const existing = readStorage(PLAYER_SECRET_KEY) ?? sessionPlayerKey;
  if (existing) return existing;
  const key = randomSecret();
  sessionPlayerKey = key;
  writeStorage(PLAYER_SECRET_KEY, key);
  return key;
}

export function getStoredName(): string {
  return readStorage(PLAYER_NAME_KEY) ?? '';
}

export function storeName(name: string): void {
  writeStorage(PLAYER_NAME_KEY, name);
}

export function getStoredRoomId(): string | null {
  return readStorage(ROOM_ID_KEY);
}

export function storeRoomId(roomId: string | null): void {
  writeStorage(ROOM_ID_KEY, roomId);
}

const SESSION_KEY = 'cartas.sessionAlive';

function readSession(key: string): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento de sesión: se trata como sesión nueva.
  }
}

/**
 * Sala guardada que vale para esta sesión de la app, o null si hay que
 * empezar en el menú.
 *
 * Al cerrar la aplicación el proceso muere y `sessionStorage` se vacía, así
 * que al volver a abrir no se reanuda la última sala (que podía estar
 * colgada en "Cargando sala..."): se descarta y se arranca en el menú.
 * Mientras la app siga viva (minimizar y volver, girar el teléfono) la
 * sesión se mantiene y la sala se reanuda como antes.
 */
export function getResumableRoomId(): string | null {
  if (!readSession(SESSION_KEY)) {
    writeStorage(ROOM_ID_KEY, null);
    writeSession(SESSION_KEY, '1');
    return null;
  }
  return getStoredRoomId();
}

/** Avatar guardado de este jugador, o null si todavía no eligió uno. */
export function getStoredAvatar(): string | null {
  const stored = readStorage(AVATAR_KEY);
  return isAvatarCode(stored) ? stored : null;
}

/** Guarda el avatar. Con `chosen` se anota que el jugador lo eligió él (y no fue uno asignado al azar). */
export function storeAvatar(code: string, chosen = false): void {
  if (!isAvatarCode(code)) return;
  writeStorage(AVATAR_KEY, code);
  if (chosen) writeStorage(AVATAR_CHOSEN_KEY, '1');
}

/** ¿El jugador ya pasó por el editor? Si no, su avatar es uno asignado al azar. */
export function hasChosenAvatar(): boolean {
  return readStorage(AVATAR_CHOSEN_KEY) === '1';
}

let sessionAvatar: string | null = null;

/**
 * Avatar de este jugador. Si nunca eligió uno se le asigna uno al azar y se recuerda, así su cara no cambia
 * entre partidas aunque no abra el editor.
 */
export function getMyAvatar(): string {
  const stored = getStoredAvatar();
  if (stored) return stored;
  if (!sessionAvatar) {
    sessionAvatar = encodeAvatar(randomAvatar());
    storeAvatar(sessionAvatar);
  }
  return sessionAvatar;
}

