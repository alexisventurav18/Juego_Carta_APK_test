import type { Engine } from './audioEngine';

export type SoundEffect =
  | 'cardSlide' // Al robar o mover una carta
  | 'cardShuffle' // Al repartir o mezclar el mazo
  | 'pairMatch' // Al bajar un par a la mesa
  | 'cagaoAlert' // Al robar el As de Picas ("El Cagao")
  | 'steal' // Al robar el paquete de un rival (El Robaíto)
  | 'win' // Al ganar la partida (fanfarria)
  | 'lose' // Al perder la partida
  | 'click' // Al pulsar un botón
  | 'coin' // Al recibir monedas de recompensa
  | 'turn' // Cuando empieza tu turno
  | 'virao'; // Al llevarse todas las cartas de la mesa (Casino)

// Conecta una ganancia al bus principal y, si echoAmount > 0, envía parte al bus de eco.
function routeGain(ctx: AudioContext, gain: GainNode, bus: AudioNode, echo: AudioNode, echoAmount: number): void {
  gain.connect(bus);
  if (echoAmount > 0) {
    const send = ctx.createGain();
    send.gain.value = echoAmount;
    gain.connect(send);
    send.connect(echo);
  }
}

// Crea ruido blanco filtrado para simular el roce del papel/cartón
function playCardNoise(
  ctx: AudioContext,
  bus: AudioNode,
  echo: AudioNode,
  duration: number,
  startTime: number,
  filterFreq: number,
  echoAmount = 0,
): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);
  filter.Q.setValueAtTime(1.5, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, startTime);
  gain.gain.exponentialRampToValueAtTime(0.25, startTime + duration * 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  routeGain(ctx, gain, bus, echo, echoAmount);

  noise.start(startTime);
  noise.stop(startTime + duration);
}

// Crea tonos musicales sintéticos para alertas, pares y victoria
function playTone(
  ctx: AudioContext,
  bus: AudioNode,
  echo: AudioNode,
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  volume = 0.15,
  echoAmount = 0,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  routeGain(ctx, gain, bus, echo, echoAmount);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Programa un efecto en el motor de audio (sin mirar las preferencias: el silencio y los volúmenes los
 * aplica quien llama, como `useGameSounds`). Puro y sin React, para poder probarlo en Node.
 */
export function playEffect(engine: Engine, effect: SoundEffect): void {
  const { ctx, sfx, echo } = engine;
  const now = ctx.currentTime;

  switch (effect) {
    case 'cardSlide':
      // Sonido corto y seco de carta deslizándose
      playCardNoise(ctx, sfx, echo, 0.09, now, 1800);
      break;

    case 'cardShuffle':
      // Ráfaga rápida de varias cartas chocando al barajar/repartir
      for (let i = 0; i < 6; i++) {
        playCardNoise(ctx, sfx, echo, 0.06, now + i * 0.045, 1400 + i * 150);
      }
      break;

    case 'pairMatch':
      // Roce de cartas + acorde ascendente agradable
      playCardNoise(ctx, sfx, echo, 0.08, now, 1600);
      playTone(ctx, sfx, echo, 523.25, 'triangle', now + 0.03, 0.18, 0.14); // Do5
      playTone(ctx, sfx, echo, 659.25, 'triangle', now + 0.09, 0.25, 0.16); // Mi5
      break;

    case 'cagaoAlert':
      // Tono de tensión grave descendente al jalar el As de Picas
      playCardNoise(ctx, sfx, echo, 0.1, now, 1200);
      playTone(ctx, sfx, echo, 220, 'sawtooth', now + 0.05, 0.22, 0.12); // La3
      playTone(ctx, sfx, echo, 155.56, 'sawtooth', now + 0.2, 0.35, 0.14); // Re#3 (tritono de tensión)
      break;

    case 'steal':
      // Barrido de cartas y arpegio ascendente: ¡te llevaste el paquete!
      playCardNoise(ctx, sfx, echo, 0.12, now, 1000);
      playCardNoise(ctx, sfx, echo, 0.08, now + 0.07, 1900);
      playTone(ctx, sfx, echo, 392.0, 'triangle', now + 0.04, 0.14, 0.13); // Sol4
      playTone(ctx, sfx, echo, 587.33, 'triangle', now + 0.12, 0.16, 0.15); // Re5
      playTone(ctx, sfx, echo, 880.0, 'triangle', now + 0.2, 0.3, 0.16); // La5
      break;

    case 'win': {
      // Fanfarria de victoria: arpegio en Do mayor a dos octavas, acorde final y
      // un golpe de pandereta, todo con eco para que llene la pantalla.
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      fanfare.forEach((freq, i) => playTone(ctx, sfx, echo, freq, 'triangle', now + i * 0.09, 0.38, 0.16, 0.5));
      [523.25, 659.25, 783.99, 1046.5].forEach((freq) =>
        playTone(ctx, sfx, echo, freq, 'triangle', now + 0.56, 0.85, 0.13, 0.6),
      );
      playCardNoise(ctx, sfx, echo, 0.1, now, 5200, 0.2);
      playCardNoise(ctx, sfx, echo, 0.1, now + 0.27, 5200, 0.2);
      break;
    }

    case 'lose': {
      // Derrota: línea descendente en La menor, más lenta y grave, con un golpe
      // bajo al final y eco, para que se sienta el bajón.
      const descent = [440, 349.23, 293.66, 220];
      descent.forEach((freq, i) =>
        playTone(
          ctx,
          sfx,
          echo,
          freq,
          i === 3 ? 'sawtooth' : 'triangle',
          now + i * 0.28,
          i === 3 ? 0.75 : 0.3,
          i === 3 ? 0.11 : 0.14,
          0.5,
        ),
      );
      playTone(ctx, sfx, echo, 55, 'sine', now + 0.84, 0.6, 0.18, 0.3); // Golpe bajo
      playTone(ctx, sfx, echo, 110, 'sine', now + 0.84, 0.3, 0.08, 0.3);
      break;
    }

    case 'click':
      // Tique corto al pulsar un botón
      playCardNoise(ctx, sfx, echo, 0.04, now, 2600);
      playTone(ctx, sfx, echo, 1250, 'sine', now, 0.05, 0.05);
      break;

    case 'coin':
      // Tintineo brillante de dos notas al recibir monedas
      playTone(ctx, sfx, echo, 1318.51, 'triangle', now, 0.12, 0.16, 0.4); // Mi6
      playTone(ctx, sfx, echo, 1975.53, 'triangle', now + 0.08, 0.28, 0.16, 0.4); // Si6
      break;

    case 'turn':
      // Aviso suave de que te toca: dos notas claras, sin asustar
      playTone(ctx, sfx, echo, 880.0, 'triangle', now, 0.12, 0.11, 0.25); // La5
      playTone(ctx, sfx, echo, 1318.51, 'triangle', now + 0.09, 0.2, 0.11, 0.25); // Mi6
      break;

    case 'virao': {
      // Barrido de mesa (virao): roce + arpegio ascendente rápido
      playCardNoise(ctx, sfx, echo, 0.18, now, 1100, 0.3);
      const rise = [392.0, 493.88, 587.33, 783.99];
      rise.forEach((freq, i) => playTone(ctx, sfx, echo, freq, 'triangle', now + i * 0.07, 0.16, 0.14, 0.4));
      break;
    }
  }
}
