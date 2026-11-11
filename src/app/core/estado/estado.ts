
import { Jugador } from './jugador';
import { Mundo } from './mundo';

// Estado completo de una partida.
// Agrupa los datos del jugador y los datos del mundo.
// Es la estructura principal que utilizaremos para guardar,
// cargar y actualizar el progreso de la aventura.
export interface Estado {

  // Versión de la estructura del estado.
  // Permitirá identificar con qué versión del juego se creó
  // una partida guardada y facilitar futuras modificaciones.
  version: number;

  // Datos del protagonista: características, recursos,
  // inventario, seguidores y demás información del jugador.
  jugador: Jugador;

  // Datos del mundo: mapa, posición, día, acontecimientos,
  // puertos visitados, marcas y estado del generador de dados.
  mundo: Mundo;
}
