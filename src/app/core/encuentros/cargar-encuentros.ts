import type { Encuentro } from './encuentro';

import datos from '../../data/encuentros.json';

// Los JSON llegan sin tipos. Aquí, y solo aquí, le decimos que son encuentros.
// El test del cargador comprueba con el revisor que de verdad lo sean.

/**
 * Todos los encuentros (Sprint 10).
 * PARA AÑADIR UNO: escribe su ficha en data/encuentros.json (formato en core/encuentros/encuentro.ts).
 * Nada más: el test del cargador lo revisa automáticamente.
 */
export const ENCUENTROS: readonly Encuentro[] = datos as Encuentro[];

/** Devuelve el encuentro con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerEncuentro(id: string, encuentros: readonly Encuentro[] = ENCUENTROS): Encuentro {
  const encuentro = encuentros.find(e => e.id === id);
  if (!encuentro) {
    throw new Error(`No existe el encuentro "${id}". Encuentros: ${encuentros.map(e => e.id).join(', ')}`);
  }
  return encuentro;
}
