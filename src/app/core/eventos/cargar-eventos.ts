import type { Evento } from './evento';

import deseo from '../../data/eventos/deseo.json';
import piratasHostiles from '../../data/eventos/piratas_hostiles.json';

// Los JSON llegan sin tipos. Aquí, y solo aquí, le decimos que son eventos.
// El test del cargador comprueba con el revisor que de verdad lo sean.

/**
 * Todos los eventos programados (Sprint 10).
 * PARA AÑADIR UN EVENTO:
 *   1. Escribe data/eventos/<id>.json (el formato está explicado en core/eventos/evento.ts).
 *   2. Añade aquí su import y ponlo en la lista de abajo.
 * Nada más: el test del cargador lo revisa automáticamente. Mientras un evento no esté aquí,
 * el juego lo enseña como "pendiente".
 */
export const EVENTOS: readonly Evento[] = [deseo as Evento, piratasHostiles as Evento];

/** ¿Está programado este evento? (Si no, el juego lo enseña como pendiente.) */
export function existeEvento(id: string): boolean {
  return EVENTOS.some(e => e.id === id);
}

/** Devuelve el evento con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerEvento(id: string): Evento {
  const evento = EVENTOS.find(e => e.id === id);
  if (!evento) {
    const disponibles = EVENTOS.map(e => e.id).join(', ');
    throw new Error(`No existe el evento "${id}". Eventos programados: ${disponibles}`);
  }
  return evento;
}
