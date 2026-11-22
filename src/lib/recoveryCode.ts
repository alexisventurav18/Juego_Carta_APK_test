/*
 * Código de respaldo (B): codifica la identidad completa del jugador
 * (playerId de 128 bits + playerKey secreta de 192 bits) en texto que se
 * puede anotar y teclear en otro teléfono.
 *
 * Formato: 40 bytes → 64 caracteres base32 + 2 de control (checksum
 * FNV-1a de los 40 bytes) = 66 caracteres, en 11 grupos de 6 separados
 * por guiones, p. ej. `ABCDEF-GHIJKL-...`. La base32 usa solo
 * A-Z y 2-7 (sin 0/1/O/l, que se confunden al teclear) y el checksum
 * rechaza casi cualquier error de copia antes de tocar el servidor.
 *
 * El código ES la clave secreta: quien lo tenga puede entrar como el
 * jugador. Nunca se envía solo ni se muestra sin aviso.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_LENGTH = 66; // 64 de carga + 2 de control
const PAYLOAD_CHARS = 64;

/** FNV-1a de 32 bits: dos caracteres de control sobre los 10 bits altos. */
function checksumChars(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const value = (hash >>> 22) & 0x3ff;
  return ALPHABET[(value >>> 5) & 31] + ALPHABET[value & 31];
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Uint8Array | null {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/**
 * Codifica la identidad en el código de respaldo. Devuelve null si el id
 * o la clave no tienen el formato esperado (32 y 48 hex, con o sin guiones
 * en el id).
 */
export function encodeRecoveryCode(playerId: string, key: string): string | null {
  const idHex = playerId.replace(/-/g, '').toLowerCase();
  const keyHex = key.toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(idHex) || !/^[0-9a-f]{48}$/.test(keyHex)) return null;
  const bytes = hexToBytes(idHex + keyHex);
  const raw = base32Encode(bytes) + checksumChars(bytes);
  const groups = raw.match(/.{1,6}/g);
  return groups ? groups.join('-') : null;
}

/**
 * Decodifica un código de respaldo (tolera minúsculas, guiones y espacios).
 * Devuelve null si la longitud no cuadra, hay caracteres fuera del
 * alfabeto o el checksum no coincide: un código corrupto se rechaza aquí,
 * sin tocar el servidor.
 */
export function decodeRecoveryCode(code: string): { playerId: string; key: string } | null {
  const raw = code.toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (raw.length !== CODE_LENGTH) return null;
  const bytes = base32Decode(raw.slice(0, PAYLOAD_CHARS));
  if (!bytes || bytes.length !== 40) return null;
  if (checksumChars(bytes) !== raw.slice(PAYLOAD_CHARS)) return null;
  const hex = bytesToHex(bytes);
  const idHex = hex.slice(0, 32);
  const playerId =
    `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20)}`;
  return { playerId, key: hex.slice(32) };
}
