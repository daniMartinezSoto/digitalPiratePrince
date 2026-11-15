import type { Modificadores } from '../modificadores/id-tirada';

// Categorías de condición. Las reglas hablan muchas veces de la categoría, no de una
// condición concreta: "el monasterio quita UNA MALDICIÓN", "la biblia te libra de una maldición".
export const CATEGORIAS_CONDICION = ['maldicion', 'bendicion', 'enfermedad', 'clima', 'otra'] as const;
export type CategoriaCondicion = (typeof CATEGORIAS_CONDICION)[number];

// Ficha de catálogo de una condición (data/condiciones.json): algo que DURA y afecta al jugador
// (maldiciones, escorbuto, tormenta...). Lo que pasa una sola vez ("tu oro se convierte en ceniza")
// no es una condición: es un efecto normal.
// La partida solo guarda una CondicionActiva (el id y los turnos que le quedan).
// Prohibiciones, cambios de regla, qué pasa cada turno y cómo se quita: Sprint 5.
export interface Condicion {
  // Identificador único, p. ej. "escorbuto".
  id: string;

  nombre: string;
  descripcion: string;

  // Ruta del dibujo. Opcional.
  imagen?: string;

  categoria: CategoriaCondicion;

  // Bonificadores a tiradas mientras dura, igual que objetos y sobrenombres.
  modificadores?: Modificadores;
}
