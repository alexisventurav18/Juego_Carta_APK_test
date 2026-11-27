import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdMobPlugin, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import {
  AD_COOLDOWN_MS,
  ADMOB_APP_ID,
  INTERSTITIAL_AD_UNIT_ID,
  InterstitialAds,
  interstitialAds,
  maybeShowInterstitialOnMatchExit,
  shouldShowInterstitial,
} from '../src/lib/ads';
import { defaultEconomy, loadEconomy } from '../src/lib/economy';
import { sanitizeProgressSnapshot } from '../src/games/progress';
import { DEFAULT_VISUAL_PREFS } from '../src/lib/visualPrefs';

/** Nombres de evento del plugin, sin cargar el paquete real en los tests. */
const EVENTS = {
  Loaded: 'interstitialAdLoaded',
  FailedToLoad: 'interstitialAdFailedToLoad',
  Showed: 'interstitialAdShowed',
  FailedToShow: 'interstitialAdFailedToShow',
  Dismissed: 'interstitialAdDismissed',
} as unknown as typeof InterstitialAdPluginEvents;

interface FakePlugin {
  initialize: () => Promise<void>;
  prepareInterstitial: (options: { adId: string }) => Promise<{ adId: string }>;
  showInterstitial: () => Promise<void>;
  addListener: (event: string, cb: (...args: never[]) => void) => Promise<{ remove: () => Promise<void> }>;
  emit: (event: string) => void;
  counts: () => { init: number; prepare: number; show: number };
  lastAdId: () => string | null;
}

function makeFakePlugin(
  opts: { initFails?: boolean; prepareFails?: boolean; showFails?: boolean } = {},
): FakePlugin {
  const listeners = new Map<string, Array<(...args: never[]) => void>>();
  let init = 0;
  let prepare = 0;
  let show = 0;
  let lastAdId: string | null = null;
  return {
    initialize: async () => {
      init++;
      if (opts.initFails) throw new Error('init fail');
    },
    prepareInterstitial: async (options: { adId: string }) => {
      prepare++;
      lastAdId = options.adId;
      if (opts.prepareFails) throw new Error('prepare fail');
      return { adId: options.adId };
    },
    showInterstitial: async () => {
      show++;
      if (opts.showFails) throw new Error('show fail');
    },
    addListener: async (event: string, cb: (...args: never[]) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(cb);
      listeners.set(event, list);
      return { remove: async () => undefined };
    },
    emit: (event: string) => {
      for (const cb of listeners.get(event) ?? []) cb();
    },
    counts: () => ({ init, prepare, show }),
    lastAdId: () => lastAdId,
  };
}

function asPlugin(fake: FakePlugin): AdMobPlugin {
  return fake as unknown as AdMobPlugin;
}

describe('configuración de AdMob', () => {
  it('usa las IDs oficiales de prueba de Google (nada real todavía)', () => {
    assert.equal(ADMOB_APP_ID, 'ca-app-pub-3940256099942544~3347511713');
    assert.equal(INTERSTITIAL_AD_UNIT_ID, 'ca-app-pub-3940256099942544/1033173712');
  });

  it('el cooldown es de 3 minutos', () => {
    assert.equal(AD_COOLDOWN_MS, 3 * 60 * 1000);
  });
});

describe('shouldShowInterstitial (puro)', () => {
  const NOW = 1_000_000;

  it('sin partida terminada nunca toca anuncio', () => {
    assert.equal(shouldShowInterstitial({ adsRemoved: false, lastShownAtMs: null }, false, NOW), false);
  });

  it('con "quitar anuncios" nunca toca anuncio', () => {
    assert.equal(shouldShowInterstitial({ adsRemoved: true, lastShownAtMs: null }, true, NOW), false);
  });

  it('sin anuncio previo y partida terminada, toca', () => {
    assert.equal(shouldShowInterstitial({ adsRemoved: false, lastShownAtMs: null }, true, NOW), true);
  });

  it('dentro del cooldown no toca', () => {
    const gate = { adsRemoved: false, lastShownAtMs: NOW - AD_COOLDOWN_MS + 1000 };
    assert.equal(shouldShowInterstitial(gate, true, NOW), false);
  });

  it('justo al cumplir el cooldown vuelve a tocar', () => {
    const gate = { adsRemoved: false, lastShownAtMs: NOW - AD_COOLDOWN_MS };
    assert.equal(shouldShowInterstitial(gate, true, NOW), true);
  });

  it('pasado el cooldown toca', () => {
    const gate = { adsRemoved: false, lastShownAtMs: NOW - AD_COOLDOWN_MS - 1000 };
    assert.equal(shouldShowInterstitial(gate, true, NOW), true);
  });
});

describe('InterstitialAds con plugin falso', () => {
  it('inicializa y precarga el interstitial con la ID de prueba', async () => {
    const fake = makeFakePlugin();
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    assert.equal(fake.counts().init, 1);
    assert.equal(fake.counts().prepare, 1);
    assert.equal(fake.lastAdId(), INTERSTITIAL_AD_UNIT_ID);
    assert.equal(ads.isReady(), true);
  });

  it('muestra una vez y anota el momento (doble intento no duplica)', async () => {
    const fake = makeFakePlugin();
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    ads.maybeShow(true, false, 1_000_000);
    ads.maybeShow(true, false, 1_000_000);
    assert.equal(fake.counts().show, 1, 'el segundo intento cae en el cooldown');
    assert.equal(ads.getLastShownAtMs(), 1_000_000);
    assert.equal(ads.isReady(), false, 'tras mostrar ya no está listo');
  });

  it('sin anuncio listo no muestra nada', async () => {
    const fake = makeFakePlugin({ prepareFails: true });
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    assert.equal(ads.isReady(), false);
    ads.maybeShow(true, false, 1_000_000);
    assert.equal(fake.counts().show, 0);
    assert.equal(ads.getLastShownAtMs(), null, 'el intento fallido no anota nada');
  });

  it('con "quitar anuncios" no muestra aunque esté listo', async () => {
    const fake = makeFakePlugin();
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    ads.maybeShow(true, true, 1_000_000);
    assert.equal(fake.counts().show, 0);
    assert.equal(ads.getLastShownAtMs(), null);
  });

  it('en mitad de partida no muestra', async () => {
    const fake = makeFakePlugin();
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    ads.maybeShow(false, false, 1_000_000);
    assert.equal(fake.counts().show, 0);
  });

  it('al descartar el anuncio se precarga el siguiente', async () => {
    const fake = makeFakePlugin();
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    ads.maybeShow(true, false, 1_000_000);
    assert.equal(fake.counts().prepare, 1);
    fake.emit('interstitialAdDismissed');
    // La recarga es asíncrona: se espera a que termine.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fake.counts().prepare, 2, 'se recarga tras descartar');
    assert.equal(ads.isReady(), true);
  });

  it('si mostrar falla no lanza y recarga para el próximo intento', async () => {
    const fake = makeFakePlugin({ showFails: true });
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    assert.doesNotThrow(() => ads.maybeShow(true, false, 1_000_000));
    assert.equal(fake.counts().show, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fake.counts().prepare, 2, 'tras fallar se recarga');
  });

  it('si inicializar falla, todo es no-op y no lanza', async () => {
    const fake = makeFakePlugin({ initFails: true });
    const ads = new InterstitialAds();
    await ads.initWithPlugin(asPlugin(fake), EVENTS);
    assert.equal(ads.isReady(), false);
    assert.doesNotThrow(() => ads.maybeShow(true, false, 1_000_000));
    assert.equal(fake.counts().show, 0);
  });
});

describe('cableado con la app (sin plugin nativo)', () => {
  it('init() en web/node no hace nada y no lanza', async () => {
    await interstitialAds.init();
    assert.equal(interstitialAds.isReady(), false);
  });

  it('salir de una partida terminada sin plugin no lanza ni bloquea', () => {
    assert.doesNotThrow(() => maybeShowInterstitialOnMatchExit(true));
    assert.doesNotThrow(() => maybeShowInterstitialOnMatchExit(false));
  });
});

describe('flag adsRemoved en la economía', () => {
  it('por defecto es false', () => {
    assert.equal(defaultEconomy().adsRemoved, false);
  });

  it('una economía vieja sin el campo queda en false', () => {
    const loaded = loadEconomy(JSON.stringify({ coins: 50 }), DEFAULT_VISUAL_PREFS);
    assert.equal(loaded.adsRemoved, false);
  });

  it('el flag se guarda y se lee', () => {
    const loaded = loadEconomy(JSON.stringify({ coins: 50, adsRemoved: true }), DEFAULT_VISUAL_PREFS);
    assert.equal(loaded.adsRemoved, true);
  });

  it('la foto de la nube conserva el flag', () => {
    const snapshot = sanitizeProgressSnapshot({
      economy: {
        coins: 10,
        wins: 0,
        gamesPlayed: 0,
        losses: 0,
        streak: 0,
        bestStreak: 0,
        winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
        xp: 0,
        lastDailyDate: null,
        ownedCardBacks: [],
        ownedTables: [],
        ownedMenus: [],
        awarded: [],
        missions: { daily: [], weekly: [] },
        dailyStreak: { days: 0, lastDate: null },
        achievements: { unlocked: [], claimed: [] },
        adsRemoved: true,
      },
      visualPrefs: null,
    });
    assert.equal(snapshot?.economy.adsRemoved, true);
  });

  it('la foto sin el flag lo deja en false', () => {
    const snapshot = sanitizeProgressSnapshot({
      economy: {
        coins: 10,
        wins: 0,
        gamesPlayed: 0,
        losses: 0,
        streak: 0,
        bestStreak: 0,
        winsByGame: { casino: 0, tresydos: 0, robaito: 0, cagao: 0 },
        xp: 0,
        lastDailyDate: null,
        ownedCardBacks: [],
        ownedTables: [],
        ownedMenus: [],
        awarded: [],
        missions: { daily: [], weekly: [] },
        dailyStreak: { days: 0, lastDate: null },
        achievements: { unlocked: [], claimed: [] },
      },
      visualPrefs: null,
    });
    assert.equal(snapshot?.economy.adsRemoved, false);
  });
});
