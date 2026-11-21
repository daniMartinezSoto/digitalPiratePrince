import type { Terreno } from '../turno/lugar';

// EL MAPA (Sprint 9). Formato de data/mapas/<id>.json. No se escribe a mano: lo genera el conversor
// a partir del .wxx de Worldographer (scripts/convertir-wxx.mts) y el revisor (validar-mapa.ts) lo
// comprueba. La definición del mapa NO cambia durante la partida: lo que cambia (barco agotado,
// aldea bloqueada, tesoros...) irá en estado.mundo.
//
// Casillas: hexágonos de lado plano arriba, en columnas; las columnas impares bajan media casilla.

/** El icono de la casilla: decide qué acciones hay. Un lugar por casilla. */
export const RASGOS_DEL_MAPA = ['puerto', 'aldea', 'monasterio', 'naufragio', 'ruinas', 'guarida_pirata'] as const;
export type RasgoDelMapa = (typeof RASGOS_DEL_MAPA)[number];

export interface Coordenada {
  col: number;
  fila: number;
}

export interface Casilla extends Coordenada {
  /** El color: decide la lista de eventos al viajar, si es agua o tierra y dónde se desembarca. */
  terreno: Terreno;
  rasgo?: RasgoDelMapa;
  /** Solo los puertos llevan nombre (los principales, el suyo; los normales, uno de la lista). */
  nombre?: string;
  /**
   * Número de orden del lugar entre los de su tipo, tal como aparecen en el .wxx (los puertos,
   * principales o no, cuentan juntos). Solo sirve para repartir los dibujos (las tres ciudades,
   * las cuatro aldeas...). No afecta a las reglas.
   */
  variante?: number;
  /**
   * Zona de barcos (decidido por el autor el 20-nov): el jugador no la ve. Si al viajar aquí salta
   * un evento, será un evento de barco (no es un evento más: solo cambia qué evento sale).
   * En el .wxx son los barcos de Worldographer (Military Sailship). Solo en casillas de agua.
   */
  eventosDeBarco?: true;
}

/** Uno de los 4 puertos principales (condición de victoria), uno por esquina. */
export interface PuertoPrincipalDelMapa extends Coordenada {
  id: string;
  nombre: string;
}

export interface Mapa {
  id: string;
  nombre: string;
  columnas: number;
  filas: number;
  /** Casilla de inicio (E001: el jugador empieza a pie). En el .wxx, la calavera con huesos (Symbol Crossbones). */
  inicio: Coordenada;
  puertosPrincipales: PuertoPrincipalDelMapa[];
  /** Todas las casillas, fila a fila: la casilla (col, fila) está en la posición fila × columnas + col. */
  casillas: Casilla[];
}

/** La casilla de esa columna y fila, o null si cae fuera del mapa. */
export function casillaEn(mapa: Mapa, col: number, fila: number): Casilla | null {
  if (col < 0 || fila < 0 || col >= mapa.columnas || fila >= mapa.filas) return null;
  return mapa.casillas[fila * mapa.columnas + col] ?? null;
}
