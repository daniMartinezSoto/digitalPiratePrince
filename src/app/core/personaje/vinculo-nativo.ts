import type { Jugador } from '../estado/jugador';

// Ids que dan "vínculo nativo". El tipo de seguidor es provisional: el catálogo de
// seguidores llega en el Sprint 6 y entonces se confirma (o se cambia aquí, en un solo sitio).
const SOBRENOMBRE_NATIVO = 'el_nativo';
const OBJETO_KALINAGO = 'amuleto_kalinago';
const TIPO_SEGUIDOR_NATIVO = 'nativo';

/**
 * ¿Las aldeas nativas tratan al jugador como a uno de los suyos?
 * Sí, si su sobrenombre es "el nativo", si lleva el amuleto kalinago o si le acompaña un seguidor nativo.
 * De momento sirve para que acepten su oro a cambio de comida; más reglas de aldea lo usarán en el Sprint 6.
 */
export function tieneVinculoNativo(jugador: Jugador): boolean {
  return (
    jugador.sobrenombre === SOBRENOMBRE_NATIVO ||
    jugador.inventario.some(objeto => objeto.id === OBJETO_KALINAGO) ||
    jugador.seguidores.some(seguidor => seguidor.tipo === TIPO_SEGUIDOR_NATIVO)
  );
}
