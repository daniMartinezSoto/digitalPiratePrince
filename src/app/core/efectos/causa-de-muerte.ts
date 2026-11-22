import type { CausaDeMuerte } from '../estado/fin-partida';
import type { Estado } from '../estado/estado';

// POR QUÉ HAS MUERTO (22-nov). aplicarEfectos solo sabe que la vida o la tripulación han llegado a 0;
// quien hizo el daño (el combate, el hambre, una condición, cazar, un evento) lo apunta después con esto.
// Solo se apunta la primera causa, y solo en una derrota por vida, por tripulación o por un efecto
// "perder_partida" (motivo evento).

/** Devuelve el estado con la causa apuntada si la partida acaba de terminar por eso y aún no tenía causa. */
export function conCausaDeMuerte(estado: Estado, causa: CausaDeMuerte): Estado {
  const fin = estado.mundo.finPartida;
  if (!fin || fin.resultado !== 'derrota' || fin.causa || !['vida', 'tripulacion', 'evento'].includes(fin.motivo)) return estado;
  return { ...estado, mundo: { ...estado.mundo, finPartida: { ...fin, causa } } };
}
