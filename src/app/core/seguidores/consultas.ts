import { AJUSTES } from '../ajustes/ajustes';
import { HABILIDADES } from '../catalogos/cargar-habilidades';
import type { AjusteDeHabilidad, Habilidad } from '../catalogos/habilidad';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';

// Preguntas sobre el grupo de seguidores. Solo consultan: no cambian nada.
// Sirven para que la interfaz sepa cuándo preguntar "¿despides a alguien para que entre el nuevo?".

/** ¿Lleva ya el máximo de seguidores (AJUSTES.maximoSeguidores)? */
export function grupoLleno(jugador: Jugador): boolean {
  return jugador.seguidores.length >= AJUSTES.maximoSeguidores;
}

/**
 * Seguidores a los que el jugador puede despedir para hacer sitio: todos menos los inseparables
 * (el seguidor del hermano no se puede despedir para librarse de perder la partida si muere).
 * Lista vacía con el grupo lleno = no hay forma de hacer sitio.
 */
export function seguidoresDespedibles(jugador: Jugador): Seguidor[] {
  return jugador.seguidores.filter(seguidor => !seguidor.inseparable);
}

/**
 * Suma lo que aportan a una regla las habilidades de todos los seguidores.
 * Con un barbero-cirujano, ajusteDeSeguidores(jugador, 'curaAlReposar') es 1; con dos, 2 (todo suma).
 * El último parámetro es el catálogo de habilidades (por defecto, el del juego).
 */
export function ajusteDeSeguidores(jugador: Jugador, regla: AjusteDeHabilidad, habilidades: readonly Habilidad[] = HABILIDADES): number {
  let total = 0;
  for (const seguidor of jugador.seguidores) {
    for (const idHabilidad of seguidor.habilidades) {
      total += habilidades.find(h => h.id === idHabilidad)?.ajustes?.[regla] ?? 0;
    }
  }
  return total;
}
