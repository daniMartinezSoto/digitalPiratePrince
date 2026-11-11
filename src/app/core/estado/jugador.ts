
import { Articulo } from './articulo';
import { Seguidor } from './seguidor';

// Datos y recursos del protagonista.
export interface Jugador {
  nombre: string;
  // Sobrenombre obtenido o elegido al crear el personaje.
  sobrenombre: string;

  // Características principales.
  vida: number;
  vidaMax: number;
  fuerza: number;
  ingenio: number;

  // Recursos y progreso.
  oro: number;
  tripulacion: number;
  tripulacionMax: number;
  comida: number;
  fama: number;
  famaObjetivo: number;

  // Días consecutivos que lleva sin comer.
  diasSinComer: number;

  // Artículos que lleva el jugador y capacidad máxima de su inventario.
  inventario: Articulo[];
  capacidadInventario: number;

  // Seguidores que acompañan al jugador.
  seguidores: Seguidor[];
}
