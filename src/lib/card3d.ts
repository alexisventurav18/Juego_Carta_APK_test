/**
 * Clases y constantes de las cartas 3D (vía 1).
 *
 * Módulo puro, sin DOM: solo compone nombres de clase (la hoja de estilos vive en
 * index.css, sección «Cartas 3D»). El giro de reparto corre al montar la carta: las
 * manos se reparten carta a carta y las cartas de la mesa aparecen una a una, así el
 * escalonado sale solo, sin temporizadores.
 */

/** Sombra en capas de la cara/dorso de la carta (`.card-3d` en index.css). */
export const CARD_3D_CLASS = 'card-3d';
/** Giro de reparto de dorso a cara al montar la carta (`.card-deal` en index.css). */
export const CARD_DEAL_CLASS = 'card-deal';
/** Envoltorio interactivo: inclinación leve al presionar (`.card-press` en index.css). */
export const CARD_PRESS_CLASS = 'card-press';
/** Carta elegida (`.card-picked` en index.css): se eleva con aro dorado. */
export const CARD_PICKED_CLASS = 'card-picked';
/** Carta jugable (`.card-playable` en index.css): aro verde suave. */
export const CARD_PLAYABLE_CLASS = 'card-playable';
/** Duración del giro de reparto, en ms: debe coincidir con `card-deal-flip` en index.css. */
export const CARD_DEAL_MS = 280;

/**
 * Clases de la cara de una carta: sombra 3D y, salvo `deal: false`, giro de reparto al
 * montar. Los dorsos no giran: el mazo del barajado se remonta a cada tick (80 ms) y un
 * giro de 280 ms se reiniciaría sin parar.
 */
export function cardFaceClass(deal = true): string {
  return deal ? `${CARD_3D_CLASS} ${CARD_DEAL_CLASS}` : CARD_3D_CLASS;
}

/** Clases del dorso de una carta: sombra 3D sin giro de reparto. */
export function cardBackClass(): string {
  return CARD_3D_CLASS;
}

/**
 * Estado de una carta interactiva: elegida manda sobre jugable, como antes. Devuelve
 * '' sin estado. El `hover:-translate-y-1` de la carta jugable lo pone cada componente
 * con Tailwind, no esta función.
 */
export function cardStateClass(selected: boolean, playable: boolean): string {
  if (selected) return CARD_PICKED_CLASS;
  if (playable) return CARD_PLAYABLE_CLASS;
  return '';
}
