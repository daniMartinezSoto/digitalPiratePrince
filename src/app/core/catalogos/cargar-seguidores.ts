import type { TipoSeguidor } from './tipo-seguidor';

import seguidoresJson from '../../data/seguidores.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que es una lista de TipoSeguidor.
// El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Catálogo con todos los tipos de seguidor del juego.
 * PARA AÑADIR UN SEGUIDOR: escribe su ficha en data/seguidores.json. Si tiene una habilidad nueva,
 * escríbela antes en data/habilidades.json. No hay que tocar nada más.
 */
export const TIPOS_SEGUIDOR: readonly TipoSeguidor[] = seguidoresJson as TipoSeguidor[];

/** Devuelve la ficha del tipo de seguidor con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerTipoSeguidor(id: string): TipoSeguidor {
  const tipo = TIPOS_SEGUIDOR.find(t => t.id === id);
  if (!tipo) {
    const disponibles = TIPOS_SEGUIDOR.map(t => t.id).join(', ');
    throw new Error(`No existe el tipo de seguidor "${id}". Tipos disponibles: ${disponibles}`);
  }
  return tipo;
}
