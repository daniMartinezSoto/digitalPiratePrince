// RETRATO DEL JUGADOR (Sprint 7): qué dibujo le representa en el combate y en la hoja de personaje.
// Se elige al crear el personaje (el juego pregunta: ¿hombre o mujer?). La interfaz decide qué
// dibujo corresponde a cada uno; mientras no haya dibujos, una silueta de reserva.
export const RETRATOS = ['hombre', 'mujer'] as const;
export type Retrato = (typeof RETRATOS)[number];
