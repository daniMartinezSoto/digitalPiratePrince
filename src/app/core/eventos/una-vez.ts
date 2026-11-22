import type { Estado } from '../estado/estado';
import type { ListaEventos } from '../tablas/listas-eventos/lista-eventos';
import { EVENTOS } from './cargar-eventos';
import type { Evento } from './evento';

// EVENTOS DE UNA SOLA VEZ (Sprint 10). Un evento con "unaVez": true solo puede salir una vez por
// partida. Al empezar, el motor apunta la bandera evento_ocurrido_<id>; a partir de ahí:
//   - el motor ya no lo lanza (ni desde otro evento);
//   - las opciones que llevan a él salen desactivadas y en una tirada se vuelve a tirar;
//   - desaparece de las listas de eventos (viajar, la noche, reposar): sinEventosYaOcurridos.

/** Hay un evento en marcha (o esperando su turno)? Mientras lo haya, no se puede hacer nada más. */
export function hayEventoEnCurso(estado: Estado): boolean {
  return estado.mundo.pilaEventos.length > 0;
}

/** La bandera que recuerda que un evento de una sola vez ya ha salido. */
export function banderaDeEventoOcurrido(idEvento: string): string {
  return `evento_ocurrido_${idEvento}`;
}

/** ¿Es un evento de una sola vez que ya ha salido en esta partida? (Entonces no vuelve a salir.) */
export function eventoYaOcurrido(estado: Estado, idEvento: string, eventos: readonly Evento[] = EVENTOS): boolean {
  const evento = eventos.find(e => e.id === idEvento);
  return evento?.unaVez === true && estado.mundo.banderas[banderaDeEventoOcurrido(idEvento)] === true;
}

/**
 * La misma lista de eventos sin los de una sola vez que ya ocurrieron. Se usa antes de elegir el
 * evento al viajar, de noche o al reposar. Si no queda ninguno, la lista sale vacía (y no pasa nada).
 */
export function sinEventosYaOcurridos(lista: ListaEventos, estado: Estado, eventos: readonly Evento[] = EVENTOS): ListaEventos {
  const quedan = lista.eventos.filter(entrada => !eventoYaOcurrido(estado, entrada.evento, eventos));
  return quedan.length === lista.eventos.length ? lista : { ...lista, eventos: quedan };
}
