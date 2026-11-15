import type { Condicion } from './condicion';

import condicionesJson from '../../data/condiciones.json';

// El JSON llega sin tipos ("clima" es un texto cualquiera). Aquí, y solo aquí, le decimos
// que es una lista de Condicion. El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Catálogo con todas las condiciones del juego.
 * PARA AÑADIR UNA CONDICIÓN: escribe su ficha en data/condiciones.json. No hay que tocar nada más.
 */
export const CONDICIONES: readonly Condicion[] = condicionesJson as Condicion[];

/** Devuelve la ficha de la condición con ese id. Si no existe, avisa con un error que lista las disponibles. */
export function obtenerCondicion(id: string): Condicion {
  const condicion = CONDICIONES.find(c => c.id === id);
  if (!condicion) {
    const disponibles = CONDICIONES.map(c => c.id).join(', ');
    throw new Error(`No existe la condición "${id}". Condiciones disponibles: ${disponibles}`);
  }
  return condicion;
}
