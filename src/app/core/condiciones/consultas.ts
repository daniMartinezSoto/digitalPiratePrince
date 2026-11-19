import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import type { AjusteDeCondicion, Condicion, Prohibicion } from '../catalogos/condicion';
import type { Jugador } from '../estado/jugador';
import { condicionesVigentes } from './condiciones-vigentes';

// Preguntas sobre las condiciones que el jugador tiene AHORA MISMO: las apuntadas, las que van
// dentro de otra (las dos mitades del amuleto maldito) y las que le otorgan sus cosas
// (ver condiciones-vigentes.ts).
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

// Fuerza, ingenio, vida máxima y máximo de seguidores ACTUALES: el valor de la hoja del personaje
// más lo que den sus condiciones (las bendiciones del amuleto maldito). La hoja no cambia nunca
// por una condición: así, al quitarse el amuleto, todo vuelve solo a su valor.
// Las reglas y la interfaz deben usar estas funciones, no leer jugador.fuerza directamente
// (también los futuros chequeos de Fuerza e Ingenio).

/** Fuerza de ahora: la del personaje + sus condiciones (fuerza letal: +1). Nunca menos de 1. */
export function fuerzaActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(1, jugador.fuerza + sumaDeAjustes(jugador, 'fuerza', condiciones));
}

/** Ingenio de ahora: el del personaje + sus condiciones (súper cerebro: +2). Nunca menos de 1. */
export function ingenioActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(1, jugador.ingenio + sumaDeAjustes(jugador, 'ingenio', condiciones));
}

/** Vida máxima de ahora: la del personaje + sus condiciones (gran fortaleza: +4). Nunca menos de 1. Es el tope de la vida. */
export function vidaMaxActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(1, jugador.vidaMax + sumaDeAjustes(jugador, 'vidaMax', condiciones));
}

/** Seguidores que puede llevar ahora: AJUSTES.maximoSeguidores (3) + sus condiciones (carisma: +1). Nunca menos de 0. */
export function maximoSeguidoresActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(0, AJUSTES.maximoSeguidores + sumaDeAjustes(jugador, 'maximoSeguidores', condiciones));
}

/**
 * Cuánto se reduce cada golpe que le aciertan al jugador en combate (piel de piedra: 1). 0 = nada.
 * Se aplica con reducirDano (core/combate/ataque.ts), que deja siempre al menos 1 si el golpe acierta.
 */
export function reduccionDanoActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(0, sumaDeAjustes(jugador, 'reduccionDano', condiciones));
}

/**
 * Cuánta tripulación menos pierdes en cada duelo perdido del combate naval (casco reforzado: 1). 0 = nada.
 * El combate naval deja siempre al menos 1 si el barco hace daño.
 */
export function reduccionDanoNavalActual(jugador: Jugador, condiciones: readonly Condicion[] = CONDICIONES): number {
  return Math.max(0, sumaDeAjustes(jugador, 'reduccionDanoNaval', condiciones));
}

/** Suma lo que aportan a una regla todas las condiciones activas. */
function sumaDeAjustes(jugador: Jugador, regla: AjusteDeCondicion, condiciones: readonly Condicion[]): number {
  let total = 0;
  for (const ficha of fichasActivas(jugador, condiciones)) {
    total += ficha.ajustes?.[regla] ?? 0;
  }
  return total;
}

/** Las fichas de catálogo de las condiciones vigentes del jugador (apuntadas, partes y otorgadas). */
function fichasActivas(jugador: Jugador, condiciones: readonly Condicion[]): Condicion[] {
  return condicionesVigentes(jugador).map(vigente => {
    const ficha = condiciones.find(c => c.id === vigente.id);
    if (!ficha) {
      throw new Error(`El jugador tiene la condición "${vigente.id}", que no está en el catálogo`);
    }
    return ficha;
  });
}
