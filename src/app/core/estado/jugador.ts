
import { ObjetoLlevado } from './objeto-llevado';
import { CondicionActiva } from './condicion-activa';
import { Seguidor } from './seguidor';
import type { Retrato } from '../personaje/retrato';

// Datos y recursos del protagonista.
export interface Jugador {
  nombre: string;
  // Sobrenombre obtenido o elegido al crear el personaje.
  sobrenombre: string;
  // Su dibujo: "hombre" o "mujer" (se elige al crear el personaje; core/personaje/retrato.ts).
  retrato: Retrato;

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

  // Objetos que lleva (solo id y usos; el resto, en el catálogo) y huecos del inventario.
  // Un objeto puede ocupar varios huecos (campo "espacios" del catálogo).
  inventario: ObjetoLlevado[];
  capacidadInventario: number;

  // Seguidores que acompañan al jugador (máximo 3).
  seguidores: Seguidor[];

  // Maldiciones, bendiciones, enfermedades, tormenta... que le afectan ahora.
  condiciones: CondicionActiva[];

  // Turnos en los que perderá la fase de acción (E006, E007, E009...).
  // Ese turno no hay acción, pero se come igual.
  fasesAccionPerdidas: number;
}
