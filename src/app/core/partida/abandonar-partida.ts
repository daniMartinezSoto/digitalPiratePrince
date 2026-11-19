import type { Estado } from '../estado/estado';

/**
 * El jugador se rinde (botón "Abandonar"; decidido por el autor en el Sprint 8): la partida
 * termina como DERROTA con el motivo "abandono" y, como cualquier final, pasa a la crónica
 * (eso lo hace el store). No tira dados. NO toca el estado que recibe: devuelve uno nuevo.
 * Da error si la partida ya había terminado.
 */
export function abandonarPartida(estado: Estado): Estado {
  if (estado.mundo.finPartida) {
    throw new Error('abandonarPartida: la partida ya ha terminado');
  }
  return {
    ...estado,
    mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'abandono' } },
  };
}
