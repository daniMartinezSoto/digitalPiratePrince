import { tieneCondicion } from '../condiciones/condiciones-vigentes';
import type { Jugador } from '../estado/jugador';

// El vínculo nativo es una condición del catálogo (data/condiciones.json) que nadie "apunta":
// la OTORGAN el sobrenombre "el nativo", el amuleto kalinago y la habilidad del seguidor nativo
// (campo "otorga" de sus fichas). Para que otra cosa dé vínculo nativo, basta con ponérselo en su ficha.
export const CONDICION_VINCULO_NATIVO = 'vinculo_nativo';

/**
 * ¿Las aldeas nativas tratan al jugador como a uno de los suyos?
 * Sí, si su sobrenombre es "el nativo", si lleva el amuleto kalinago o si le acompaña un seguidor nativo.
 * Sirve para que acepten su oro a cambio de comida y para otras reglas de aldea.
 * (Los +1 de aldea NO salen de aquí: cada fuente da el suyo y se suman.)
 */
export function tieneVinculoNativo(jugador: Jugador): boolean {
  return tieneCondicion(jugador, CONDICION_VINCULO_NATIVO);
}
