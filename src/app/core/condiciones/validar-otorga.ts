import { CONDICIONES } from '../catalogos/cargar-condiciones';

/**
 * Revisa un campo "otorga" escrito en un JSON (objetos, habilidades, sobrenombres):
 * las condiciones que esa cosa da mientras la tienes. Debe ser una lista de ids de condiciones
 * que existan. Devuelve los errores en castellano.
 * `donde` es el principio de cada mensaje, p. ej. 'Objeto "amuleto_kalinago"'.
 * El último parámetro son los ids de condiciones válidos (por defecto, los del juego).
 */
export function validarOtorga(
  otorga: unknown,
  donde: string,
  idsDeCondiciones: readonly string[] = CONDICIONES.map(c => c.id),
): string[] {
  if (otorga === undefined) {
    return [];
  }
  if (!Array.isArray(otorga) || otorga.length === 0) {
    return [`${donde}: "otorga" debe ser una lista con al menos una condición (si no da ninguna, no lo pongas).`];
  }

  const errores: string[] = [];
  for (const id of otorga) {
    if (typeof id !== 'string' || !idsDeCondiciones.includes(id)) {
      errores.push(`${donde}: otorga la condición "${String(id)}", que no existe en el catálogo de condiciones (data/condiciones.json).`);
    }
  }
  return errores;
}
