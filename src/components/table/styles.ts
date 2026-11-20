/** Botones de acción de las mesas de Casino y Tres y Dos: compactos para caber en la esquina inferior derecha. */
const BASE =
  'min-h-[clamp(34px,10dvh,46px)] min-w-0 touch-manipulation rounded-lg px-1 py-1 text-[10px] font-bold leading-tight transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:text-xs';

export const TB_MAIN = `${BASE} btn-gold font-extrabold`;
export const TB_FORM = `${BASE} btn-leaf`;
export const TB_DROP = `${BASE} btn-wood`;
export const TB_SING = `${BASE} btn-gold animate-pulse font-extrabold ring-2 ring-yellow-200`;
