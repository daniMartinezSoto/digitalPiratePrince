import type { Tabla } from './tabla';

import buscarInformacion from '../../../data/tablas/buscar-informacion.json';
import caza from '../../../data/tablas/caza.json';
import pesca from '../../../data/tablas/pesca.json';

// El JSON llega sin tipos ("oro" es un texto cualquiera). Aquí, y solo aquí,
// le decimos que es una Tabla. El test de validación comprueba que de verdad lo sea.
const comoTabla = (json: unknown) => json as Tabla;

/**
 * Todas las tablas del juego.
 * PARA AÑADIR UNA TABLA: crea su JSON en data/tablas/, impórtalo arriba y añádelo aquí.
 */
export const TABLAS: readonly Tabla[] = [
  comoTabla(buscarInformacion),
  comoTabla(caza),
  comoTabla(pesca),
];

/** Devuelve la tabla con ese id. Si no existe, avisa con un error que lista las disponibles. */
export function obtenerTabla(id: string): Tabla {
  const tabla = TABLAS.find(t => t.id === id);
  if (!tabla) {
    const disponibles = TABLAS.map(t => t.id).join(', ');
    throw new Error(`No existe la tabla "${id}". Tablas disponibles: ${disponibles}`);
  }
  return tabla;
}
