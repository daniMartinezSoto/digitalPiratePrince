
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

  // true = nunca se marcha por su cuenta (ni por hambre ni por dormir en la calle): el hermano,
  // el náufrago que te debe la vida... Sí puede morir. Sin ponerlo = un seguidor normal.
  inseparable?: boolean;

  // true = si muere, el jugador PIERDE la partida (el seguidor de "el hermano").
  // No es lo mismo que inseparable: habrá inseparables cuya muerte no hace perder.
  vital?: boolean;
}
