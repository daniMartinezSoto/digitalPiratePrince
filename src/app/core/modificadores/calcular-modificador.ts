import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { HABILIDADES } from '../catalogos/cargar-habilidades';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Condicion } from '../catalogos/condicion';
import type { Habilidad } from '../catalogos/habilidad';
import { condicionesVigentes } from '../condiciones/condiciones-vigentes';
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
  // Habilidades de los seguidores. Sin ponerlas = las del juego.
  habilidades?: readonly Habilidad[];
}

const CATALOGOS_DEL_JUEGO: CatalogosModificadores = { objetos: OBJETOS, condiciones: CONDICIONES };

/**
 * Suma todos los bonificadores fijos que tiene el jugador para una tirada:
 *   sobrenombre + objetos que lleva + condiciones que tiene + habilidades de sus seguidores + "por cada X de fama".
 * Ejemplo: "el nativo" (+1) con el amuleto kalinago (+1) y un seguidor nativo (+1) busca información en una aldea con +3.
 * TODO SUMA, también lo repetido: dos seguidores nativos dan +2 (decisión del autor: que haya combinaciones locas).
 * Lo puntual (p. ej. "+1 por pagar 5 de oro") NO va aquí: lo suma quien llama.
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
    modificadorDeSeguidores(jugador, idTirada, catalogos.habilidades ?? HABILIDADES) +
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
  // Las vigentes: las apuntadas, las que van dentro de otra (amuleto maldito) y las otorgadas.
  for (const activa of condicionesVigentes(jugador)) {
    const ficha = condiciones.find(c => c.id === activa.id);
    if (!ficha) {
      throw new Error(`calcularModificador: el jugador tiene la condición "${activa.id}", que no está en el catálogo`);
    }
    total += ficha.modificadores?.[idTirada] ?? 0;
  }
  return total;
}

/** Cada seguidor suma lo que den sus habilidades (dos seguidores con la misma habilidad cuentan dos veces). */
function modificadorDeSeguidores(jugador: Jugador, idTirada: IdTirada, habilidades: readonly Habilidad[]): number {
  let total = 0;
  for (const seguidor of jugador.seguidores) {
    for (const idHabilidad of seguidor.habilidades) {
      const ficha = habilidades.find(h => h.id === idHabilidad);
      if (!ficha) {
        throw new Error(
          `calcularModificador: el seguidor "${seguidor.id}" tiene la habilidad "${idHabilidad}", que no está en el catálogo`,
        );
      }
      total += ficha.modificadores?.[idTirada] ?? 0;
    }
  }
  return total;
}

/** "+1 por cada X de fama" (AJUSTES.bonificadorPorFama). Con 5 de fama y "cada 2": +2. */
function modificadorPorFama(fama: number, idTirada: IdTirada): number {
  const cada = AJUSTES.bonificadorPorFama[idTirada];
  return cada === undefined ? 0 : Math.floor(fama / cada);
}
