import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Objeto } from '../catalogos/objeto';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';

// Preguntas sobre el inventario. Solo consultan: no cambian nada.
// Sirven para que la interfaz sepa cuándo preguntar "No cabe. ¿Tiras algo para hacerle sitio?"
// y qué objetos enseñar con el botón "Usar".
// El último parámetro es el catálogo de objetos (por defecto, el del juego).

/** Huecos del inventario que ocupa ahora lo que lleva (el ídolo dorado cuenta 4). */
export function espaciosOcupados(jugador: Jugador, objetos: readonly Objeto[] = OBJETOS): number {
  return jugador.inventario.reduce((total, llevado) => total + (fichaDe(llevado.id, objetos).espacios ?? 1), 0);
}

/** Huecos libres que le quedan. */
export function espaciosLibres(jugador: Jugador, objetos: readonly Objeto[] = OBJETOS): number {
  return Math.max(0, jugador.capacidadInventario - espaciosOcupados(jugador, objetos));
}

/**
 * Huecos que tendría que liberar para que ese objeto le quepa. 0 = cabe sin tirar nada.
 * Con 1 hueco libre y el ídolo dorado (4 huecos), faltan 3.
 */
export function espaciosQueFaltan(jugador: Jugador, idObjeto: string, objetos: readonly Objeto[] = OBJETOS): number {
  return Math.max(0, (fichaDe(idObjeto, objetos).espacios ?? 1) - espaciosLibres(jugador, objetos));
}

/** ¿Le cabe ese objeto sin tirar nada? */
export function cabeObjeto(jugador: Jugador, idObjeto: string, objetos: readonly Objeto[] = OBJETOS): boolean {
  return espaciosQueFaltan(jugador, idObjeto, objetos) === 0;
}

/**
 * Posiciones (en el inventario) de los objetos que puede usar AHORA con el botón "Usar":
 * los que se usan en la fase de acción ("cuandoSeUsa": "accion"), si la partida está en esa fase.
 * Lista vacía = no hay nada que usar ahora.
 */
export function objetosUsablesAhora(estado: Estado, objetos: readonly Objeto[] = OBJETOS): number[] {
  if (estado.mundo.finPartida || estado.mundo.fase !== 'accion' || estado.mundo.mercado) {
    return [];
  }
  return estado.jugador.inventario.flatMap((llevado, posicion) => (fichaDe(llevado.id, objetos).cuandoSeUsa === 'accion' ? [posicion] : []));
}

function fichaDe(id: string, objetos: readonly Objeto[]): Objeto {
  const ficha = objetos.find(o => o.id === id);
  if (!ficha) {
    throw new Error(`No existe el objeto "${id}" en el catálogo`);
  }
  return ficha;
}
