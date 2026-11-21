import { obtenerMapa } from '../mapa/cargar-mapas';
import { casillaInicialDelBarco } from '../mapa/donde-estas';

// ADAPTADORES POR VERSIÓN (Sprint 8).
//
// Cuando cambie el formato del estado (un campo nuevo, uno que cambia de nombre...), se sube
// VERSION_ESTADO (core/partida/crear-partida.ts) y se escribe aquí un adaptador que pasa una
// partida guardada de la versión anterior a la nueva. Así las partidas guardadas siguen valiendo.
//
// Ejemplo: si en la versión 2 "diasSinComer" se llamara "diasDeHambre", el adaptador 1 sería:
//   1: datos => {
//     const jugador = { ...(datos['jugador'] as Record<string, unknown>) };
//     jugador['diasDeHambre'] = jugador['diasSinComer'];
//     delete jugador['diasSinComer'];
//     return { ...datos, jugador };
//   },
//
// La clave es la versión DE ORIGEN (1 = pasa de la 1 a la 2). Se encadenan solos: una partida
// de la versión 1 con el juego en la 3 pasa por el 1 y luego por el 2.
// El adaptador NO tiene que cambiar "version": lo hace adaptarPartida.
// Un test comprueba que no falta ningún eslabón entre la 1 y la versión actual.

/** Datos de una partida guardada tal como salen del texto (aún sin comprobar). */
export type DatosDePartida = Record<string, unknown>;

/** Pasa una partida de una versión a la siguiente. */
export type Adaptador = (datos: DatosDePartida) => DatosDePartida;

/**
 * 1 → 2 (Sprint 9, el primero de verdad): las partidas de antes del mapa no sabían dónde estaba
 * nadie (mapaId y posicion vacíos, sin posicionBarco). Se rellenan como en una partida nueva: el
 * primer mapa de prueba, el jugador a pie en la casilla de inicio y el barco junto a La Habana.
 * Lo demás (vida, oro, día, un combate a medias...) se queda igual.
 * OJO: el adaptador fija el mapa por su id ('primer-mapa-prueba') a propósito: aunque un día el
 * mapa por defecto sea otro, las partidas de entonces se jugaban en este.
 */
function adaptador1a2(datos: DatosDePartida): DatosDePartida {
  const mundo = { ...(datos['mundo'] as Record<string, unknown>) };
  const mapa = obtenerMapa('primer-mapa-prueba');
  mundo['mapaId'] = mapa.id;
  mundo['posicion'] = { ...mapa.inicio };
  mundo['posicionBarco'] = casillaInicialDelBarco(mapa);
  return { ...datos, mundo };
}

/** Los adaptadores del juego (la clave es la versión DE ORIGEN). */
export const ADAPTADORES: Readonly<Record<number, Adaptador>> = { 1: adaptador1a2 };

/**
 * Lleva una partida de su versión a versionActual pasando por los adaptadores, en orden.
 * Devuelve null si falta algún adaptador por el camino (no debería pasar: lo vigila un test).
 */
export function adaptarPartida(
  datos: DatosDePartida,
  versionActual: number,
  adaptadores: Readonly<Record<number, Adaptador>> = ADAPTADORES,
): DatosDePartida | null {
  let actual = datos;
  let version = actual['version'] as number;
  while (version < versionActual) {
    const adaptador = adaptadores[version];
    if (!adaptador) {
      return null;
    }
    actual = { ...adaptador(actual), version: version + 1 };
    version++;
  }
  return actual;
}
