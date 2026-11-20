import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

/**
 * Pruebas de los efectos de sonido con un AudioContext falso: se comprueba qué tonos y ruidos se programan
 * (frecuencias, orden y eco) sin necesidad de audio real. Las importaciones son relativas porque tsx no
 * resuelve el alias `@/` que usa Vite.
 */

class FakeParam {
  value = 0;
  calls: { method: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ method: 'setValueAtTime', value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push({ method: 'exponentialRampToValueAtTime', value, time });
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push({ method: 'linearRampToValueAtTime', value, time });
  }
  setTargetAtTime(value: number, time: number, constant: number): void {
    this.value = value;
    this.calls.push({ method: 'setTargetAtTime', value, time });
    void constant;
  }
}

let nodeId = 0;
class FakeNode {
  id = ++nodeId;
  connect(destination: FakeNode): FakeNode {
    FakeAudioContext.shared.connections.push({ from: this.id, to: destination.id });
    return destination;
  }
  disconnect(): void {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  startedAt: number | null = null;
  start(when = 0): void {
    this.startedAt = when;
    FakeAudioContext.shared.events.push({
      kind: 'osc',
      type: this.type,
      freq: this.frequency.value,
      start: when,
    });
  }
  stop(): void {}
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start(when = 0): void {
    FakeAudioContext.shared.events.push({ kind: 'noise', start: when, filterFreq: FakeAudioContext.shared.lastFilterFreq });
  }
  stop(): void {}
}

class FakeBiquadFilter extends FakeNode {
  type = 'bandpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeDelay extends FakeNode {
  delayTime = new FakeParam();
}

interface OscEvent {
  kind: 'osc';
  type: string;
  freq: number;
  start: number;
}
interface NoiseEvent {
  kind: 'noise';
  start: number;
  filterFreq: number | null;
}
type SoundEvent = OscEvent | NoiseEvent;

class FakeAudioContext {
  static shared = new FakeAudioContext();
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new FakeNode();
  events: SoundEvent[] = [];
  connections: { from: number; to: number }[] = [];
  lastFilterFreq: number | null = null;
  delays: FakeDelay[] = [];

  constructor() {
    return FakeAudioContext.shared;
  }
  resume(): void {}
  createGain(): FakeGain {
    return new FakeGain();
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  createBuffer(_channels: number, length: number, _sampleRate: number): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource();
  }
  createBiquadFilter(): FakeBiquadFilter {
    const filter = new FakeBiquadFilter();
    const originalSet = filter.frequency.setValueAtTime.bind(filter.frequency);
    filter.frequency.setValueAtTime = (value: number, time: number) => {
      FakeAudioContext.shared.lastFilterFreq = value;
      originalSet(value, time);
    };
    return filter;
  }
  createDelay(): FakeDelay {
    const delay = new FakeDelay();
    FakeAudioContext.shared.delays.push(delay);
    return delay;
  }
}

// La ventana falsa tiene que existir antes de importar el motor: soundPrefs lee localStorage al cargar.
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  AudioContext: FakeAudioContext,
};

const { getEngine } = await import('../src/lib/audioEngine');
const { playEffect } = await import('../src/lib/soundEffects');
import type { SoundEffect } from '../src/lib/soundEffects';

const fake = FakeAudioContext.shared;

function play(effect: SoundEffect): { oscs: OscEvent[]; noises: NoiseEvent[]; echoSends: number } {
  fake.events = [];
  fake.connections = [];
  const engine = getEngine();
  assert.ok(engine, 'el motor debe crearse con la ventana falsa');
  playEffect(engine, effect);
  const oscs = fake.events.filter((e): e is OscEvent => e.kind === 'osc');
  const noises = fake.events.filter((e): e is NoiseEvent => e.kind === 'noise');
  const echoSends = fake.connections.filter((c) => c.to === (engine as unknown as { echo: FakeNode }).echo.id).length;
  return { oscs, noises, echoSends };
}

describe('efectos de sonido', () => {
  before(() => {
    const engine = getEngine();
    assert.ok(engine, 'el motor debe crearse');
  });

  it('el motor tiene bus de eco con retardo de 0.16 s', () => {
    const engine = getEngine();
    assert.ok(engine?.echo, 'falta el bus de eco');
    assert.equal(fake.delays.length, 1);
    assert.equal(fake.delays[0].delayTime.value, 0.16);
  });

  it('win: fanfarria ascendente en Do mayor con acorde final y eco', () => {
    const { oscs, noises, echoSends } = play('win');
    assert.equal(oscs.length, 10);
    assert.deepEqual(
      oscs.map((o) => o.freq),
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 523.25, 659.25, 783.99, 1046.5],
    );
    assert.ok(oscs.every((o) => o.type === 'triangle'));
    assert.equal(noises.length, 2);
    assert.equal(echoSends, 12);
  });

  it('lose: línea descendente grave con golpe bajo y eco', () => {
    const { oscs, noises, echoSends } = play('lose');
    assert.equal(oscs.length, 6);
    assert.deepEqual(
      oscs.slice(0, 4).map((o) => o.freq),
      [440, 349.23, 293.66, 220],
    );
    assert.equal(oscs[3].type, 'sawtooth');
    assert.ok(oscs.some((o) => o.freq === 55 && o.type === 'sine'));
    assert.equal(noises.length, 0);
    assert.equal(echoSends, 6);
  });

  it('coin: tintineo brillante de dos notas', () => {
    const { oscs, echoSends } = play('coin');
    assert.deepEqual(
      oscs.map((o) => o.freq),
      [1318.51, 1975.53],
    );
    assert.equal(echoSends, 2);
  });

  it('turn: aviso suave de dos notas', () => {
    const { oscs, echoSends } = play('turn');
    assert.deepEqual(
      oscs.map((o) => o.freq),
      [880, 1318.51],
    );
    assert.equal(echoSends, 2);
  });

  it('virao: roce y arpegio ascendente', () => {
    const { oscs, noises, echoSends } = play('virao');
    assert.deepEqual(
      oscs.map((o) => o.freq),
      [392, 493.88, 587.33, 783.99],
    );
    assert.equal(noises.length, 1);
    assert.equal(echoSends, 5);
  });

  it('click: tique corto sin eco', () => {
    const { oscs, noises, echoSends } = play('click');
    assert.equal(oscs.length, 1);
    assert.equal(oscs[0].freq, 1250);
    assert.equal(noises.length, 1);
    assert.equal(echoSends, 0);
  });

  it('los efectos anteriores siguen sonando igual', () => {
    assert.equal(play('cardSlide').noises.length, 1);
    assert.equal(play('cardSlide').oscs.length, 0);
    assert.equal(play('cardShuffle').noises.length, 6);
    const pair = play('pairMatch');
    assert.deepEqual(
      pair.oscs.map((o) => o.freq),
      [523.25, 659.25],
    );
    const steal = play('steal');
    assert.deepEqual(
      steal.oscs.map((o) => o.freq),
      [392, 587.33, 880],
    );
    const alert = play('cagaoAlert');
    assert.deepEqual(
      alert.oscs.map((o) => o.freq),
      [220, 155.56],
    );
    assert.ok(alert.oscs.every((o) => o.type === 'sawtooth'));
  });
});
