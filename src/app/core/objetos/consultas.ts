import { OBJETOS } from '../catalogos/cargar-objetos';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { vidaMaxActual } from '../condiciones/consultas';
import type { Objeto } from '../catalogos/objeto';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { hayCombate } from '../combate/hay-combate';
import { hayEventoEnCurso } from '../eventos/una-vez';

// Preguntas sobre el inventario. Solo consultan: no cambian nada.
// Sirven para que la interfaz sepa cuándo preguntar "No cabe. ¿Tiras algo para hacerle sitio?"
// y qué objetos enseñar con el botón "Usar".
// El último parámetro es el catálogo de objetos (por defecto, el del juego).

/** Huecos del inventario que ocupa ahora lo que lleva (el ídolo dorado cuenta 4). */
export function espaciosOcupados(jugador: Jugador, objetos: readonly Objeto[] = OBJETOS): number {
  return jugador.inventario.reduce((total, llevado) => total + (fichaDe(llevado.id, objetos).espacios ?? 1), 0);
}

/**
 * Huecos que tiene ahora: los suyos (6; el sobrenombre puede dar más) y los que dan los objetos que
 * lleva (la mochila sin fondo, +4). Dos objetos iguales no suman dos veces.
 */
export function capacidadInventarioActual(jugador: Jugador, objetos: readonly Objeto[] = OBJETOS): number {
  const distintos = [...new Set(jugador.inventario.map(llevado => llevado.id))];
  return jugador.capacidadInventario + distintos.reduce((total, id) => total + (fichaDe(id, objetos).huecosExtra ?? 0), 0);
}

/** Huecos libres que le quedan. */
export function espaciosLibres(jugador: Jugador, objetos: readonly Objeto[] = OBJETOS): number {
  return Math.max(0, capacidadInventarioActual(jugador, objetos) - espaciosOcupados(jugador, objetos));
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
  if (estado.mundo.finPartida || hayCombate(estado) || hayEventoEnCurso(estado) || estado.mundo.fase !== 'accion' || estado.mundo.accionEnCurso) {
    return [];
  }
  return estado.jugador.inventario.flatMap((llevado, posicion) => {
    const ficha = fichaDe(llevado.id, objetos);
    return ficha.cuandoSeUsa === 'accion' && tieneLoQuePide(estado.jugador, ficha) ? [posicion] : [];
  });
}

/**
 * ¿Tiene lo que el objeto pide para usarse? La biblia: alguna maldición (de las apuntadas, que son las
 * que se pueden quitar). La medicina y el ungüento: que le falte vida.
 */
export function tieneLoQuePide(jugador: Jugador, ficha: Objeto): boolean {
  const categoria = ficha.soloConCategoria;
  if (categoria !== undefined && !jugador.condiciones.some(c => CONDICIONES.find(f => f.id === c.id)?.categoria === categoria)) {
    return false;
  }
  return !ficha.soloSiHerido || jugador.vida < vidaMaxActual(jugador);
}

/**
 * Por qué no puede soltar (tirar o vender) el objeto de esa posición: la mochila sin fondo, si sin
 * ella no le cabe lo que lleva ("vacía antes la mochila"). undefined = puede.
 */
export function motivoParaNoSoltar(jugador: Jugador, posicion: number, objetos: readonly Objeto[] = OBJETOS): 'mochila_llena' | undefined {
  const llevado = jugador.inventario[posicion];
  if (!llevado) return undefined;
  const sin = { ...jugador, inventario: jugador.inventario.filter((_, i) => i !== posicion) };
  return espaciosOcupados(sin, objetos) > capacidadInventarioActual(sin, objetos) ? 'mochila_llena' : undefined;
}

function fichaDe(id: string, objetos: readonly Objeto[]): Objeto {
  const ficha = objetos.find(o => o.id === id);
  if (!ficha) {
    throw new Error(`No existe el objeto "${id}" en el catálogo`);
  }
  return ficha;
}
