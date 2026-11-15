import type { Objeto } from './objeto';

import objetosJson from '../../data/objetos.json';

// El JSON llega sin tipos ("activo" es un texto cualquiera). Aquí, y solo aquí,
// le decimos que es una lista de Objeto. El test del cargador comprueba con el revisor que de verdad lo sea.

/**
 * Catálogo con todos los objetos del juego.
 * PARA AÑADIR UN OBJETO: escribe su ficha en data/objetos.json. No hay que tocar nada más.
 */
export const OBJETOS: readonly Objeto[] = objetosJson as Objeto[];

/** Devuelve la ficha del objeto con ese id. Si no existe, avisa con un error que lista los disponibles. */
export function obtenerObjeto(id: string): Objeto {
  const objeto = OBJETOS.find(o => o.id === id);
  if (!objeto) {
    const disponibles = OBJETOS.map(o => o.id).join(', ');
    throw new Error(`No existe el objeto "${id}". Objetos disponibles: ${disponibles}`);
  }
  return objeto;
}
