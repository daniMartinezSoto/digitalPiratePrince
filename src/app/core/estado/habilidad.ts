
// Representa una habilidad que tiene un seguidor.
export interface Habilidad {
  // Identificador utilizado por la lógica del juego para reconocer la habilidad.
  id: string;

  nombre: string;
  descripcion: string;

  // Las pasivas se aplican automáticamente.
  // Las activas pueden ser utilizadas por el jugador desde el menú del seguidor.
  tipo: 'pasiva' | 'activa';
}
