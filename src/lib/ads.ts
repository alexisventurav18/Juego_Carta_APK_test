/*
 * Anuncios (AdMob) — solo interstitials, solo entre partidas.
 *
 * Reglas que cumple este módulo:
 *  - Un interstitial solo se muestra al SALIR del panel de resultados de
 *    una partida terminada (al tocar "Salir" o "Jugar otra partida"), nunca
 *    durante una partida y nunca mientras el panel sigue visible.
 *  - Como mucho 1 interstitial cada 3 minutos.
 *  - Si el jugador compró "quitar anuncios" (economy.adsRemoved), no hay
 *    anuncios en absoluto.
 *  - Degradación elegante: en web, sin plugin, si AdMob no inicializa o si
 *    cargar/mostrar falla, todo es un no-op silencioso. El juego nunca se
 *    bloquea, nunca espera un anuncio y nunca muestra un error por anuncios.
 *
 * IDs reales de la cuenta AdMob de Alexis (creada 2026-11-28): los anuncios
 * que se ven son reales y generan ingresos. La cuenta está en USD y sin
 * datos de pago/tarjeta todavía (eso es para cobrar, no para servir anuncios).
 */

import { Capacitor } from '@capacitor/core';
import type { AdMobPlugin, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { getEconomy } from './economy';

/** ID de la app en AdMob (Android). Cuenta real de Alexis. */
export const ADMOB_APP_ID = 'ca-app-pub-3081002488082091~4460413663';
/** Bloque interstitial "Intersticial entre partidas". Cuenta real de Alexis. */
export const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-3081002488082091/2502840875';

/** Como mucho un interstitial cada 3 minutos. */
export const AD_COOLDOWN_MS = 3 * 60 * 1000;

export interface AdGateState {
  /** "Quitar anuncios" comprado: sin anuncios. */
  adsRemoved: boolean;
  /** Cuándo se mostró el último interstitial (ms desde epoch), o null. */
  lastShownAtMs: number | null;
}

/**
 * Pura: ¿toca mostrar un interstitial ahora?
 * Solo tras una partida completada, sin "quitar anuncios" y con el
 * cooldown cumplido desde el último anuncio.
 */
export function shouldShowInterstitial(gate: AdGateState, matchFinished: boolean, nowMs: number): boolean {
  if (!matchFinished) return false;
  if (gate.adsRemoved) return false;
  if (gate.lastShownAtMs !== null && nowMs - gate.lastShownAtMs < AD_COOLDOWN_MS) return false;
  return true;
}

/**
 * Controla un interstitial de AdMob: inicializa el SDK una vez, precarga
 * el anuncio para tenerlo listo entre partidas y lo muestra cuando toca.
 * Nunca lanza: cualquier fallo del plugin deja el controlador sin anuncio
 * listo y el juego sigue igual.
 */
export class InterstitialAds {
  private plugin: AdMobPlugin | null = null;
  private initialized = false;
  private initializing = false;
  private ready = false;
  private lastShownAtMs: number | null = null;

  /** ¿Hay un anuncio cargado y listo para mostrar? (Solo para tests.) */
  isReady(): boolean {
    return this.ready;
  }

  /** ¿Cuándo se mostró el último interstitial? (Solo para tests.) */
  getLastShownAtMs(): number | null {
    return this.lastShownAtMs;
  }

  /** Inicializa AdMob y precarga el primer interstitial. No lanza nunca. */
  async init(): Promise<void> {
    if (this.initialized || this.initializing) return;
    // En web no hay SDK de AdMob: no se inicializa nada.
    if (!Capacitor.isNativePlatform()) return;
    this.initializing = true;
    try {
      const { AdMob, InterstitialAdPluginEvents } = await import('@capacitor-community/admob');
      await this.initWithPlugin(AdMob, InterstitialAdPluginEvents);
    } catch {
      // Sin AdMob no hay anuncios, pero el juego sigue igual.
      this.plugin = null;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Inicializa con un plugin ya cargado (el real en `init()`, uno falso en
   * los tests). No lanza nunca.
   */
  async initWithPlugin(
    plugin: AdMobPlugin,
    events: typeof InterstitialAdPluginEvents,
  ): Promise<void> {
    if (this.initialized) return;
    this.plugin = plugin;
    try {
      await plugin.initialize();
      this.initialized = true;
      // Los eventos mandan: el anuncio está listo cuando carga, deja de
      // estarlo al mostrarse o si falla, y se recarga al descartarse.
      void plugin
        .addListener(events.Loaded, () => {
          this.ready = true;
        })
        .catch(() => undefined);
      void plugin
        .addListener(events.FailedToLoad, () => {
          this.ready = false;
        })
        .catch(() => undefined);
      void plugin
        .addListener(events.Dismissed, () => {
          this.ready = false;
          void this.preload();
        })
        .catch(() => undefined);
      void plugin
        .addListener(events.FailedToShow, () => {
          this.ready = false;
          void this.preload();
        })
        .catch(() => undefined);
      await this.preload();
    } catch {
      this.plugin = null;
      this.initialized = false;
    }
  }

  /** Carga un interstitial para tenerlo listo. No lanza nunca. */
  private async preload(): Promise<void> {
    if (!this.plugin) return;
    try {
      // Sin `isTesting`: las IDs de prueba ya sirven anuncios de prueba
      // solas, y con las IDs reales no queremos forzar el modo prueba.
      await this.plugin.prepareInterstitial({ adId: INTERSTITIAL_AD_UNIT_ID });
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  /**
   * Intenta mostrar un interstitial al salir de una partida terminada.
   * Fire-and-forget: nunca lanza y nunca bloquea a quien llama. Si no
   * toca (cooldown, sin partida terminada, anuncios quitados) o no hay
   * anuncio listo, no pasa nada y el juego sigue.
   */
  maybeShow(matchFinished: boolean, adsRemoved: boolean, nowMs: number = Date.now()): void {
    if (
      !shouldShowInterstitial({ adsRemoved, lastShownAtMs: this.lastShownAtMs }, matchFinished, nowMs)
    ) {
      return;
    }
    if (!this.plugin || !this.ready) return;
    // Se anota ANTES de mostrar: un doble toque no muestra dos anuncios
    // y el cooldown cuenta desde el intento, no desde el cierre.
    this.lastShownAtMs = nowMs;
    this.ready = false;
    void this.plugin.showInterstitial().catch(() => {
      // Si no se pudo mostrar, se recarga para el próximo intento.
      void this.preload();
    });
  }
}

/** Controlador único que usa la app. */
export const interstitialAds = new InterstitialAds();

/**
 * Inicialización perezosa de AdMob: la llama App al arrancar. No bloquea
 * nada y no hace nada en web.
 */
export function initAds(): void {
  void interstitialAds.init().catch(() => undefined);
}

/**
 * Entrada única que usa la UI al salir del panel de resultados de una
 * partida terminada. Lee si el jugador quitó los anuncios de su economía
 * y dispara el intento (fire-and-forget, nunca bloquea la salida).
 */
export function maybeShowInterstitialOnMatchExit(matchFinished: boolean): void {
  let adsRemoved = false;
  try {
    adsRemoved = getEconomy().adsRemoved === true;
  } catch {
    adsRemoved = false;
  }
  interstitialAds.maybeShow(matchFinished, adsRemoved);
}
