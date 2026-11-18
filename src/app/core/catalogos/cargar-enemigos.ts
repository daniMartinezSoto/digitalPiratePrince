import type { Enemigo } from './enemigo';

import enemigosJson from '../../data/enemigos.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que es una lista de Enemigo.
// El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Bestiario: todos los enemigos del juego.
 * PARA AÑADIR UN ENEMIGO: escribe su ficha en data/enemigos.json (id, nombre, ataque y resistencia).
 * No hay que tocar nada más: el test del cargador lo revisa automáticamente.
 */
export const ENEMIGOS: readonly Enemigo[] = enemigosJson as Enemigo[];

/** Devuelve la ficha del enemigo con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerEnemigo(id: string): Enemigo {
  const enemigo = ENEMIGOS.find(e => e.id === id);
  if (!enemigo) {
    const disponibles = ENEMIGOS.map(e => e.id).join(', ');
    throw new Error(`No existe el enemigo "${id}". Enemigos disponibles: ${disponibles}`);
  }
  return enemigo;
}
