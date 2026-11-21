import type { Mapa } from './mapa';

import primerMapaPrueba from '../../data/mapas/primer-mapa-prueba.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que es un Mapa.
// El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Los mapas del juego.
 * PARA AÑADIR UN MAPA: dibújalo en Worldographer, conviértelo con
 *   npm run convertir-mapa -- <archivo.wxx> <id> "<Nombre>"
 * (genera data/mapas/<id>.json) e impórtalo aquí abajo. El test del cargador lo revisa solo.
 */
export const MAPAS: readonly Mapa[] = [primerMapaPrueba as Mapa];

/** Devuelve el mapa con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerMapa(id: string): Mapa {
  const mapa = MAPAS.find(m => m.id === id);
  if (!mapa) {
    const disponibles = MAPAS.map(m => m.id).join(', ');
    throw new Error(`No existe el mapa "${id}". Mapas disponibles: ${disponibles}`);
  }
  return mapa;
}
