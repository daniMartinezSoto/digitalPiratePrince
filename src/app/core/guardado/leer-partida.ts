import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import { VERSION_ESTADO } from '../partida/crear-partida';
import { ADAPTADORES, adaptarPartida, type Adaptador } from './adaptadores';
import { esEnteroPositivo, esObjeto, tieneFormaDePartida } from './comprobar-partida';

// LEER UNA PARTIDA GUARDADA (Sprint 8). Lo contrario de guardarPartida.
// NUNCA ROMPE: si el texto no sirve, devuelve el motivo en vez de lanzar un error, y quien
// llama (el store) decide qué hacer (avisar, empezar una partida nueva...).

/**
 * Por qué no se ha podido leer:
 *   no_se_puede_leer:  el texto no es JSON (cortado, basura...).
 *   no_es_una_partida: es JSON, pero no tiene forma de partida (o le falta un adaptador).
 *   version_futura:    es de una versión del juego más nueva que esta: no se carga.
 */
export const MOTIVOS_DE_LECTURA_FALLIDA = ['no_se_puede_leer', 'no_es_una_partida', 'version_futura'] as const;
export type MotivoDeLecturaFallida = (typeof MOTIVOS_DE_LECTURA_FALLIDA)[number];

export type ResultadoDeLectura =
  | { ok: true; estado: Estado }
  | { ok: false; motivo: MotivoDeLecturaFallida };

/**
 * Convierte el texto guardado en un estado, comprobando por el camino:
 *   1. que es JSON;  2. que tiene una versión válida;  3. que no es de una versión futura;
 *   4. lo pasa por los adaptadores si es antigua;  5. que tiene forma de partida.
 * adaptadores y versionActual solo se cambian en los tests.
 */
export function leerPartida(
  texto: string,
  adaptadores: Readonly<Record<number, Adaptador>> = ADAPTADORES,
  versionActual: number = VERSION_ESTADO,
): ResultadoDeLectura {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'no_se_puede_leer' };
  }

  if (!esObjeto(datos) || !esEnteroPositivo(datos['version'])) {
    return { ok: false, motivo: 'no_es_una_partida' };
  }
  if (datos['version'] > versionActual) {
    return { ok: false, motivo: 'version_futura' };
  }

  const adaptados = adaptarPartida(datos, versionActual, adaptadores);
  if (adaptados === null || !tieneFormaDePartida(adaptados)) {
    return { ok: false, motivo: 'no_es_una_partida' };
  }
  return { ok: true, estado: adaptados as unknown as Estado };
}

/**
 * Los dados de una partida cargada: siguen justo donde se quedaron (mundo.estadoDados),
 * así que sacan lo mismo que habrían sacado si el jugador no hubiera cerrado el juego.
 */
export function dadosDePartida(estado: Estado): Dados {
  return new Dados(estado.mundo.estadoDados);
}
