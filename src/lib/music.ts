import { getEngine } from './audioEngine';
import { getPrefs, subscribePrefs } from './soundPrefs';

/**
 * Música de fondo sintetizada (sin archivos): un arpegio de guitarra suave sobre una progresión en La menor,
 * con bajo y un güiro discreto, al estilo de una bachata tranquila. Se programa unos segundos por adelantado.
 */
const BPM = 112;
const STEP = 60 / BPM / 2; // corchea
const LOOKAHEAD_S = 0.6;
const TICK_MS = 150;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// Acordes (midi): Am, Dm, E, Am
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 45, notes: [57, 60, 64, 69] },
  { root: 50, notes: [57, 62, 65, 69] },
  { root: 52, notes: [56, 59, 64, 68] },
  { root: 45, notes: [57, 60, 64, 69] },
];
const ARPEGGIO = [0, 1, 2, 3, 2, 1, 2, 1]; // índices dentro del acorde, por corchea
const STEPS_PER_CHORD = 8;

let timer: number | null = null;
let nextTime = 0;
let step = 0;
let noiseBuffer: AudioBuffer | null = null;

function pluck(ctx: AudioContext, bus: GainNode, midi: number, t: number, vol: number, len: number): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(NOTE(midi), t);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(600, t + len);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + len + 0.05);
}

function guira(ctx: AudioContext, bus: GainNode, t: number): void {
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
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start(t);
}

function scheduleStep(ctx: AudioContext, bus: GainNode, t: number, index: number): void {
  const chord = CHORDS[Math.floor(index / STEPS_PER_CHORD) % CHORDS.length];
  const inChord = index % STEPS_PER_CHORD;
  pluck(ctx, bus, chord.notes[ARPEGGIO[inChord]], t, 0.16, STEP * 2.4);
  if (inChord === 0 || inChord === 4) pluck(ctx, bus, chord.root, t, 0.26, STEP * 3);
  if (inChord % 2 === 1) guira(ctx, bus, t);
}

function tick(): void {
  const e = getEngine();
  if (!e) return;
  if (nextTime < e.ctx.currentTime) nextTime = e.ctx.currentTime + 0.05;
  while (nextTime < e.ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(e.ctx, e.music, nextTime, step);
    step += 1;
    nextTime += STEP;
  }
}

function sync(): void {
  const p = getPrefs();
  const wanted = p.musicOn && !p.muted && p.music > 0 && document.visibilityState === 'visible';
  if (wanted && timer === null) {
    nextTime = 0;
    tick();
    timer = window.setInterval(tick, TICK_MS);
  } else if (!wanted && timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
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
