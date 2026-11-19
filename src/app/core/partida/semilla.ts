// LA SEMILLA DE UNA PARTIDA (Sprint 8; decidido por el autor): un número de 6 cifras como
// mucho (de 0 a 999.999), fácil de leer y de pasar a un amigo para jugar la misma partida.
// Un millón de partidas distintas.
// crearPartida admite cualquier entero (los tests usan semillas pequeñas); el límite lo
// aplica el store al empezar una partida nueva.
export const SEMILLA_MAXIMA = 999_999;

export function esSemillaValida(semilla: unknown): semilla is number {
  return Number.isInteger(semilla) && (semilla as number) >= 0 && (semilla as number) <= SEMILLA_MAXIMA;
}
