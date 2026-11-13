
// Representa a un personaje que acompaña al jugador durante la aventura.
export interface Seguidor {
  id: string;
  // Tipo de seguidor (cocinero, nativo, forzudo, etc.).
  tipo: string;

  nombre: string;

  // Daño que realiza cuando participa en un combate.
  ataque: number;

  // Resistencia actual y máxima. La resistencia funciona como su vida.
  resistencia: number;
  resistenciaMaxima: number;

  // Ids de sus habilidades en el catálogo (p. ej. ["cirujano"]).
  // El nombre, la descripción y los bonificadores se buscan en el catálogo.
  habilidades: string[];
}
