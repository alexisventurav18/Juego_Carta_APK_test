/**
 * Validador puro de jugadas del Casino (reglas dominicanas, a 21 puntos).
 *
 * Módulo independiente: no importa nada del motor en tiempo de ejecución (solo tipos para el
 * adaptador `desdeEstadoCasino`). Modela la mesa como una lista de `GrupoMesa`: una carta suelta
 * es un grupo de 1 carta, y las sumas y los pares son grupos atómicos que se llevan completos
 * o no se tocan.
 *
 * Reglas implementadas (turno con UNA carta de la mano, de valor V):
 *  - CAPTURAR: los grupos elegidos se reparten en subconjuntos que suman exactamente V.
 *  - ARMAR_SUMA: V + valores de los grupos elegidos = S (máx. 13), sin tocar PARES, y con otra
 *    carta de valor S en la mano.
 *  - HACER_PAR: todos los grupos elegidos valen V; resulta un PAR de valor V y debe quedar otra
 *    carta de valor V en la mano.
 *  - DESCARTAR: la carta entra como SUELTA.
 *  - Compromiso: al descartar o al armar/doblar sin incluir un grupo propio, la mano restante
 *    debe conservar la carta que cierra cada grupo propio que sigue en la mesa.
 *
 * El As vale siempre 1 (J=11, Q=12, K=13).
 */
import type { Card as CartaMotor } from './cards';
import type { CasinoState } from './casino';

export type Palo = 'Picas' | 'Corazones' | 'Diamantes' | 'Tréboles';
export type Rango = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Carta {
  id: string;
  palo: Palo;
  rango: Rango;
  valorNumerico: number;
}

export type TipoGrupo = 'SUELTA' | 'SUMA' | 'PAR';

export interface GrupoMesa {
  id: string;
  cartas: Carta[];
  valorObjetivo: number;
  tipo: TipoGrupo;
  propietarioId: string | null;
}

export type TipoAccion = 'CAPTURAR' | 'ARMAR_SUMA' | 'HACER_PAR' | 'DESCARTAR';

export interface EstadoMesa {
  mesa: GrupoMesa[];
  /** Mano de cada jugador, por id de jugador. */
  manos: Record<string, Carta[]>;
  /** Si se informa, la jugada solo es válida para ese jugador. */
  turnoId?: string;
}

export interface ResultadoJugada {
  valida: boolean;
  error?: string;
  /** Grupo que queda en la mesa tras armar, doblar o descartar. */
  nuevoGrupoResultante?: GrupoMesa;
  /** Solo al capturar: los grupos que se lleva el jugador. */
  gruposCapturados?: GrupoMesa[];
  /** Solo al capturar: la carta jugada más todas las cartas de los grupos llevados. */
  cartasCapturadas?: Carta[];
  /** Solo al capturar: cómo se reparten los grupos en subconjuntos que suman el valor jugado. */
  combinaciones?: string[][];
}

export const VALOR_MAXIMO = 13;
/** Tope de grupos en una captura (la partición es exponencial en este número). */
export const MAX_GRUPOS_CAPTURA = 20;

const VALOR_POR_RANGO: Record<Rango, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

export function valorDeRango(rango: Rango): number {
  return VALOR_POR_RANGO[rango];
}

export function crearCarta(rango: Rango, palo: Palo, id = `${rango}-${palo}`): Carta {
  return { id, palo, rango, valorNumerico: valorDeRango(rango) };
}

export function grupoSuelto(carta: Carta): GrupoMesa {
  return { id: carta.id, cartas: [carta], valorObjetivo: carta.valorNumerico, tipo: 'SUELTA', propietarioId: null };
}

/**
 * Reparte `valores` en subconjuntos que suman exactamente `objetivo`, usando todos los elementos.
 * Devuelve los índices de cada subconjunto o null si no es posible.
 */
export function particionarEnObjetivo(valores: number[], objetivo: number): number[][] | null {
  const n = valores.length;
  if (n === 0 || objetivo <= 0 || n > MAX_GRUPOS_CAPTURA) return null;
  if (valores.some((v) => v <= 0 || v > objetivo)) return null;
  const total = valores.reduce((a, b) => a + b, 0);
  if (total % objetivo !== 0) return null;

  const size = 1 << n;
  const alcanzable = new Uint8Array(size);
  const ultimo = new Int8Array(size).fill(-1);
  const suma = new Int32Array(size);
  alcanzable[0] = 1;
  for (let mask = 0; mask < size; mask++) {
    if (!alcanzable[mask]) continue;
    const llenado = suma[mask] % objetivo;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) || llenado + valores[i] > objetivo) continue;
      const siguiente = mask | (1 << i);
      if (!alcanzable[siguiente]) {
        alcanzable[siguiente] = 1;
        ultimo[siguiente] = i;
        suma[siguiente] = suma[mask] + valores[i];
      }
    }
  }
  const completa = size - 1;
  if (!alcanzable[completa]) return null;

  const orden: number[] = [];
  for (let mask = completa; mask !== 0; mask ^= 1 << ultimo[mask]) orden.push(ultimo[mask]);
  orden.reverse();

  const grupos: number[][] = [];
  let actual: number[] = [];
  let acumulado = 0;
  for (const i of orden) {
    actual.push(i);
    acumulado += valores[i];
    if (acumulado === objetivo) {
      grupos.push(actual);
      actual = [];
      acumulado = 0;
    }
  }
  return grupos;
}

const fallo = (error: string): ResultadoJugada => ({ valida: false, error });

const nombreGrupo = (g: GrupoMesa): string =>
  g.tipo === 'PAR' ? `par de ${g.valorObjetivo}` : g.tipo === 'SUMA' ? `suma de ${g.valorObjetivo}` : `carta ${g.valorObjetivo}`;

/**
 * Compromiso: cada grupo propio que sigue en la mesa necesita una carta de cierre en la mano.
 * Devuelve el mensaje de error o null si se cumple.
 */
function errorDeCompromiso(
  estado: EstadoMesa,
  jugadorId: string,
  manoRestante: Carta[],
  consumidos: Set<string>,
): string | null {
  for (const grupo of estado.mesa) {
    if (grupo.propietarioId !== jugadorId || consumidos.has(grupo.id)) continue;
    if (!manoRestante.some((c) => c.valorNumerico === grupo.valorObjetivo)) {
      return `Tu ${nombreGrupo(grupo)} sigue en la mesa y no te quedaría una carta de ${grupo.valorObjetivo} para cerrarlo: debes llevártelo o reforzarlo.`;
    }
  }
  return null;
}

export function validarJugada(
  estado: EstadoMesa,
  jugadorId: string,
  cartaManoId: string,
  gruposSeleccionadosIds: string[],
  tipoAccion: TipoAccion,
): ResultadoJugada {
  const mano = estado.manos[jugadorId];
  if (!mano) return fallo('Jugador desconocido.');
  if (estado.turnoId !== undefined && estado.turnoId !== jugadorId) return fallo('No es tu turno.');

  const carta = mano.find((c) => c.id === cartaManoId);
  if (!carta) return fallo('Esa carta no está en tu mano.');
  const manoRestante = mano.filter((c) => c.id !== carta.id);
  const V = carta.valorNumerico;

  if (new Set(gruposSeleccionadosIds).size !== gruposSeleccionadosIds.length) {
    return fallo('Hay grupos repetidos en la selección.');
  }
  const seleccion: GrupoMesa[] = [];
  for (const id of gruposSeleccionadosIds) {
    const grupo = estado.mesa.find((g) => g.id === id);
    if (!grupo) return fallo('Alguno de los grupos elegidos ya no está en la mesa.');
    seleccion.push(grupo);
  }
  const consumidos = new Set(gruposSeleccionadosIds);
  const idNuevo = `grupo-${carta.id}`;

  switch (tipoAccion) {
    case 'CAPTURAR': {
      if (seleccion.length === 0) return fallo('Elige al menos un grupo de la mesa para llevártelo.');
      const particion = particionarEnObjetivo(
        seleccion.map((g) => g.valorObjetivo),
        V,
      );
      if (!particion) {
        return fallo(`Los grupos elegidos no se pueden repartir en subconjuntos que sumen ${V} cada uno.`);
      }
      return {
        valida: true,
        gruposCapturados: seleccion,
        cartasCapturadas: [carta, ...seleccion.flatMap((g) => g.cartas)],
        combinaciones: particion.map((indices) => indices.map((i) => seleccion[i].id)),
      };
    }

    case 'ARMAR_SUMA': {
      if (seleccion.length === 0) return fallo('Elige al menos un grupo de la mesa para sumarle tu carta.');
      const par = seleccion.find((g) => g.tipo === 'PAR');
      if (par) return fallo(`No se puede sumar sobre un par (${nombreGrupo(par)}).`);
      const S = V + seleccion.reduce((total, g) => total + g.valorObjetivo, 0);
      if (S > VALOR_MAXIMO) return fallo(`Una suma no puede pasar de ${VALOR_MAXIMO} (esta daría ${S}).`);
      if (!manoRestante.some((c) => c.valorNumerico === S)) {
        return fallo(`Para armar una suma de ${S} debes conservar en la mano otra carta de ${S} con la que cerrarla.`);
      }
      const compromiso = errorDeCompromiso(estado, jugadorId, manoRestante, consumidos);
      if (compromiso) return fallo(compromiso);
      return {
        valida: true,
        nuevoGrupoResultante: {
          id: idNuevo,
          cartas: [carta, ...seleccion.flatMap((g) => g.cartas)],
          valorObjetivo: S,
          tipo: 'SUMA',
          propietarioId: jugadorId,
        },
      };
    }

    case 'HACER_PAR': {
      if (seleccion.length === 0) return fallo('Elige al menos un grupo de la mesa para hacer par con tu carta.');
      const distinto = seleccion.find((g) => g.valorObjetivo !== V);
      if (distinto) {
        return fallo(`Para hacer par con un ${V}, todos los grupos elegidos deben valer ${V} (el ${nombreGrupo(distinto)} no).`);
      }
      if (!manoRestante.some((c) => c.valorNumerico === V)) {
        return fallo(`Para hacer par de ${V} debes conservar en la mano otra carta de ${V} con la que llevártelo.`);
      }
      const compromiso = errorDeCompromiso(estado, jugadorId, manoRestante, consumidos);
      if (compromiso) return fallo(compromiso);
      return {
        valida: true,
        nuevoGrupoResultante: {
          id: idNuevo,
          cartas: [carta, ...seleccion.flatMap((g) => g.cartas)],
          valorObjetivo: V,
          tipo: 'PAR',
          propietarioId: jugadorId,
        },
      };
    }

    case 'DESCARTAR': {
      if (seleccion.length > 0) return fallo('Para descartar no se selecciona ningún grupo de la mesa.');
      const compromiso = errorDeCompromiso(estado, jugadorId, manoRestante, consumidos);
      if (compromiso) return fallo(compromiso);
      return {
        valida: true,
        nuevoGrupoResultante: { ...grupoSuelto(carta) },
      };
    }

    default:
      return fallo('Tipo de acción desconocido.');
  }
}

export type ResultadoAplicacion =
  | { valida: false; error: string }
  | { valida: true; estado: EstadoMesa; resultado: ResultadoJugada };

/** Valida la jugada y, si es legal, devuelve el nuevo estado de la mesa y la mano (sin mutar el original). */
export function aplicarJugada(
  estado: EstadoMesa,
  jugadorId: string,
  cartaManoId: string,
  gruposSeleccionadosIds: string[],
  tipoAccion: TipoAccion,
): ResultadoAplicacion {
  const resultado = validarJugada(estado, jugadorId, cartaManoId, gruposSeleccionadosIds, tipoAccion);
  if (!resultado.valida) return { valida: false, error: resultado.error ?? 'Jugada no válida.' };

  const quitados = new Set(gruposSeleccionadosIds);
  const mesa = estado.mesa.filter((g) => !quitados.has(g.id));
  if (resultado.nuevoGrupoResultante) mesa.push(resultado.nuevoGrupoResultante);
  const manos = {
    ...estado.manos,
    [jugadorId]: estado.manos[jugadorId].filter((c) => c.id !== cartaManoId),
  };
  return { valida: true, estado: { ...estado, mesa, manos }, resultado };
}

const RANGO_POR_NUMERO: Record<number, Rango> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

const PALO_POR_MOTOR: Record<string, Palo> = {
  picas: 'Picas',
  corazones: 'Corazones',
  diamantes: 'Diamantes',
  treboles: 'Tréboles',
};

function cartaDesdeMotor(carta: CartaMotor): Carta {
  const palo = PALO_POR_MOTOR[carta.suit];
  const rango = RANGO_POR_NUMERO[carta.rank];
  if (!palo || !rango) throw new Error(`Carta no válida para el Casino: ${carta.id}`);
  return { id: carta.id, palo, rango, valorNumerico: carta.rank };
}

/** Convierte el estado actual del motor (`CasinoState`) al modelo de este módulo. */
export function desdeEstadoCasino(state: CasinoState): EstadoMesa {
  const idDe = (seat: number): string | null => state.players[seat]?.id ?? null;
  const mesa: GrupoMesa[] = [
    ...state.table.map((c) => grupoSuelto(cartaDesdeMotor(c))),
    ...state.builds.map(
      (b): GrupoMesa => ({
        id: b.id,
        cartas: b.cards.map(cartaDesdeMotor),
        valorObjetivo: b.value,
        tipo: b.kind === 'pairs' ? 'PAR' : 'SUMA',
        propietarioId: idDe(b.owner),
      }),
    ),
  ];
  const manos: Record<string, Carta[]> = {};
  state.players.forEach((player, seat) => {
    manos[player.id] = state.hands[seat].map(cartaDesdeMotor);
  });
  return { mesa, manos, turnoId: idDe(state.turn) ?? undefined };
}
