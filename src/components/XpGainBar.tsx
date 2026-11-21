import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';
import { MAX_LEVEL, xpGainPhases, xpToNextLevel, type XpGain } from '../lib/experience';

/**
 * Barra de experiencia animada de la celebración de victoria.
 *
 * Estilo Duolingo / Clash Royale: el "+N XP" cuenta hacia arriba mientras la
 * barra se llena desde donde estaba; al cruzar un nivel estalla el aviso
 * dorado "¡Subiste al nivel N!" con su sonido y una vibración, y la barra
 * vuelve a empezar vacía en el nivel siguiente. Empieza con un pequeño
 * retraso para no pisar el tintineo de las monedas.
 */

const START_DELAY_MS = 500;
const LEVEL_UP_PAUSE_MS = 500;

interface XpGainBarProps {
  xpGain: XpGain | null;
}

export default function XpGainBar({ xpGain }: XpGainBarProps) {
  const { playSound } = useGameSounds();
  const segments = useMemo(
    () => (xpGain === null || xpGain.gained <= 0 ? [] : xpGainPhases(xpGain)),
    [xpGain],
  );
  const [started, setStarted] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  // Porcentaje que se ve en la barra: lo mueve el mismo rAF que el contador,
  // para que barra, número y texto "X / Y XP" avancen siempre en sincronía.
  const [displayPct, setDisplayPct] = useState(segments[0]?.fromPct ?? 0);
  const [shownXp, setShownXp] = useState(0);
  const [burst, setBurst] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);

  const done = segIdx >= segments.length;
  const currentLevel = done ? (xpGain?.levelAfter ?? 1) : segments[segIdx].level;
  const isMaxLevel = xpGain !== null && xpGain.levelAfter >= MAX_LEVEL;
  const needed = currentLevel >= MAX_LEVEL ? 0 : xpToNextLevel(currentLevel);
  const intoLevel = Math.round(displayPct * needed);

  // Retraso inicial y limpieza de todos los temporizadores al desmontar.
  useEffect(() => {
    const start = window.setTimeout(() => setStarted(true), START_DELAY_MS);
    timers.current.push(start);
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      window.cancelAnimationFrame(raf.current);
    };
  }, []);

  // Anima el segmento actual: la barra, el contador y el texto avanzan juntos
  // con el mismo rAF; al cruzar un nivel, estallido + sonido + vibración y
  // una pausa antes de seguir con el siguiente segmento.
  useEffect(() => {
    if (!started || segIdx >= segments.length) return;
    const seg = segments[segIdx];
    const duration = Math.max(400, Math.round(700 * Math.abs(seg.toPct - seg.fromPct)));
    const xpBeforeSegment = segments.slice(0, segIdx).reduce((sum, phase) => sum + phase.gainedInSegment, 0);
    setDisplayPct(seg.fromPct);
    const kick = window.setTimeout(() => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        setShownXp(xpBeforeSegment + Math.round(seg.gainedInSegment * progress));
        setDisplayPct(seg.fromPct + (seg.toPct - seg.fromPct) * progress);
        if (progress < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, 30);
    timers.current.push(kick);
    const finish = window.setTimeout(
      () => {
        if (seg.leveledUp) {
          setBurst(seg.level + 1);
          playSound('levelUp');
          try {
            navigator.vibrate?.([20, 40, 20]);
          } catch {
            // Sin vibración en este dispositivo: el sonido y el aviso bastan.
          }
        }
        const next = window.setTimeout(() => {
          setBurst(null);
          setSegIdx(segIdx + 1);
        }, seg.leveledUp ? LEVEL_UP_PAUSE_MS : 0);
        timers.current.push(next);
      },
      30 + duration,
    );
    timers.current.push(finish);
    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(finish);
      window.cancelAnimationFrame(raf.current);
    };
  }, [started, segIdx, segments, playSound]);

  if (xpGain === null || xpGain.gained <= 0) return null;

  return (
    <div
      role="status"
      aria-label={`+${xpGain.gained} XP, nivel ${xpGain.levelAfter}`}
      className="xp-gain-bar mx-auto w-full max-w-xs space-y-1.5 text-center"
    >
      <p className="flex items-center justify-center gap-1.5 text-base font-extrabold text-sky-300">
        <Star className="h-5 w-5 fill-sky-300" aria-hidden />
        +{shownXp} XP
      </p>
      <div className="xp-bar h-3.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-sky-200/30">
        <div
          className={`h-full rounded-full ${
            isMaxLevel ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-[#7FB5D5] to-[#0EA5B7]'
          }`}
          style={{ width: `${(displayPct * 100).toFixed(1)}%` }}
        />
      </div>
      <p className="text-xs font-bold text-amber-100/80">
        {isMaxLevel
          ? 'Nivel máximo'
          : `Nv. ${currentLevel} · ${intoLevel} / ${needed} XP`}
      </p>
      {burst !== null && (
        <p
          className="text-lg font-black text-amber-300 drop-shadow-[0_2px_12px_rgba(252,211,77,0.6)]"
          style={{ animation: 'victory-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
        >
          ¡Subiste al nivel {burst}!
        </p>
      )}
    </div>
  );
}
