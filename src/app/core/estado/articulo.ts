
// Representa un artículo que el jugador puede llevar en su inventario.
export interface Articulo {
  // Identificador único del artículo, utilizado para reconocerlo en la lógica del juego.
  id: string;

  nombre: string;
  descripcion: string;

  // Los pasivos permanecen en el inventario.
  // Los activos pueden utilizarse y se descartan al agotar sus usos.
  tipo: 'pasivo' | 'activo';

  // Usos disponibles del artículo. En los pasivos no se utilizan.
  usosMaximos: number;
  usosRestantes: number;
}
