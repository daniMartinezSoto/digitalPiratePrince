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
 * Los efectos de "siNoHay" se tiran SIEMPRE, justo después del efecto que los lleva,
 * se vayan a usar o no: así la tabla gasta los mismos dados tengas o no seguidores.
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
 * Convierte un efecto del JSON en un efecto con números concretos.
 * Copia el efecto tal cual (operación, destino, objeto...) y SOLO convierte lo que lleva dados:
 * la "cantidad" y, en poner_condicion, los "turnos".
 * El resto (mitad, maximo, todo, objetos, banderas, ganar/perder la partida...) sale como entró:
 * lo aplica aplicarEfectos, que sí conoce el estado.
 * Se exporta porque los efectos también se escriben fuera de las tablas (fichas de condición).
 */
export function resolverEfecto(definicion: EfectoDefinicion, dados: Dados): Efecto {
  if (definicion.tipo === 'poner_condicion') {
    const { turnos, ...resto } = definicion;
    return turnos === undefined ? resto : { ...resto, turnos: resolverCantidad(turnos, dados) };
  }
  // Primero la cantidad del propio efecto...
  const resuelto = (
    'cantidad' in definicion ? { ...definicion, cantidad: resolverCantidad(definicion.cantidad, dados) } : { ...definicion }
  ) as Efecto;

  // ...y después, si lleva "siNoHay", los efectos de reemplazo (también pueden llevar dados).
  if ('siNoHay' in definicion && definicion.siNoHay !== undefined && 'siNoHay' in resuelto) {
    resuelto.siNoHay = definicion.siNoHay.map(reemplazo => resolverEfecto(reemplazo, dados));
  }
  return resuelto;
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
