import type { Evento } from './evento';

import deseo from '../../data/eventos/deseo.json';
import piratasHostiles from '../../data/eventos/piratas_hostiles.json';
import guardia from '../../data/eventos/guardia.json';
import borracho from '../../data/eventos/borracho.json';
import cofre from '../../data/eventos/cofre.json';
import tesoro from '../../data/eventos/tesoro.json';
import tesoroMagico from '../../data/eventos/tesoro_magico.json';
import trampa from '../../data/eventos/trampa.json';
import maldicion from '../../data/eventos/maldicion.json';
import amuletoMaldito from '../../data/eventos/amuleto_maldito.json';
import danoEnLaBodega from '../../data/eventos/dano_en_la_bodega.json';
import fiesta from '../../data/eventos/fiesta.json';
import imprevisto from '../../data/eventos/imprevisto.json';
import rocas from '../../data/eventos/rocas.json';
import objeto from '../../data/eventos/objeto.json';
import sirenas from '../../data/eventos/sirenas.json';
import polizon from '../../data/eventos/polizon.json';
import jovenGuerrero from '../../data/eventos/joven_guerrero.json';
import escorbutoCurado from '../../data/eventos/escorbuto_curado.json';
import marinerosEnElPuerto from '../../data/eventos/marineros_en_el_puerto.json';

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
export const EVENTOS: readonly Evento[] = [
  deseo as Evento, piratasHostiles as Evento, guardia as Evento, borracho as Evento,
  // Sprint 12, bloque 1 (tesoros)
  cofre as Evento, tesoro as Evento, tesoroMagico as Evento, trampa as Evento, maldicion as Evento, amuletoMaldito as Evento,
  // Sprint 12, bloque 2 (mar con tablas)
  danoEnLaBodega as Evento, fiesta as Evento, imprevisto as Evento, rocas as Evento, objeto as Evento, sirenas as Evento, polizon as Evento,
  // Seguidores que llegan: siempre se pregunta y se puede despedir a uno (26-nov)
  jovenGuerrero as Evento,
  // Avisos al llegar: las condiciones que se quitan al llegar lo cuentan con su propio evento (26-nov).
  escorbutoCurado as Evento, marinerosEnElPuerto as Evento,
];

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
