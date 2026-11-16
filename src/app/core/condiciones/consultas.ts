import { CONDICIONES } from '../catalogos/cargar-condiciones';
import type { AjusteDeCondicion, Condicion, Prohibicion } from '../catalogos/condicion';
import type { Jugador } from '../estado/jugador';

// Preguntas sobre las condiciones que el jugador tiene AHORA MISMO.
// Solo consultan: no cambian nada. Por eso, al quitarse una condición, la respuesta
// vuelve sola a lo normal (no hay nada que deshacer).
// El último parámetro es el catálogo donde buscar las fichas: por defecto, el del juego;
// los tests pueden pasar otro.

// Reservas de comida que gasta el grupo cada día si ninguna condición lo cambia.
const COMIDA_POR_DIA_NORMAL = 1;

/**
 * Ids de las condiciones activas que prohíben eso, en el orden en que las tiene el jugador.
 * Sirve para explicarle por qué no puede: "No puedes viajar: Tormenta".
 * Lista vacía = nada lo prohíbe.
 */
export function condicionesQueProhiben(
  jugador: Jugador,
  prohibicion: Prohibicion,
  condiciones: readonly Condicion[] = CONDICIONES,
): string[] {
  return fichasActivas(jugador, condiciones)
    .filter(ficha => ficha.prohibe?.includes(prohibicion))
    .map(ficha => ficha.id);
}

/** ¿Alguna condición activa prohíbe eso? Con tormenta, estaProhibido(jugador, 'viajar') es true. */
export function estaProhibido(
  jugador: Jugador,
  prohibicion: Prohibicion,
  condiciones: readonly Condicion[] = CONDICIONES,
): boolean {
  return condicionesQueProhiben(jugador, prohibicion, condiciones).length > 0;
}

/**
 * Puntos de fama que el jugador necesita para ganar AHORA: los de su personaje
 * (10, u 8 el conformista) más lo que digan sus condiciones (ambición desmedida: +2).
 * Nunca menos de 1.
 */
export function famaObjetivoActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(1, jugador.famaObjetivo + sumaDeAjustes(jugador, 'famaObjetivo', condiciones));
}

/**
 * Reservas de comida que gasta el grupo hoy: 1, más lo que digan sus condiciones
 * (hambre insaciable: +1). Nunca menos de 0.
 */
export function comidaPorDia(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(0, COMIDA_POR_DIA_NORMAL + sumaDeAjustes(jugador, 'comidaPorDia', condiciones));
}

/** Suma lo que aportan a una regla todas las condiciones activas. */
function sumaDeAjustes(jugador: Jugador, regla: AjusteDeCondicion, condiciones: readonly Condicion[]): number {
  let total = 0;
  for (const ficha of fichasActivas(jugador, condiciones)) {
    total += ficha.ajustes?.[regla] ?? 0;
  }
  return total;
}

/** Las fichas de catálogo de las condiciones que tiene el jugador. */
function fichasActivas(jugador: Jugador, condiciones: readonly Condicion[]): Condicion[] {
  return jugador.condiciones.map(activa => {
    const ficha = condiciones.find(c => c.id === activa.id);
    if (!ficha) {
      throw new Error(`El jugador tiene la condición "${activa.id}", que no está en el catálogo`);
    }
    return ficha;
  });
}
