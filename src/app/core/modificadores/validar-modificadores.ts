import { IDS_TIRADA } from './id-tirada';

const TIRADAS: readonly string[] = IDS_TIRADA;

/**
 * Revisa un campo "modificadores" escrito en un JSON (objetos, condiciones...).
 * Solo admite tiradas que existen y bonificadores enteros. Devuelve los errores en castellano.
 * `donde` es el principio de cada mensaje, p. ej. 'Objeto "amuleto_kalinago"'.
 */
export function validarModificadores(modificadores: unknown, donde: string): string[] {
  if (modificadores === undefined) {
    return [];
  }
  if (typeof modificadores !== 'object' || modificadores === null || Array.isArray(modificadores)) {
    return [`${donde}: "modificadores" debe ser una lista de tiradas con su bonificador.`];
  }

  const errores: string[] = [];
  for (const [tirada, valor] of Object.entries(modificadores)) {
    if (!TIRADAS.includes(tirada)) {
      errores.push(`${donde}: el bonificador va sobre la tirada "${tirada}", que no existe (válidas: ${IDS_TIRADA.join(', ')}).`);
    } else if (!Number.isInteger(valor)) {
      errores.push(`${donde}: el bonificador de "${tirada}" debe ser un número entero.`);
    }
  }
  return errores;
}
