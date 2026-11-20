import { engineIfReady, getEngine, type Engine } from './audioEngine';
import { getPrefs, subscribePrefs } from './soundPrefs';
import { MUSIC_THEMES, type MusicTheme, type MusicThemeId } from './musicThemes';

/**
 * Música de fondo sintetizada (sin archivos): un arpegio suave sobre una progresión de acordes, con bajo y
 * un güiro discreto, al estilo dominicano. Cada pantalla tiene su propio tema (menú y cada modo de juego)
 * y todos suenan más suaves que el tema único anterior: volúmenes más bajos, ataque más lento y filtro
 * más cerrado. Se programa unos segundos por adelantado.
 *
 * Cambiar de tema no produce clics ni pops: el bus propio de la música baja en rampa, el programador se
 * reinicia limpio con el tema nuevo y el bus vuelve a subir en rampa.
 */
const LOOKAHEAD_S = 0.6;
const TICK_MS = 150;
/** Milisegundos de silencio entre que baja el tema viejo y empieza el nuevo. */
const THEME_SWITCH_MS = 400;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let theme: MusicTheme = MUSIC_THEMES.lobby;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let noiseBuffer: AudioBuffer | null = null;
/** Bus propio de la música (dentro del bus de música del motor): solo sirve para el fundido entre temas. */
let themeGain: GainNode | null = null;
let switchTimer: number | null = null;
let switchToken = 0;

function stepSeconds(): number {
  return 60 / theme.bpm / 2; // corchea
}

function ensureThemeGain(e: Engine): GainNode {
  if (!themeGain) {
    themeGain = e.ctx.createGain();
    themeGain.gain.value = 1;
    themeGain.connect(e.music);
  }
  return themeGain;
}

function pluck(
  ctx: AudioContext,
  bus: GainNode,
  midi: number,
  t: number,
  vol: number,
  len: number,
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = theme.wave;
  osc.frequency.setValueAtTime(NOTE(midi), t);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(theme.pluckCutoff, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, theme.pluckCutoff * 0.3), t + len);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + theme.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + len + 0.05);
}

function guira(ctx: AudioContext, bus: GainNode, t: number, vol: number): void {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start(t);
}

function scheduleStep(ctx: AudioContext, bus: GainNode, t: number, index: number): void {
  const stepLen = stepSeconds();
  const chord = theme.chords[Math.floor(index / theme.stepsPerChord) % theme.chords.length];
  const inChord = index % theme.stepsPerChord;
  pluck(ctx, bus, chord.notes[theme.arpeggio[inChord]], t, theme.pluckVol, stepLen * theme.pluckLen);
  if (inChord === 0 || inChord === 4) pluck(ctx, bus, chord.root, t, theme.bassVol, stepLen * 3);
  if (theme.guiraVol > 0 && inChord % 2 === 1) guira(ctx, bus, t, theme.guiraVol);
}

function tick(): void {
  const e = getEngine();
  if (!e) return;
  // El bus del fundido se crea aquí para que exista siempre que suene música, también si el motor se
  // creó dentro de este mismo tick.
  const bus = ensureThemeGain(e);
  if (nextTime < e.ctx.currentTime) nextTime = e.ctx.currentTime + 0.05;
  while (nextTime < e.ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(e.ctx, bus, nextTime, step);
    step += 1;
    nextTime += stepSeconds();
  }
}

function wanted(): boolean {
  const p = getPrefs();
  return p.musicOn && !p.muted && p.music > 0 && document.visibilityState === 'visible';
}

function startScheduler(e: Engine | null): void {
  nextTime = 0;
  step = 0;
  tick();
  timer = window.setInterval(tick, TICK_MS);
  if (e && themeGain && switchTimer === null) {
    themeGain.gain.setTargetAtTime(1, e.ctx.currentTime, 0.05);
  }
}

function sync(): void {
  if (wanted() && timer === null) {
    const e = engineIfReady();
    startScheduler(e);
  } else if (!wanted() && timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

/** Tema que suena ahora mismo (o que sonará al arrancar la música). */
export function getMusicTheme(): MusicThemeId {
  return theme.id;
}

/**
 * Cambia el tema de fondo (menú o modo de juego). Si la música suena, el tema viejo baja en rampa, el
 * programador se detiene y el nuevo arranca limpio tras una pausa corta; si está parada, el cambio solo
 * se guarda y se aplica al arrancar. Antes del primer gesto del usuario no hay motor de audio: en ese
 * caso también solo se guarda el tema.
 */
export function setMusicTheme(id: MusicThemeId): void {
  if (id === theme.id) return;
  theme = MUSIC_THEMES[id];
  nextTime = 0;
  step = 0;
  const token = ++switchToken;
  if (switchTimer !== null) {
    window.clearTimeout(switchTimer);
    switchTimer = null;
  }
  const e = engineIfReady();
  if (!e || timer === null || !themeGain) return;
  // Parar de programar notas nuevas con el tempo viejo y bajar el bus en rampa: las notas ya
  // programadas (como mucho 0.6 s por delante) también bajan con él, sin corte brusco.
  window.clearInterval(timer);
  timer = null;
  themeGain.gain.cancelScheduledValues(e.ctx.currentTime);
  themeGain.gain.setTargetAtTime(0, e.ctx.currentTime, 0.12);
  switchTimer = window.setTimeout(() => {
    switchTimer = null;
    if (token !== switchToken) return;
    if (!wanted()) return;
    const engine = engineIfReady();
    if (!engine) return;
    startScheduler(engine);
    if (themeGain) themeGain.gain.setTargetAtTime(1, engine.ctx.currentTime, 0.25);
  }, THEME_SWITCH_MS);
}

let installed = false;

/**
 * Arranca la música tras el primer gesto del usuario (los navegadores bloquean el audio antes) y la mantiene
 * al día con las preferencias. Se detiene al pasar la app a segundo plano.
 */
export function installBackgroundMusic(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const start = () => {
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
    sync();
    subscribePrefs(sync);
    document.addEventListener('visibilitychange', sync);
  };
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);
}
