import type { Dados } from '../dados/dados';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import { mapaDeLaPartida, vasABordo } from '../mapa/donde-estas';
import { avanzar, dentroDelMapa, mismaCasilla, vecinaAlAzar, type Direccion } from '../mapa/hexagonos';
import type { Casilla, Coordenada } from '../mapa/mapa';
import { casillaBloqueada, sitioEn } from '../mapa/sitio-actual';
import { esAgua } from '../turno/lugar';
import { llegar } from './llegar';

// LO QUE TE MUEVE SIN QUE ELIJAS (Sprint 9, paso 7). No es viajar: no gasta la acción, no cambia
// la fase del día y no tira el evento de viaje. Pero llegar a una casilla es llegar (llegar.ts): el
// escorbuto se cura al tocar tierra, un puerto principal queda visitado, puede ser la victoria...
// Lo usan:
//   - echarAVecinaAlAzar: te echan de la aldea al dormir (descansar), y más adelante el tabú sagrado
//     y la guarida hostil (eventos del Sprint 10). Solo a TIERRA (decidido por el autor el 20-nov).
//   - desviar: los movimientos forzados de los eventos (vientos fuertes E009, tierra E028...).
//   - moverA: el movimiento en sí, para cualquier evento que mande a una casilla concreta.

export interface ResultadoMovimiento {
  estado: Estado;
  cambios: Cambio[];
  eventos: string[];
  puertoNuevo: boolean;
  /** Dónde ha acabado (null si no había ninguna casilla a la que ir y no se ha movido). */
  destino: Coordenada | null;
}

const sinMoverse = (estado: Estado): ResultadoMovimiento => ({ estado, cambios: [], eventos: [], puertoNuevo: false, destino: null });

/**
 * Mueve al jugador a esa casilla (y al barco con él si va a bordo) y aplica la llegada. Si cae fuera
 * del mapa o en una casilla bloqueada, error: quien llama elige una casilla válida.
 */
export function moverA(estado: Estado, destino: Coordenada, dados: Dados): ResultadoMovimiento {
  const mapa = mapaDeLaPartida(estado);
  if (!dentroDelMapa(mapa, destino)) throw new Error(`moverA: ${destino.col},${destino.fila} está fuera del mapa`);
  if (casillaBloqueada(estado, destino)) throw new Error(`moverA: ${destino.col},${destino.fila} está bloqueada`);
  const aBordo = vasABordo(estado);
  const casilla = { col: destino.col, fila: destino.fila };
  const movido: Estado = {
    ...estado,
    mundo: { ...estado.mundo, posicion: casilla, ...(aBordo ? { posicionBarco: { ...casilla } } : {}) },
  };
  const sitio = sitioEn(movido, casilla, aBordo);
  const llegada = llegar(movido, { lugar: sitio.lugar, rasgo: sitio.rasgo, puertoPrincipal: sitio.puertoPrincipal }, dados);
  return { estado: llegada.estado, cambios: llegada.cambios, eventos: llegada.eventos, puertoNuevo: llegada.puertoNuevo, destino: casilla };
}

/**
 * Te echan a una casilla de TIERRA vecina al azar que no esté bloqueada (la aldea de la que te echan
 * ya lo está). Gasta un número si hay varias opciones. Si no hay ninguna, te quedas donde estás.
 * Solo a pie (a bordo no tiene sentido: no se mueve nada).
 */
export function echarAVecinaAlAzar(estado: Estado, dados: Dados): ResultadoMovimiento {
  if (vasABordo(estado)) return sinMoverse(estado);
  const mapa = mapaDeLaPartida(estado);
  const destino = vecinaAlAzar(mapa, estado.mundo.posicion, dados, (c: Casilla) => !esAgua(c.terreno) && !casillaBloqueada(estado, c));
  return destino ? moverA(estado, destino, dados) : sinMoverse(estado);
}

/**
 * Un movimiento forzado en línea recta: `pasos` casillas en una dirección (del libro: 1 SE, 2 S...).
 * A bordo solo por agua y a pie solo por tierra, sin entrar en casillas bloqueadas: se para antes
 * de la primera que no valga y, si se sale del mapa, en la última casilla válida antes del borde.
 * Si no puede dar ni un paso, no se mueve.
 */
export function desviar(estado: Estado, direccion: Direccion, pasos: number, dados: Dados): ResultadoMovimiento {
  const mapa = mapaDeLaPartida(estado);
  const aBordo = vasABordo(estado);
  const desde = estado.mundo.posicion;
  const destino = avanzar(mapa, desde, direccion, pasos, c => esAgua(c.terreno) === aBordo && !casillaBloqueada(estado, c));
  return mismaCasilla(destino, desde) ? sinMoverse(estado) : moverA(estado, destino, dados);
}
