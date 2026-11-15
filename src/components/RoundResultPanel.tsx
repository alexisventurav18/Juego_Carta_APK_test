import { Trophy } from 'lucide-react';
import type { ScoreLine } from '@/games/shared';
import { PANEL_BUTTON } from './wood/styles';

interface RoundResultPanelProps {
  title: string;
  lines: [ScoreLine[], ScoreLine[]];
  totals: [number, number];
  teamNames: [string, string];
  compact?: boolean;
  onNextRound?: () => void;
  waitingFor?: string;
}

export default function RoundResultPanel({ title, lines, totals, teamNames, compact = false, onNextRound, waitingFor }: RoundResultPanelProps) {
  return (
    <section className={`wood-panel space-y-2 p-3 sm:space-y-4 sm:p-6 ${compact ? 'round-result-panel-compact' : ''}`}>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 shrink-0 text-amber-300 sm:h-5 sm:w-5" />
        <h2 className="min-w-0 text-base font-extrabold text-amber-50 sm:text-lg">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {([0, 1] as const).map((team) => (
          <div key={team} className="min-w-0 rounded-xl bg-black/30 p-2 ring-1 ring-amber-200/20 sm:p-4">
            <div className="flex items-center justify-between gap-1.5">
              <span className="min-w-0 truncate text-xs font-bold text-amber-50 sm:text-sm">{teamNames[team]}</span>
              <span className="shrink-0 text-xs font-extrabold text-amber-300 sm:text-sm">
                {totals[team] >= 0 ? `+${totals[team]}` : totals[team]}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-[11px] leading-tight text-amber-100/80 sm:mt-3 sm:space-y-1.5 sm:text-sm sm:leading-normal">
              {lines[team].length === 0 && <li>Sin puntos esta ronda</li>}
              {lines[team].map((line) => (
                <li key={line.label} className="flex items-start justify-between gap-1.5">
                  <span className="min-w-0 flex-1">
                    <span className={`block ${line.muted ? 'text-amber-100/40 line-through' : 'text-amber-50'}`}>
                      {line.label}
                    </span>
                    {line.detail && (
                      <span className={`block text-[10px] sm:text-xs ${line.muted ? 'text-amber-300' : 'text-amber-100/60'}`}>
                        {line.detail}
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 font-bold ${line.muted ? 'text-amber-100/40' : 'text-amber-50'}`}>
                    {line.muted ? '0' : line.points >= 0 ? `+${line.points}` : line.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {onNextRound && (
        <div className="flex justify-center">
          <button type="button" onClick={onNextRound} className={PANEL_BUTTON}>
            Repartir cartas y continuar
          </button>
        </div>
      )}
      {!onNextRound && waitingFor && (
        <p className="text-center text-sm text-amber-100/70">Esperando a {waitingFor} para repartir la siguiente ronda.</p>
      )}
    </section>
  );
}
