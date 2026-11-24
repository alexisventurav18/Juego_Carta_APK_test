import { useState, type CSSProperties } from 'react';
import { getMotionConfigForAccent, type MotionConfig } from '../lib/motion';

interface AmbientParticlesProps {
  /**
   * Color de acento del modo (GAME_ENVIRONMENTS[modo].accent): de él se
   * deriva el tipo de partícula. Sin acento, destellos dorados.
   */
  accent?: string;
}

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  /** Retraso negativo: la partícula ya va a mitad de camino al montar. */
  delay: number;
}

function makeParticles(config: MotionConfig): Particle[] {
  return Array.from({ length: config.particleCount }, (_, i) => ({
    id: i,
    left: 2 + Math.random() * 96,
    top: 8 + Math.random() * 84,
    size: 4 + Math.random() * 6,
    duration: config.minDurationS + Math.random() * (config.maxDurationS - config.minDurationS),
    delay: -Math.random() * config.maxDurationS,
  }));
}

/**
 * Aspecto de la partícula según el modo. El color es el acento del modo;
 * la opacidad base (0.45) solo se ve si las animaciones están apagadas
 * (prefers-reduced-motion): durante la animación mandan los keyframes.
 */
function particleStyle(config: MotionConfig, particle: Particle): CSSProperties {
  const base: CSSProperties = {
    left: `${particle.left}%`,
    top: `${particle.top}%`,
    width: particle.size,
    height: config.kind === 'drops' ? particle.size * 1.4 : particle.size,
    opacity: 0.45,
    animationDuration: `${particle.duration}s`,
    animationDelay: `${particle.delay}s`,
  };
  switch (config.kind) {
    case 'bubbles':
      return { ...base, backgroundColor: `${config.accent}40`, border: `1px solid ${config.accent}` };
    case 'sparkles':
    case 'embers':
      return {
        ...base,
        background: `radial-gradient(circle, ${config.accent} 0%, ${config.accent}00 70%)`,
      };
    case 'drops':
    default:
      return { ...base, backgroundColor: config.accent };
  }
}

/**
 * Ambiente animado de la mesa: una capa decorativa de pocas partículas
 * (10-14) que se mueven lento, distinta por modo. Es solo decoración:
 * `pointer-events: none`, va por debajo de la rejilla de la mesa y solo
 * anima `transform` y `opacity`. El modo no cambia durante la partida,
 * así que la config y las partículas se fijan al montar.
 */
export default function AmbientParticles({ accent }: AmbientParticlesProps) {
  const [config] = useState(() => getMotionConfigForAccent(accent));
  const [particles] = useState(() => makeParticles(config));

  return (
    <div aria-hidden className="ambient-layer z-0">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`ambient-particle ambient-${config.kind}`}
          style={particleStyle(config, particle)}
        />
      ))}
    </div>
  );
}
