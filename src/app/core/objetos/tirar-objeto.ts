import type { Dados } from '../dados/dados';
import { aplicarEfectos, type CatalogosEfectos, type ResultadoEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';

/**
 * El jugador tira el objeto de esa posición del inventario. Se puede en cualquier momento,
 * es gratis, no gasta la acción y el objeto no se recupera.
 * Si la partida ha terminado, error.
 * Pasa por aplicarEfectos: no toca el estado recibido. (Los dados solo se usarían si, al irse el
 * objeto, sobrara un seguidor: hoy ningún objeto da seguidores de más.)
 */
export function tirarObjeto(estado: Estado, posicion: number, dados: Dados, catalogos?: CatalogosEfectos): ResultadoEfectos {
  if (estado.mundo.finPartida) {
    throw new Error('tirarObjeto: la partida ya ha terminado');
  }
  if (estado.mundo.combate) {
    throw new Error('tirarObjeto: hay un combate en curso; primero hay que terminarlo');
  }
  return aplicarEfectos(estado, [{ tipo: 'tirar_objeto', posicion }], dados, catalogos);
}
