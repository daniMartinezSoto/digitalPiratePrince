import type { Estado } from './estado';
import type { TipoDeMarca } from './mundo';

// Preguntas y cambios sobre las marcas de las casillas (mundo.marcas). Nunca tocan el estado
// recibido: los cambios devuelven uno nuevo. Sin casilla conocida (hex undefined, aún no hay mapa),
// no hay marcas que mirar ni que poner.

type Casilla = { col: number; fila: number } | undefined;

/** ¿Hay una marca de ese tipo en esa casilla? */
export function hayMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): boolean {
  return hex !== undefined && estado.mundo.marcas.some(m => m.tipo === tipo && m.col === hex.col && m.fila === hex.fila);
}

/** El estado con una marca de ese tipo en esa casilla (si ya la había, no se repite). */
export function conMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): Estado {
  if (hex === undefined || hayMarca(estado, tipo, hex)) {
    return estado;
  }
  return { ...estado, mundo: { ...estado.mundo, marcas: [...estado.mundo.marcas, { col: hex.col, fila: hex.fila, tipo }] } };
}

/** El estado sin la marca de ese tipo en esa casilla. */
export function sinMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): Estado {
  if (hex === undefined) {
    return estado;
  }
  const marcas = estado.mundo.marcas.filter(m => !(m.tipo === tipo && m.col === hex.col && m.fila === hex.fila));
  return { ...estado, mundo: { ...estado.mundo, marcas } };
}
