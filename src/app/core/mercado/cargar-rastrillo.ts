import type { Rastrillo } from './rastrillo';

import rastrilloJson from '../../data/rastrillo.json';

// El JSON llega sin tipos. Aquí, y solo aquí, le decimos que tiene el formato de Rastrillo.
// El test comprueba con el revisor (validar-rastrillo.ts) que de verdad lo tenga.

/**
 * Lo que puede salir en el rastrillo del mercado.
 * PARA AÑADIR UN OBJETO AL RASTRILLO: escribe en data/rastrillo.json su id, su peso y su precio
 * (el objeto tiene que existir en data/objetos.json). No hay que tocar nada más.
 */
export const RASTRILLO: Rastrillo = rastrilloJson as Rastrillo;
