import type { Dados } from '../dados/dados';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { EVENTOS } from './cargar-eventos';
import type { Evento } from './evento';
import { lanzarEventos } from './motor';

// LA PUERTA DE LOS EVENTOS (Sprint 10, paso 4). Muchas reglas del juego devuelven los eventos que
// han saltado (una acción, viajar, la noche, el amanecer, comer, cerrar un combate, crear la
// partida...): hasta ahora solo se apuntaban como "pendientes". conSusEventos los mete en la pila
// del motor, en el mismo paso que la regla, para que se jueguen en orden.
//
// Así las reglas no cambian: quien las llama (el store y la pantalla, a través de un único sitio)
// hace siempre regla → conSusEventos. Las fases siguen avanzando como siempre y los eventos se
// juegan "encima": mientras haya uno, todo lo demás está bloqueado (decidido por el autor, 22-nov).

/** Lo que devuelve la regla, más lo que ha pasado al lanzar sus eventos. */
export type ConSusEventos<R> = R & {
  // Eventos que todavía no están programados: la pantalla los apunta como "pendiente".
  pendientes: string[];

  // Cambios que ya han hecho los eventos al empezar (los efectos de su primer paso).
  cambiosDeEventos: Cambio[];
};

/**
 * Mete en la pila los eventos que trae el resultado de una regla. Si no trae ninguno, o la partida
 * ha terminado, lo devuelve tal cual. Los eventos sin programar salen en "pendientes".
 */
export function conSusEventos<R extends { estado: Estado; eventos?: readonly string[] }>(
  resultado: R,
  dados: Dados,
  eventos: readonly Evento[] = EVENTOS,
): ConSusEventos<R> {
  const ids = resultado.eventos ?? [];
  if (ids.length === 0 || resultado.estado.mundo.finPartida) {
    return { ...resultado, pendientes: [], cambiosDeEventos: [] };
  }
  const motor = lanzarEventos(resultado.estado, ids, dados, eventos);
  return { ...resultado, estado: motor.estado, pendientes: motor.pendientes, cambiosDeEventos: motor.cambios };
}
