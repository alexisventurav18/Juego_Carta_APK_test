import { getPrefs, subscribePrefs } from './soundPrefs';

/**
 * Un único AudioContext para toda la app, con tres buses: general (master), música y efectos.
 * Los volúmenes y el silencio de las preferencias se aplican aquí, así todo sonido los respeta.
 * Además hay un bus de eco (retardo con retroalimentación) para que los sonidos de victoria, derrota y
 * recompensas suenen con ambiente en vez de secos: los efectos le envían parte de su señal.
 */
export interface Engine {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  /** Entrada del eco: lo que se le envía vuelve con retardo y se mezcla en el master. */
  echo: GainNode;
}

let engine: Engine | null = null;

/** Retardo del eco (s) y cuánta señal vuelve a entrar en el retardo (0-1). */
const ECHO_DELAY_S = 0.16;
const ECHO_FEEDBACK = 0.35;
/** Cuánto del eco se escucha en la mezcla (0-1). */
const ECHO_WET = 0.45;

function applyPrefs(e: Engine): void {
  const p = getPrefs();
  const now = e.ctx.currentTime;
  const set = (node: GainNode, value: number) => node.gain.setTargetAtTime(value, now, 0.03);
  set(e.master, p.muted ? 0 : p.master);
  set(e.music, p.musicOn ? p.music : 0);
  set(e.sfx, p.sfxOn ? p.sfx : 0);
}

export function getEngine(): Engine | null {
  if (engine) {
    if (engine.ctx.state === 'suspended') void engine.ctx.resume();
    return engine;
  }
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  const music = ctx.createGain();
  const sfx = ctx.createGain();
  music.connect(master);
  sfx.connect(master);
  master.connect(ctx.destination);
  // Eco: entrada -> retardo -> (retroalimentación al retardo) y -> mezcla.
  const echo = ctx.createGain();
  const echoDelay = ctx.createDelay(0.5);
  echoDelay.delayTime.value = ECHO_DELAY_S;
  const echoFeedback = ctx.createGain();
  echoFeedback.gain.value = ECHO_FEEDBACK;
  const echoWet = ctx.createGain();
  echoWet.gain.value = ECHO_WET;
  echo.connect(echoDelay);
  echoDelay.connect(echoFeedback);
  echoFeedback.connect(echoDelay);
  echoDelay.connect(echoWet);
  echoWet.connect(master);
  const created: Engine = { ctx, music, sfx, master, echo };
  engine = created;
  applyPrefs(created);
  subscribePrefs(() => applyPrefs(created));
  if (ctx.state === 'suspended') void ctx.resume();
  return engine;
}

export function engineIfReady(): Engine | null {
  return engine;
}
