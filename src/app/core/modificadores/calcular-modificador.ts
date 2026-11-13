import type { Jugador } from '../estado/jugador';
import type { IdTirada, Modificadores } from './id-tirada';
import sobrenombresJson from '../../data/personaje/sobrenombres.json';

// Solo la parte del sobrenombre que nos interesa aquí.
interface SobrenombreConModificadores {
  id: string;
  modificadores: Modificadores;
}

// El JSON llega sin tipos: lo convertimos una sola vez, aquí.
const sobrenombres = sobrenombresJson as SobrenombreConModificadores[];

/**
 * Suma todos los bonificadores fijos que tiene el jugador para una tirada.
 * Por ahora solo cuenta el sobrenombre; más adelante se sumarán seguidores y objetos.
 * Lo puntual (p. ej. "+1 por pagar 5 de oro") NO va aquí: lo suma quien llama.
 */
export function calcularModificador(jugador: Jugador, idTirada: IdTirada): number {
  return modificadorDelSobrenombre(jugador.sobrenombre, idTirada);
}

function modificadorDelSobrenombre(idSobrenombre: string, idTirada: IdTirada): number {
  const sobrenombre = sobrenombres.find(s => s.id === idSobrenombre);
  if (!sobrenombre) {
    throw new Error(`calcularModificador: no existe el sobrenombre "${idSobrenombre}"`);
  }
  // Si el sobrenombre no menciona esta tirada, no da bonificador.
  return sobrenombre.modificadores[idTirada] ?? 0;
}
