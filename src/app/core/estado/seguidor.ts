
import { Habilidad } from './habilidad';

// Representa a un personaje que acompaña al jugador durante la aventura.
export interface Seguidor {
  // Tipo de seguidor (cocinero, nativo, forzudo, etc.).
  tipo: string;

  nombre: string;

  // Daño que realiza cuando participa en un combate.
  ataque: number;

  // Resistencia actual y máxima. La resistencia funciona como su vida.
  resistencia: number;
  resistenciaMaxima: number;

  // Habilidades pasivas y activas propias de este seguidor.
  habilidades: Habilidad[];
}
