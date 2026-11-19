import type { Barco } from './barco';

import barcosJson from '../../data/barcos.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que es una lista de Barco.
// El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Catálogo de barcos enemigos del combate naval.
 * PARA AÑADIR UN BARCO: escribe su ficha en data/barcos.json (id, nombre, dano, resistencia y
 * abordaje; si da algo, recompensa, eventosAlGanar y botinAbordaje). Los enemigos del abordaje
 * tienen que existir en data/enemigos.json.
 * No hay que tocar nada más: el test del cargador lo revisa automáticamente.
 */
export const BARCOS: readonly Barco[] = barcosJson as Barco[];

/** Devuelve la ficha del barco con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerBarco(id: string): Barco {
  const barco = BARCOS.find(b => b.id === id);
  if (!barco) {
    const disponibles = BARCOS.map(b => b.id).join(', ');
    throw new Error(`No existe el barco "${id}". Barcos disponibles: ${disponibles}`);
  }
  return barco;
}
