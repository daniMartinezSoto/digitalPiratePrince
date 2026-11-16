import type { Habilidad } from './habilidad';

import habilidadesJson from '../../data/habilidades.json';

// El JSON llega sin tipos ("pasiva" es un texto cualquiera). Aquí, y solo aquí,
// le decimos que es una lista de Habilidad. El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Catálogo con todas las habilidades de seguidor del juego.
 * PARA AÑADIR UNA HABILIDAD: escribe su ficha en data/habilidades.json y pon su id
 * en la lista "habilidades" del seguidor que la tenga (data/seguidores.json).
 */
export const HABILIDADES: readonly Habilidad[] = habilidadesJson as Habilidad[];

/** Devuelve la ficha de la habilidad con ese id. Si no existe, avisa con un error que lista las disponibles. */
export function obtenerHabilidad(id: string): Habilidad {
  const habilidad = HABILIDADES.find(h => h.id === id);
  if (!habilidad) {
    const disponibles = HABILIDADES.map(h => h.id).join(', ');
    throw new Error(`No existe la habilidad "${id}". Habilidades disponibles: ${disponibles}`);
  }
  return habilidad;
}
