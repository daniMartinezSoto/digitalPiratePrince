// Dónde está el jugador, visto desde las fases de comida y descanso.
// Hasta que exista el mapa (Sprint 9), quien llama dice dónde está; después lo calculará el mapa.
//   barco:      a bordo, en una casilla de mar.
//   puerto, aldea, monasterio: en tierra, en una casilla con ese rasgo.
//   guarida:    una guarida pirata NEUTRAL ("puerto pirata"): funciona como un puerto, salvo que la
//               audiencia es con el capitán pirata y al buscar información cuenta la fama (sin sobornos).
//   intemperie: en tierra, en cualquier otro sitio (playa, jungla, jungla profunda).
export const LUGARES = ['barco', 'puerto', 'aldea', 'monasterio', 'intemperie', 'guarida'] as const;
export type Lugar = (typeof LUGARES)[number];

// Rasgo de la casilla (el icono del mapa) que importa a las acciones. Lo dirá el mapa (Sprint 9).
//   naufragio: se puede investigar (una vez).   ruinas: se pueden registrar (una vez).
// Irán llegando más (barco, abundancia...) cuando haga falta.
export const RASGOS = ['naufragio', 'ruinas'] as const;
export type Rasgo = (typeof RASGOS)[number];

/** ¿Funciona como un puerto (mercado, contratar, taberna, posada...)? Los puertos y las guaridas piratas neutrales. */
export function esPuerto(lugar: Lugar): boolean {
  return lugar === 'puerto' || lugar === 'guarida';
}
