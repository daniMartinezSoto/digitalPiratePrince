import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion } from '../catalogos/condicion';
import type { Objeto } from '../catalogos/objeto';
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

/** Catálogos en los que buscar las fichas. Por defecto, los del juego; los tests pueden pasar otros. */
export interface CatalogosModificadores {
  objetos: readonly Objeto[];
  condiciones: readonly Condicion[];
}

const CATALOGOS_DEL_JUEGO: CatalogosModificadores = { objetos: OBJETOS, condiciones: CONDICIONES };

/**
 * Suma todos los bonificadores fijos que tiene el jugador para una tirada:
 *   sobrenombre + objetos que lleva + condiciones que tiene + "por cada X de fama".
 * Ejemplo: "el nativo" (+1) con el amuleto kalinago (+1) busca información en una aldea con +2.
 * Lo puntual (p. ej. "+1 por pagar 5 de oro") NO va aquí: lo suma quien llama.
 * Los seguidores se sumarán en el Sprint 6.
 */
export function calcularModificador(
  jugador: Jugador,
  idTirada: IdTirada,
  catalogos: CatalogosModificadores = CATALOGOS_DEL_JUEGO,
): number {
  return (
    modificadorDelSobrenombre(jugador.sobrenombre, idTirada) +
    modificadorDeObjetos(jugador, idTirada, catalogos.objetos) +
    modificadorDeCondiciones(jugador, idTirada, catalogos.condiciones) +
    modificadorPorFama(jugador.fama, idTirada)
  );
}

function modificadorDelSobrenombre(idSobrenombre: string, idTirada: IdTirada): number {
  const sobrenombre = sobrenombres.find(s => s.id === idSobrenombre);
  if (!sobrenombre) {
    throw new Error(`calcularModificador: no existe el sobrenombre "${idSobrenombre}"`);
  }
  // Si el sobrenombre no menciona esta tirada, no da bonificador.
  return sobrenombre.modificadores[idTirada] ?? 0;
}

/** Cada objeto que lleva suma lo suyo (si lleva dos iguales, cuenta dos veces). */
function modificadorDeObjetos(jugador: Jugador, idTirada: IdTirada, objetos: readonly Objeto[]): number {
  let total = 0;
  for (const llevado of jugador.inventario) {
    const ficha = objetos.find(o => o.id === llevado.id);
    if (!ficha) {
      throw new Error(`calcularModificador: el jugador lleva el objeto "${llevado.id}", que no está en el catálogo`);
    }
    total += ficha.modificadores?.[idTirada] ?? 0;
  }
  return total;
}

function modificadorDeCondiciones(jugador: Jugador, idTirada: IdTirada, condiciones: readonly Condicion[]): number {
  let total = 0;
  for (const activa of jugador.condiciones) {
    const ficha = condiciones.find(c => c.id === activa.id);
    if (!ficha) {
      throw new Error(`calcularModificador: el jugador tiene la condición "${activa.id}", que no está en el catálogo`);
    }
    total += ficha.modificadores?.[idTirada] ?? 0;
  }
  return total;
}

/** "+1 por cada X de fama" (AJUSTES.bonificadorPorFama). Con 5 de fama y "cada 2": +2. */
function modificadorPorFama(fama: number, idTirada: IdTirada): number {
  const cada = AJUSTES.bonificadorPorFama[idTirada];
  return cada === undefined ? 0 : Math.floor(fama / cada);
}
