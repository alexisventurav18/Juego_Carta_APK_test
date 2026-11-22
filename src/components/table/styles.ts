/** Botones de acción de las mesas de Casino y Tres y Dos: compactos para caber en la esquina inferior derecha.
 * En horizontal corto la columna lateral es estrecha (16%): a 10px "Capturar" pedía 49px y el botón
 * solo tenía 46px, así que la 'r' se cortaba. A <600px de alto el texto baja a 9px y el padding a 2px
 * (ahí "Convertir", el rótulo más largo, también cabe); en escritorio se queda en 10px. */
const BASE =
  'min-h-[clamp(34px,10dvh,46px)] min-w-0 touch-manipulation rounded-lg px-1 py-1 text-[10px] font-bold leading-tight transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 [@media(max-height:599px)]:px-[2px] [@media(max-height:599px)]:text-[9px]';

export const TB_MAIN = `${BASE} btn-gold font-extrabold`;
export const TB_FORM = `${BASE} btn-leaf`;
export const TB_DROP = `${BASE} btn-wood`;
export const TB_SING = `${BASE} btn-gold animate-pulse font-extrabold ring-2 ring-yellow-200`;
