import type { Sitio } from '../core/acciones/accion';
import type { Lugar, Rasgo, TerrenoAlRaso } from '../core/turno/lugar';

// "¿DÓNDE ESTÁS?" (pantalla de pruebas): mientras no exista el mapa (Sprint 9), el jugador elige a
// mano dónde está. La casilla (col, fila) es un número inventado para probar lo que se recuerda por
// casilla (tesoro enterrado, audiencias, ruinas registradas...): cambiarla es "estar en otro sitio".
export interface Ubicacion {
  lugar: Lugar;
  terreno: TerrenoAlRaso; // solo cuenta al raso (evento nocturno)
  juntoAlAgua: boolean;
  rasgo: Rasgo | 'ninguno';
  col: number;
  fila: number;
  // Si estás en uno de los puertos principales al que has llegado viajando, cuál ("tortuga").
  puerto?: string;
}

export const UBICACION_INICIAL: Ubicacion = {
  lugar: 'barco',
  terreno: 'jungla',
  juntoAlAgua: false,
  rasgo: 'ninguno',
  col: 0,
  fila: 0,
};

/** El "Sitio" que entienden las reglas a partir de lo elegido en la pantalla. */
export function sitioDe(ubicacion: Ubicacion): Sitio {
  return {
    lugar: ubicacion.lugar,
    hex: { col: ubicacion.col, fila: ubicacion.fila },
    juntoAlAgua: ubicacion.juntoAlAgua,
    ...(ubicacion.rasgo === 'ninguno' ? {} : { rasgo: ubicacion.rasgo }),
  };
}
