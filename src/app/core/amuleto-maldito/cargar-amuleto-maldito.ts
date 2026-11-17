import type { AmuletoMaldito } from './amuleto-maldito';

import amuletoJson from '../../data/amuleto-maldito.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que tiene el formato de AmuletoMaldito.
// El test comprueba con el revisor (validar-amuleto-maldito.ts) que de verdad lo tenga.

/**
 * Las dos tablas del amuleto maldito.
 * PARA CAMBIAR UNA BENDICIÓN O UNA MALDICIÓN: edita data/amuleto-maldito.json (y, si es nueva,
 * escribe su ficha en data/condiciones.json). No hay que tocar nada más.
 */
export const AMULETO_MALDITO: AmuletoMaldito = amuletoJson as AmuletoMaldito;
