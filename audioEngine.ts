import { getPrefs, subscribePrefs } from './soundPrefs';

/**
 * Un único AudioContext para toda la app, con tres buses: general (master), música y efectos.
 * Los volúmenes y el silencio de las preferencias se aplican aquí, así todo sonido los respeta.
 */
export interface Engine {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
}

let engine: Engine | null = null;

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
  const created: Engine = { ctx, music, sfx, master };
  engine = created;
  applyPrefs(created);
  subscribePrefs(() => applyPrefs(created));
  if (ctx.state === 'suspended') void ctx.resume();
  return engine;
}

export function engineIfReady(): Engine | null {
  return engine;
}
