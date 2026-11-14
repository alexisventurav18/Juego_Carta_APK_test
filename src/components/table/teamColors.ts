/**
 * Colores de equipo. "Nosotros" es siempre tu pareja y "Ellos" la contraria, en todas las mesas por equipos.
 * Son dos tonos que no chocan con el dorado de la interfaz ni con el verde de los botones: celeste y coral.
 */
export interface TeamColor {
  /** Nombre corto que se muestra: "Nosotros" o "Ellos". */
  label: 'Nosotros' | 'Ellos';
  /** Color principal (bordes, halos, puntos). */
  main: string;
  /** Versión suave para fondos tintados. */
  soft: string;
  /** Color del texto que va encima de `main`. */
  ink: string;
}

export const US_COLOR: TeamColor = { label: 'Nosotros', main: '#38bdf8', soft: 'rgb(56 189 248 / 0.22)', ink: '#04202e' };
export const THEM_COLOR: TeamColor = { label: 'Ellos', main: '#fb6f5c', soft: 'rgb(251 111 92 / 0.22)', ink: '#2e0a05' };

/** Color de un equipo visto desde tu asiento: tu equipo es "Nosotros". */
export function teamColor(team: number, myTeam: number): TeamColor {
  return team === myTeam ? US_COLOR : THEM_COLOR;
}
