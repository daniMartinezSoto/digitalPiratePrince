// Dónde está el jugador, visto desde las fases de comida y descanso.
// Hasta que exista el mapa (Sprint 9), quien llama dice dónde está; después lo calculará el mapa.
//   barco:      a bordo, en una casilla de mar.
//   puerto, aldea, monasterio: en tierra, en una casilla con ese rasgo.
//   intemperie: en tierra, en cualquier otro sitio (playa, jungla, jungla profunda).
export const LUGARES = ['barco', 'puerto', 'aldea', 'monasterio', 'intemperie'] as const;
export type Lugar = (typeof LUGARES)[number];
