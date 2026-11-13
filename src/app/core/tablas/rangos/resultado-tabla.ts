import type { Efecto } from '../efecto';

// Lo que devuelve resolverTabla(): la fila elegida ya resuelta, más datos de la tirada.
export interface ResultadoTabla {
  dados: number[];     // dados sacados, para mostrarlos
  modificador: number; // bonificador aplicado
  total: number;       // suma de los dados + modificador (antes de recortar al rango de la tabla)
  texto?: string;      // texto de la fila, si lo tiene
  efectos: Efecto[];   // efectos ya resueltos; lista vacía si no hay
  evento?: string;     // id del evento al que salta, si lo hay
}