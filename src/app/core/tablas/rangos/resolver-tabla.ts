import type { Dados } from '../../dados/dados';
import type { CantidadDefinicion, Efecto, EfectoDefinicion } from '../efecto';
import type { ResultadoTabla } from './resultado-tabla';
import type { Fila, Tabla } from './tabla';

/**
 * Tira el dado de la tabla, suma el modificador, elige la fila y devuelve
 * lo que ha pasado. NO modifica el estado: eso es cosa de aplicarEfectos.
 *
 * Orden en que se gastan los dados (no cambiarlo: afecta a las partidas guardadas):
 * primero el dado de la tabla y después cada efecto con dados, en orden.
 */
export function resolverTabla(tabla: Tabla, modificador: number, dados: Dados): ResultadoTabla {
  // 1. Tirar el dado de la tabla y sumar el modificador.
  const tirada = dados.tirar(tabla.dado);
  const total = tirada.total + modificador;

  // 2. Buscar la fila que corresponde a ese total.
  const fila = buscarFila(tabla, total);

  // 3. Montar el resultado. Los efectos con dados se tiran aquí.
  const resultado: ResultadoTabla = {
    dados: tirada.dados,
    modificador,
    total,
    efectos: (fila.efectos ?? []).map(definicion => resolverEfecto(definicion, dados)),
  };
  // texto y evento solo se añaden si la fila los tiene.
  if (fila.texto !== undefined) resultado.texto = fila.texto;
  if (fila.evento !== undefined) resultado.evento = fila.evento;

  return resultado;
}

/** Elige la fila cuyo rango contiene el total, recortando a los extremos de la tabla. */
function buscarFila(tabla: Tabla, total: number): Fila {
  if (tabla.filas.length === 0) {
    throw new Error(`resolverTabla: la tabla "${tabla.id}" no tiene filas`);
  }

  // Extremos de la tabla: el menor "min" y el mayor "max" de todas las filas.
  const minimo = Math.min(...tabla.filas.map(f => f.min));
  const maximo = Math.max(...tabla.filas.map(f => f.max));

  // Recortar: un 21 en una tabla que acaba en 18 se trata como 18.
  const valor = Math.min(Math.max(total, minimo), maximo);

  const fila = tabla.filas.find(f => valor >= f.min && valor <= f.max);
  if (!fila) {
    throw new Error(`resolverTabla: hueco en la tabla "${tabla.id}", ninguna fila cubre el ${valor}`);
  }
  return fila;
}

/**
 * Convierte un efecto del JSON en un efecto con cantidad numérica.
 * Copia el efecto tal cual (operación, destino...) y SOLO cambia la cantidad.
 * Los que no llevan cantidad (mitad, maximo, todo, ganar/perder la partida)
 * salen como entraron: los resuelve aplicarEfectos, que sí conoce el estado.
 */
function resolverEfecto(definicion: EfectoDefinicion, dados: Dados): Efecto {
  if (!('cantidad' in definicion)) {
    return { ...definicion };
  }
  return { ...definicion, cantidad: resolverCantidad(definicion.cantidad, dados) };
}

/** 8 → 8 · "2d6" → lo que salga · "-1d6" → lo que salga, en negativo. */
function resolverCantidad(cantidad: CantidadDefinicion, dados: Dados): number {
  if (typeof cantidad === 'number') {
    return cantidad;
  }
  if (cantidad.startsWith('-')) {
    return -dados.tirar(cantidad.slice(1)).total;
  }
  return dados.tirar(cantidad).total;
}
