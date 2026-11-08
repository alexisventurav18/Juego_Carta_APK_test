import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Build } from '@/games/casinoCapture';
import PlayingCard from './PlayingCard';

interface TableBuildProps {
  build: Build;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

const STEP_X = 8;
const STEP_Y = 5;
/** Tiempo que se muestra el nombre completo antes de pasar a la insignia compacta. */
const FULL_LABEL_MS = 1600;

function PairsIcon() {
  return (
    <svg viewBox="0 0 12 14" aria-hidden>
      <rect x="3" y="1" width="8" height="10" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="3" width="8" height="10" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export default function TableBuild({ build, selected, disabled, onSelect }: TableBuildProps) {
  const depth = build.cards.length - 1;
  const previousSize = useRef(build.cards.length);
  const previousKind = useRef(build.kind);
  const [celebrating, setCelebrating] = useState(false);
  const [showFullLabel, setShowFullLabel] = useState(true);

  useEffect(() => {
    const becameLargePairs =
      build.kind === 'pairs' &&
      build.cards.length >= 6 &&
      (previousSize.current < 6 || previousKind.current !== 'pairs');
    if (becameLargePairs) {
      setCelebrating(true);
    }
    previousSize.current = build.cards.length;
    previousKind.current = build.kind;
  }, [build.cards.length, build.kind]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 1100);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    setShowFullLabel(true);
    const timer = window.setTimeout(() => setShowFullLabel(false), FULL_LABEL_MS);
    return () => window.clearTimeout(timer);
  }, [build.id, build.kind, build.value, build.cards.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const kindLabel = build.kind === 'pairs' ? 'Pares de' : 'Sumatoria de';

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-label={`${kindLabel} ${build.value}`}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={onKeyDown}
      className={`casino-build relative flex shrink-0 cursor-pointer flex-col items-center transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        disabled ? 'cursor-not-allowed opacity-80' : 'hover:-translate-y-1'
      } ${celebrating ? 'animate-pairs-combo' : ''}`}
    >
      <span
        aria-hidden
        className={`casino-build-label casino-build-label-full ${
          showFullLabel ? 'casino-build-label-visible animate-combo-label' : 'casino-build-label-hidden'
        }`}
      >
        {kindLabel} {build.value}
      </span>
      <div className={`casino-build-stack ${selected ? 'bg-amber-300/25 ring-2 ring-amber-400' : ''}`}>
        <span
          aria-hidden
          className={`casino-build-label casino-build-label-compact ${
            showFullLabel ? 'casino-build-label-hidden' : 'casino-build-label-visible'
          }`}
        >
          {build.kind === 'pairs' ? <PairsIcon /> : <span>Σ</span>}
          {build.value}
        </span>
        {celebrating && (
          <span className="absolute inset-x-0 -top-3 z-30 mx-auto w-max rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            ¡Pares!
          </span>
        )}
        <div className="grid pt-2" style={{ marginRight: depth * STEP_X, marginBottom: depth * STEP_Y }}>
          {build.cards.map((card, i) => (
            <div
              key={card.id}
              style={{
                gridArea: '1 / 1',
                transform: `translate(${i * STEP_X}px, ${i * STEP_Y}px)`,
                zIndex: i + 1,
              }}
            >
              <PlayingCard card={card} size="table" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
