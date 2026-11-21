import type { Dados } from '../dados/dados';
import { casillaEn, type Casilla, type Coordenada, type Mapa } from './mapa';

// LAS CUENTAS DE HEXÁGONOS (Sprint 9, paso 2). Solo calculan: no cambian nada.
//
// Las casillas son hexágonos con el lado plano arriba, en columnas; las columnas impares están
// media casilla más abajo. Por eso NO existen el este ni el oeste: las 6 direcciones son
// N, NE, SE, S, SO y NO. Y por eso las vecinas de una columna par y de una impar son distintas:
//
//   columna PAR (0, 2, 4...)            columna IMPAR (1, 3, 5...)
//   N  = misma columna, fila − 1        N  = misma columna, fila − 1
//   NE = columna + 1,   fila − 1        NE = columna + 1,   misma fila
//   SE = columna + 1,   misma fila      SE = columna + 1,   fila + 1
//   S  = misma columna, fila + 1        S  = misma columna, fila + 1
//   SO = columna − 1,   misma fila      SO = columna − 1,   fila + 1
//   NO = columna − 1,   fila − 1        NO = columna − 1,   misma fila
//
// (Ejemplo con el primer mapa: La Habana está en 6,2, columna par; su vecina SE es 7,2.)

export const DIRECCIONES = ['N', 'NE', 'SE', 'S', 'SO', 'NO'] as const;
export type Direccion = (typeof DIRECCIONES)[number];

/** Cuánto cambian columna y fila al dar un paso en cada dirección, según la columna sea par o impar. */
const PASOS: Record<'par' | 'impar', Record<Direccion, [number, number]>> = {
  par: { N: [0, -1], NE: [1, -1], SE: [1, 0], S: [0, 1], SO: [-1, 0], NO: [-1, -1] },
  impar: { N: [0, -1], NE: [1, 0], SE: [1, 1], S: [0, 1], SO: [-1, 1], NO: [-1, 0] },
};

/** La casilla de al lado en esa dirección. Puede caer fuera del mapa (compruébalo con dentroDelMapa). */
export function vecinaEn(desde: Coordenada, direccion: Direccion): Coordenada {
  const [dc, df] = PASOS[desde.col % 2 === 0 ? 'par' : 'impar'][direccion];
  return { col: desde.col + dc, fila: desde.fila + df };
}

export function dentroDelMapa(mapa: Mapa, c: Coordenada): boolean {
  return c.col >= 0 && c.fila >= 0 && c.col < mapa.columnas && c.fila < mapa.filas;
}

/** Las vecinas que están dentro del mapa (6, o menos en los bordes), en el orden de DIRECCIONES. */
export function vecinas(mapa: Mapa, desde: Coordenada): Coordenada[] {
  return DIRECCIONES.map(d => vecinaEn(desde, d)).filter(c => dentroDelMapa(mapa, c));
}

export function sonVecinas(a: Coordenada, b: Coordenada): boolean {
  return distancia(a, b) === 1;
}

export function mismaCasilla(a: Coordenada, b: Coordenada): boolean {
  return a.col === b.col && a.fila === b.fila;
}

/**
 * Cuántos pasos hay de una casilla a otra (0 = la misma; 1 = vecinas), sin mirar el terreno.
 * Truco: se pasan las casillas a "coordenadas cúbicas" (tres ejes que suman 0), donde la
 * distancia es simplemente la mayor de las tres diferencias. (Guía de hexágonos de Red Blob Games.)
 */
export function distancia(a: Coordenada, b: Coordenada): number {
  const cubo = (c: Coordenada) => {
    const x = c.col;
    const z = c.fila - (c.col - (c.col & 1)) / 2;
    return { x, y: -x - z, z };
  };
  const p = cubo(a), q = cubo(b);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}

/** Las direcciones del libro de papel (1d6): 1 SE · 2 S · 3 NE · 4 SO · 5 NO · 6 N. */
export const DIRECCIONES_DEL_LIBRO: Record<number, Direccion> = { 1: 'SE', 2: 'S', 3: 'NE', 4: 'SO', 5: 'NO', 6: 'N' };

export function direccionDelLibro(numero: number): Direccion {
  const direccion = DIRECCIONES_DEL_LIBRO[numero];
  if (!direccion) throw new Error(`direccionDelLibro: el ${numero} no es una dirección (de 1 a 6)`);
  return direccion;
}

/**
 * Avanza `pasos` casillas en línea recta en una dirección (p. ej. "un lugar a 3 casillas al NE",
 * E024 y E060). Si el camino se sale del mapa, se queda en la última casilla válida antes del
 * borde (decidido por el autor el 20-nov). Sin condición no mira el terreno; con `puedePasar`
 * (p. ej. "solo agua" para un barco arrastrado por el viento) se para antes de la primera casilla
 * que no la cumpla.
 */
export function avanzar(
  mapa: Mapa,
  desde: Coordenada,
  direccion: Direccion,
  pasos: number,
  puedePasar: (casilla: Casilla) => boolean = () => true,
): Coordenada {
  let actual = { col: desde.col, fila: desde.fila };
  for (let i = 0; i < pasos; i++) {
    const siguiente = vecinaEn(actual, direccion);
    if (!dentroDelMapa(mapa, siguiente) || !puedePasar(casillaEn(mapa, siguiente.col, siguiente.fila)!)) break;
    actual = siguiente;
  }
  return actual;
}

/**
 * Una vecina al azar entre las que cumplen la condición (p. ej. solo tierra: el tabú sagrado o
 * cuando te echan de una aldea). Gasta UN número del generador si hay varias opciones y NINGUNO
 * si solo hay una. Si no hay ninguna, devuelve null (quien llama decide qué pasa).
 */
export function vecinaAlAzar(mapa: Mapa, desde: Coordenada, dados: Dados, condicion: (casilla: Casilla) => boolean = () => true): Coordenada | null {
  const opciones = vecinas(mapa, desde).filter(c => condicion(casillaEn(mapa, c.col, c.fila)!));
  if (opciones.length === 0) return null;
  if (opciones.length === 1) return opciones[0];
  return opciones[dados.entero(0, opciones.length - 1)];
}
