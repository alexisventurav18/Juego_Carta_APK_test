/*
 * Respaldo del progreso en la nube (A+B), lado del teléfono.
 *
 * (A) Cada vez que la economía cambia (`save()` en economy.ts), la copia
 * se sube con debounce de ~5 s. Si no hay conexión, el juego sigue 100 %
 * local y la subida queda pendiente para el próximo cambio. Al arrancar,
 * si no hay economía local, se baja la copia de la nube.
 *
 * Conflicto: el teléfono recuerda la fecha de la copia del servidor que
 * conoce (`lastSyncedUpdatedAt`) y la manda como `baseUpdatedAt`. Si la
 * nube tiene una copia más nueva, el servidor no la pisa y devuelve
 * `progress_conflict`: la subida silenciosa se pausa y el jugador elige
 * en el modal de recuperación (restaurar la nube o quedarse con la de
 * este teléfono).
 *
 * (B) El código de respaldo vive en `recoveryCode.ts`; aquí solo se usa
 * la identidad ya restaurada para bajar la foto.
 */

import { getEconomy, loadEconomy, replaceEconomy, type EconomyState } from './economy';
import { getPlayerId, getPlayerKey, storeAvatar, storeName } from './identity';
import { callRaw } from './rooms';
import {
  CARD_BACK_THEMES,
  getVisualPrefs,
  MENU_THEMES,
  setVisualPrefs,
  TABLE_THEMES,
  type VisualPrefs,
} from './visualPrefs';

const SYNC_KEY = 'cartas-dominicanas:progress-sync-v1';
const ECONOMY_KEY = 'cartas-dominicanas:economy-v1';
const UPLOAD_DEBOUNCE_MS = 5_000;

export interface CloudSnapshot {
  economy: EconomyState;
  visualPrefs: VisualPrefs | null;
}

export interface CloudProfile {
  name: string;
  avatar?: string;
  level?: number;
}

export interface CloudCopy {
  snapshot: CloudSnapshot | null;
  updatedAt: number | null;
  profile: CloudProfile | null;
}

type ProgressResponse =
  | { kind: 'progress_saved'; updatedAt: number }
  | { kind: 'progress'; economy: unknown; updatedAt: number | null; profile: CloudProfile | null }
  | { kind: 'progress_conflict'; economy: unknown; updatedAt: number };

interface SyncState {
  lastSyncedUpdatedAt: number;
  conflictServerUpdatedAt: number | null;
}

function readSyncState(): SyncState {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    if (!raw) return { lastSyncedUpdatedAt: 0, conflictServerUpdatedAt: null };
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      lastSyncedUpdatedAt: typeof parsed.lastSyncedUpdatedAt === 'number' ? parsed.lastSyncedUpdatedAt : 0,
      conflictServerUpdatedAt:
        typeof parsed.conflictServerUpdatedAt === 'number' ? parsed.conflictServerUpdatedAt : null,
    };
  } catch {
    return { lastSyncedUpdatedAt: 0, conflictServerUpdatedAt: null };
  }
}

function writeSyncState(state: SyncState): void {
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento no hay respaldo que recordar; el juego sigue local.
  }
}

/** Para el Perfil: cuándo se respaldó por última vez y si hay un conflicto pendiente. */
export function getSyncStatus(): { lastSyncedAt: number | null; hasConflict: boolean; conflictAt: number | null } {
  const state = readSyncState();
  return {
    lastSyncedAt: state.lastSyncedUpdatedAt > 0 ? state.lastSyncedUpdatedAt : null,
    hasConflict: state.conflictServerUpdatedAt !== null,
    conflictAt: state.conflictServerUpdatedAt,
  };
}

/** La foto que se sube: la economía entera + los temas equipados. */
export function buildSnapshot(): CloudSnapshot {
  return { economy: getEconomy(), visualPrefs: getVisualPrefs() };
}

/** Valida una foto bajada de la nube; la economía se revalida entera con `loadEconomy`. */
function asCloudSnapshot(raw: unknown): CloudSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.economy !== 'object' || record.economy === null) return null;
  const economy = loadEconomy(JSON.stringify(record.economy), getVisualPrefs());
  const prefs = record.visualPrefs;
  let visualPrefs: VisualPrefs | null = null;
  if (typeof prefs === 'object' && prefs !== null) {
    const p = prefs as Record<string, unknown>;
    const cardBackTheme =
      typeof p.cardBack === 'string' ? CARD_BACK_THEMES.find((t) => t.id === p.cardBack) : undefined;
    const tableTheme = typeof p.table === 'string' ? TABLE_THEMES.find((t) => t.id === p.table) : undefined;
    const menuTheme = typeof p.menu === 'string' ? MENU_THEMES.find((t) => t.id === p.menu) : undefined;
    if (cardBackTheme && tableTheme && menuTheme) {
      visualPrefs = { cardBack: cardBackTheme.id, table: tableTheme.id, menu: menuTheme.id };
    }
  }
  return { economy, visualPrefs };
}

let uploadTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Programa la subida de la foto (debounce ~5 s). Solo en el teléfono: en
 * Node (tests) no hay `window` y no se programa nada.
 */
export function scheduleProgressUpload(): void {
  if (typeof window === 'undefined') return;
  if (uploadTimer !== null) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    void uploadProgress().catch(() => undefined);
  }, UPLOAD_DEBOUNCE_MS);
}

/**
 * Sube la foto. `force` se usa cuando el jugador eligió quedarse con la
 * copia de este teléfono: la subida se autoriza con la fecha de la nube.
 * Devuelve 'conflict' si la nube tiene una copia más nueva (no se pisa).
 */
export async function uploadProgress(force = false): Promise<'saved' | 'conflict' | 'skipped' | 'error'> {
  const state = readSyncState();
  if (!force && state.conflictServerUpdatedAt !== null) return 'skipped';
  const snapshot = buildSnapshot();
  const baseUpdatedAt = force ? (state.conflictServerUpdatedAt ?? state.lastSyncedUpdatedAt) : state.lastSyncedUpdatedAt;
  try {
    const data = await callRaw<ProgressResponse>({ action: 'save_progress', economy: snapshot, baseUpdatedAt });
    if (data.kind === 'progress_saved') {
      writeSyncState({ lastSyncedUpdatedAt: data.updatedAt, conflictServerUpdatedAt: null });
      return 'saved';
    }
    if (data.kind === 'progress_conflict') {
      writeSyncState({ lastSyncedUpdatedAt: state.lastSyncedUpdatedAt, conflictServerUpdatedAt: data.updatedAt });
      return 'conflict';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

/** Baja la foto de la nube (o null si nunca se respaldó). Lanza si no hay perfil o no hay conexión. */
export async function downloadProgress(): Promise<CloudCopy> {
  const data = await callRaw<ProgressResponse>({ action: 'load_progress' });
  if (data.kind !== 'progress') throw new Error('Respuesta inesperada del servidor.');
  // `data.economy` ya es la foto completa ({ economy, visualPrefs }).
  return {
    snapshot: data.economy === null ? null : asCloudSnapshot(data.economy),
    updatedAt: data.updatedAt,
    profile: data.profile,
  };
}

/**
 * Aplica una foto bajada: economía (revalidada), temas equipados si los
 * ids existen y nombre/avatar del perfil. Después de esto el teléfono
 * está al día con la nube.
 */
export function applySnapshot(snapshot: CloudSnapshot, profile: CloudProfile | null, updatedAt: number | null): void {
  replaceEconomy(snapshot.economy);
  if (snapshot.visualPrefs) setVisualPrefs(snapshot.visualPrefs);
  if (profile) {
    if (profile.name) storeName(profile.name);
    if (profile.avatar) storeAvatar(profile.avatar, true);
  }
  writeSyncState({
    lastSyncedUpdatedAt: updatedAt ?? Date.now(),
    conflictServerUpdatedAt: null,
  });
}

/**
 * Al arrancar: si no hay economía local, se baja la copia de la nube.
 * Nunca rompe el arranque: sin conexión o sin copia, devuelve 'none'.
 */
export async function restoreCloudProgressIfFresh(): Promise<'restored' | 'none' | 'skipped'> {
  if (typeof window === 'undefined') return 'skipped';
  try {
    if (window.localStorage.getItem(ECONOMY_KEY)) return 'skipped';
  } catch {
    return 'skipped';
  }
  try {
    const copy = await downloadProgress();
    if (!copy.snapshot) return 'none';
    applySnapshot(copy.snapshot, copy.profile, copy.updatedAt);
    return 'restored';
  } catch {
    return 'none';
  }
}

/** Devuelve la identidad actual (para el código de respaldo del Perfil). */
export function getIdentityForRecovery(): { playerId: string; key: string } {
  return { playerId: getPlayerId(), key: getPlayerKey() };
}
