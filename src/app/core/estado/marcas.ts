import type { Estado } from './estado';
import type { Marca, TipoDeMarca } from './mundo';

// Preguntas y cambios sobre las marcas de las casillas (mundo.marcas). Nunca tocan el estado
// recibido: los cambios devuelven uno nuevo. Sin casilla conocida (hex undefined, aún no hay mapa),
// no hay marcas que mirar ni que poner.

type Casilla = { col: number; fila: number } | undefined;

/** ¿Hay una marca de ese tipo en esa casilla? */
export function hayMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): boolean {
  return hex !== undefined && estado.mundo.marcas.some(m => m.tipo === tipo && m.col === hex.col && m.fila === hex.fila);
}

/** La marca de ese tipo en esa casilla, si la hay. */
export function buscarMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): Marca | undefined {
  return hex === undefined ? undefined : estado.mundo.marcas.find(m => m.tipo === tipo && m.col === hex.col && m.fila === hex.fila);
}

/**
 * El estado con una marca de ese tipo en esa casilla (si ya la había, no se repite).
 * "dia": para las marcas que caducan (se apunta el día en que se pone).
 */
export function conMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla, dia?: number): Estado {
  if (hex === undefined || hayMarca(estado, tipo, hex)) {
    return estado;
  }
  const marca: Marca = dia === undefined ? { col: hex.col, fila: hex.fila, tipo } : { col: hex.col, fila: hex.fila, tipo, dia };
  return { ...estado, mundo: { ...estado.mundo, marcas: [...estado.mundo.marcas, marca] } };
}

/** El estado sin la marca de ese tipo en esa casilla. */
export function sinMarca(estado: Estado, tipo: TipoDeMarca, hex: Casilla): Estado {
  if (hex === undefined) {
    return estado;
  }
  const marcas = estado.mundo.marcas.filter(m => !(m.tipo === tipo && m.col === hex.col && m.fila === hex.fila));
  return { ...estado, mundo: { ...estado.mundo, marcas } };
}
