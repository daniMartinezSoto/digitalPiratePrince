import type { Estado } from '../estado/estado';
import { esAgua } from '../turno/lugar';
import { obtenerMapa } from './cargar-mapas';
import { distancia, mismaCasilla, vecinas } from './hexagonos';
import { casillaEn, type Casilla, type Coordenada, type Mapa } from './mapa';

// DÓNDE ESTÁS Y DÓNDE ESTÁ EL BARCO (Sprint 9, paso 3).
// La partida guarda mundo.posicion (el jugador) y mundo.posicionBarco (el barco). No hay ningún
// "modo a bordo / a pie": vas a bordo si estás en la misma casilla que el barco. Así nunca puede
// pasar que el juego crea que vas a bordo y el barco esté en otro sitio.

/**
 * Dónde espera el barco al empezar (decidido por el autor el 20-nov): en el agua junto al puerto
 * principal más cercano a la casilla de inicio (en el primer mapa, La Habana), en su primera
 * vecina de agua en el orden N, NE, SE, S, SO, NO. Si ese puerto no tiene agua al lado, null
 * (el revisor de mapas lo trata como error, para que no pase a mitad de una partida).
 * Si dos puertos están a la misma distancia, gana el primero de la lista del mapa.
 */
export function casillaInicialDelBarco(mapa: Mapa): Coordenada | null {
  const cercano = [...mapa.puertosPrincipales].sort((a, b) => distancia(a, mapa.inicio) - distancia(b, mapa.inicio))[0];
  if (!cercano) return null;
  return vecinas(mapa, cercano).find(c => esAgua(casillaEn(mapa, c.col, c.fila)!.terreno)) ?? null;
}

/** true si el jugador está en la casilla del barco (va a bordo); false si va a pie. */
export function vasABordo(estado: Estado): boolean {
  return mismaCasilla(estado.mundo.posicion, estado.mundo.posicionBarco);
}

/** El mapa de la partida. */
export function mapaDeLaPartida(estado: Estado): Mapa {
  return obtenerMapa(estado.mundo.mapaId);
}

/** La casilla del mapa en la que está el jugador (terreno, rasgo, nombre...). */
export function casillaActual(estado: Estado): Casilla {
  const { col, fila } = estado.mundo.posicion;
  const casilla = casillaEn(mapaDeLaPartida(estado), col, fila);
  if (!casilla) throw new Error(`casillaActual: la posición ${col},${fila} está fuera del mapa "${estado.mundo.mapaId}"`);
  return casilla;
}
