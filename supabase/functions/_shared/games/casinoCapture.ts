import type { Card } from './cards.ts';

export const MAX_CAPTURE_VALUE = 14;

/**
 * Tope de la suma mínima al enumerar combinaciones de la mesa. Una captura o una
 * sumatoria de pares puede agrupar hasta 6 grupos de 14 (6 × 14 = 84): un tope
 * menor, como 42, dejaba fuera formaciones válidas con mesas grandes (por ejemplo
 * cuatro reyes en pares, que suman 52). La suma usa el valor mínimo de cada carta
 * (el As vale 1 aquí); la validación real con As = 1 o 14 la hacen `formationValue`
 * e `isValidCapture`, así que este tope nunca descarta una jugada legal. El coste de
 * enumerar hasta 84 se controla con las condiciones necesarias de `canBeCapture` y
 * `canBePairsFormation`, que evitan evaluar la partición costosa en casi todos los
 * subconjuntos.
 */
export const MAX_TABLE_SUM = MAX_CAPTURE_VALUE * 6;

interface ValueSums {
  /** Suma de los valores mínimos (As = 1). */
  minSum: number;
  /** Suma de los valores máximos (As = 14). */
  maxSum: number;
  /** Mayor valor mínimo entre las cartas (una carta no cabe en un grupo menor que este). */
  maxMin: number;
}

function valueSums(valuesList: number[][]): ValueSums {
  let minSum = 0;
  let maxSum = 0;
  let maxMin = 0;
  for (const values of valuesList) {
    const lo = Math.min(...values);
    minSum += lo;
    maxSum += Math.max(...values);
    maxMin = Math.max(maxMin, lo);
  }
  return { minSum, maxSum, maxMin };
}

/**
 * Condición necesaria (y barata) para que `items` se puedan capturar con `card`:
 * algún valor de la carta admite repartirlas en grupos de ese valor. Es necesaria
 * porque cada grupo debe sumar exactamente el valor de la carta y ninguna carta
 * puede ir en un grupo menor que su valor mínimo. Nunca descarta una captura
 * válida; solo evita llamar a `isValidCapture` (que particiona en grupos y es
 * costoso) en los subconjuntos que no pueden serlo.
 */
export function canBeCapture(
  card: Card,
  items: TableItem[],
  sums: ValueSums = valueSums(items.map((item) => item.values)),
): boolean {
  if (items.length === 0) return false;
  // Los totales que se pueden alcanzar son minSum + 13·k (cada As puede valer 1 o 14).
  const aceCount = (sums.maxSum - sums.minSum) / 13;
  for (const target of captureValues(card)) {
    if (sums.maxMin > target) continue;
    for (let k = 0; k <= aceCount; k++) {
      const total = sums.minSum + 13 * k;
      if (total > 0 && total % target === 0) return true;
    }
  }
  return false;
}

/**
 * Condición necesaria (y barata) para que `card` + `looseCards` puedan formar
 * pares de un valor que `handAfter` pueda llevarse después: el total debe
 * repartirse en al menos 2 grupos iguales de un valor entre 2 y 14. Nunca
 * descarta una formación válida; solo evita llamar a `formationValue` con pares
 * (que prueba todas las asignaciones del As y el reparto en grupos) en los
 * subconjuntos que no pueden serlo.
 */
export function canBePairsFormation(card: Card, looseCards: Card[], handAfter: Card[]): boolean {
  const cards = [card, ...looseCards];
  const sums = valueSums(cards.map((c) => captureValues(c)));
  // Los totales que se pueden alcanzar son minSum + 13·k (cada As puede valer 1 o 14).
  const aceCount = (sums.maxSum - sums.minSum) / 13;
  for (let value = 2; value <= MAX_CAPTURE_VALUE; value++) {
    if (sums.maxMin > value) continue;
    if (!handCanCapture(handAfter, value)) continue;
    for (let k = 0; k <= aceCount; k++) {
      const total = sums.minSum + 13 * k;
      if (total % value !== 0) continue;
      const groups = total / value;
      if (groups >= 2 && groups <= cards.length) return true;
    }
  }
  return false;
}

export type FormationKind = 'sum' | 'pairs';

export interface Build {
  id: string;
  kind: FormationKind;
  value: number;
  cards: Card[];
  owner: number;
}

export interface TableItem {
  id: string;
  cards: Card[];
  values: number[];
  owner: number | null;
}

export function captureValues(card: Card): number[] {
  return card.rank === 1 ? [1, 14] : [card.rank];
}

export function tableItems(loose: Card[], builds: Build[]): TableItem[] {
  const looseItems = loose.map(
    (card): TableItem => ({ id: card.id, cards: [card], values: captureValues(card), owner: null }),
  );
  const buildItems = builds.map(
    (build): TableItem => ({ id: build.id, cards: build.cards, values: [build.value], owner: build.owner }),
  );
  return [...looseItems, ...buildItems];
}

function reachesTarget(items: TableItem[], mask: number, target: number): boolean {
  let sums = new Set<number>([0]);
  items.forEach((item, i) => {
    if (!(mask & (1 << i))) return;
    const next = new Set<number>();
    for (const sum of sums) {
      for (const value of item.values) if (sum + value <= target) next.add(sum + value);
    }
    sums = next;
  });
  return sums.has(target);
}

/** Cuántos grupos que suman `target` forman exactamente las cartas de `mask` (-1 si no se puede). */
function bestSplit(items: TableItem[], mask: number, target: number, memo: Map<number, number>): number {
  if (mask === 0) return 0;
  const known = memo.get(mask);
  if (known !== undefined) return known;
  const first = mask & -mask;
  const rest = mask ^ first;
  let best = -1;
  for (let sub = rest; ; sub = (sub - 1) & rest) {
    const group = sub | first;
    if (reachesTarget(items, group, target)) {
      const remaining = bestSplit(items, mask ^ group, target, memo);
      if (remaining >= 0) best = Math.max(best, remaining + 1);
    }
    if (sub === 0) break;
  }
  memo.set(mask, best);
  return best;
}

function canSplitIntoTargets(items: TableItem[], target: number, minGroups: number): boolean {
  const full = (1 << items.length) - 1;
  return bestSplit(items, full, target, new Map()) >= minGroups;
}

export function isValidCapture(card: Card, items: TableItem[]): boolean {
  if (items.length === 0) return false;
  return captureValues(card).some((value) => canSplitIntoTargets(items, value, 1));
}

export function pairsRankOf(card: Card, items: TableItem[]): number | null {
  return captureValues(card).find((value) => canSplitIntoTargets(items, value, 2)) ?? null;
}

/**
 * Cualquier jugador puede llevarse cualquier grupo de la mesa (también un par o una sumatoria
 * ajena), solo o junto con otros grupos, siempre que se pueda repartir en subconjuntos del valor
 * de su carta. `_seat` se conserva para no cambiar la firma que usan la interfaz y el bot.
 */
export function isLegalCapture(card: Card, items: TableItem[], _seat: number): boolean {
  void _seat;
  return isValidCapture(card, items);
}

export function captureOptions(card: Card, items: TableItem[], seat: number): TableItem[][] {
  const options: TableItem[][] = [];
  const walk = (start: number, chosen: TableItem[], minSum: number, maxSum: number, maxMin: number) => {
    // La partición en grupos solo se evalúa cuando el subconjunto puede ser una captura;
    // en mesas grandes casi ningún subconjunto pasa este filtro barato.
    if (
      chosen.length > 0 &&
      canBeCapture(card, chosen, { minSum, maxSum, maxMin }) &&
      isLegalCapture(card, chosen, seat)
    ) {
      options.push([...chosen]);
    }
    for (let i = start; i < items.length; i++) {
      const values = items[i].values;
      const lo = Math.min(...values);
      const nextMin = minSum + lo;
      if (nextMin > MAX_TABLE_SUM) continue;
      walk(i + 1, [...chosen, items[i]], nextMin, maxSum + Math.max(...values), Math.max(maxMin, lo));
    }
  };
  walk(0, [], 0, 0, 0);
  return options;
}

export function canCapture(card: Card, items: TableItem[], seat: number): boolean {
  return captureOptions(card, items, seat).length > 0;
}

export function handCanCapture(hand: Card[], value: number): boolean {
  return hand.some((card) => captureValues(card).includes(value));
}

function possibleTotals(cards: Card[]): number[] {
  let totals = [0];
  for (const card of cards) {
    const next = new Set<number>();
    for (const total of totals) {
      for (const value of captureValues(card)) {
        if (total + value <= MAX_CAPTURE_VALUE) next.add(total + value);
      }
    }
    totals = [...next];
  }
  return totals;
}

function sumValue(card: Card, looseCards: Card[]): number | null {
  if (looseCards.length === 0) return null;
  return possibleTotals([card, ...looseCards])[0] ?? null;
}

function canSplitIntoGroups(ranks: number[], target: number, groups: number): boolean {
  const sorted = [...ranks].sort((a, b) => b - a);
  const fill = new Array<number>(groups).fill(0);
  const place = (i: number): boolean => {
    if (i === sorted.length) return fill.every((total) => total === target);
    const tried = new Set<number>();
    for (let g = 0; g < groups; g++) {
      if (tried.has(fill[g]) || fill[g] + sorted[i] > target) continue;
      tried.add(fill[g]);
      fill[g] += sorted[i];
      if (place(i + 1)) return true;
      fill[g] -= sorted[i];
    }
    return false;
  };
  return place(0);
}

function pairsValue(card: Card, looseCards: Card[]): number | null {
  if (looseCards.length === 0) return null;
  const cards = [card, ...looseCards];
  const assignments = cards.reduce<number[][]>(
    (current, currentCard) => current.flatMap((values) => captureValues(currentCard).map((value) => [...values, value])),
    [[]],
  );
  for (const values of assignments) {
    const total = values.reduce((sum, value) => sum + value, 0);
    for (let value = 2; value <= MAX_CAPTURE_VALUE; value++) {
      if (total % value !== 0) continue;
      const groups = total / value;
      if (groups >= 2 && canSplitIntoGroups(values, value, groups)) return value;
    }
  }
  return null;
}

export function formationValue(
  kind: FormationKind,
  card: Card,
  looseCards: Card[],
  handAfter: Card[],
): number | null {
  const value = kind === 'sum' ? sumValue(card, looseCards) : pairsValue(card, looseCards);
  return value !== null && handCanCapture(handAfter, value) ? value : null;
}

export function raiseValue(card: Card, build: Build, handAfter: Card[]): number | null {
  if (build.kind === 'pairs') return null;
  return possibleTotals([card]).map((value) => build.value + value).find(
    (value) => value <= MAX_CAPTURE_VALUE && handCanCapture(handAfter, value),
  ) ?? null;
}

export function expansionValue(
  card: Card,
  build: Build,
  looseCards: Card[],
  handAfter: Card[],
): number | null {
  if (looseCards.length === 0) return null;
  const totals = possibleTotals([card, ...looseCards]);
  if (build.kind === 'pairs') {
    // Apilar sobre un par: tu carta y las sueltas deben sumar justo el valor del par
    // (2 + 3 sobre un par de 5). El valor del par no cambia.
    return totals.includes(build.value) && handCanCapture(handAfter, build.value) ? build.value : null;
  }
  return totals.map((value) => build.value + value).find(
    (value) => value <= MAX_CAPTURE_VALUE && handCanCapture(handAfter, value),
  ) ?? null;
}

/**
 * Sube una sumatoria y, en el mismo turno, une una carta suelta del nuevo
 * valor para convertirla en pares. La carta que forma los pares no se suma
 * al cálculo del aumento: actúa como la segunda pareja del grupo.
 */
export function expansionToPairsValue(
  card: Card,
  build: Build,
  looseCards: Card[],
  handAfter: Card[],
): number | null {
  if (build.kind === 'pairs' || looseCards.length === 0) return null;
  for (let mergeIndex = 0; mergeIndex < looseCards.length; mergeIndex += 1) {
    const merge = looseCards[mergeIndex];
    const expansionCards = looseCards.filter((_, index) => index !== mergeIndex);
    const values = possibleTotals([card, ...expansionCards]);
    for (const added of values) {
      const value = build.value + added;
      if (
        value <= MAX_CAPTURE_VALUE &&
        captureValues(merge).includes(value) &&
        handCanCapture(handAfter, value)
      ) {
        return value;
      }
    }
  }
  return null;
}

export function convertValue(card: Card, build: Build, handAfter: Card[]): number | null {
  if (!captureValues(card).includes(build.value)) return null;
  return handCanCapture(handAfter, build.value) ? build.value : null;
}
