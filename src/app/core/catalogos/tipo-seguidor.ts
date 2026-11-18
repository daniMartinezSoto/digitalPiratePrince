// Ficha de catálogo de un TIPO de seguidor (data/seguidores.json, Sprint 6): "forzudo", "mono"...
// Es lo que NO cambia durante la partida: nombre del tipo, texto, precio, con qué números empieza.
// La partida guarda un Seguidor (core/estado/seguidor.ts): a TU forzudo, con su nombre propio
// y la resistencia que le queda. Lo fabrica crearSeguidor (core/seguidores/crear-seguidor.ts).
export interface TipoSeguidor {
  // Identificador único, p. ej. "barbero_cirujano".
  id: string;

  // Nombre del tipo ("Forzudo"). El nombre propio ("Rufus Malapata") se elige al azar al crearlo.
  nombre: string;
  descripcion: string;

  // Ruta del dibujo. Opcional mientras no haya dibujos.
  imagen?: string;

  // Daño que hace cuando acierta en combate (obligatorio; lo normal, 2). Con 0 no entra en combate (el mono).
  ataque: number;

  // Resistencia (su vida) con la que empieza, que es también su máximo (obligatoria; lo normal, 10).
  resistencia: number;

  // Ids de sus habilidades en el catálogo de habilidades (data/habilidades.json). Puede estar vacía.
  habilidades: string[];

  // De qué listas de nombres sale su nombre propio (ids de data/nombres-seguidores.json).
  // Sin ponerlo = las normales: nombres de pirata, hombres y mujeres juntos.
  // La bruja vudú: ["mujeres"]. El nativo: ["nativos"].
  nombres?: string[];

  // Oro que cuesta contratarlo en un puerto (0 = gratis).
  // Sin precio = no se contrata: solo llega por eventos (la bruja vudú).
  precio?: number;
}

// Números normales de un seguidor (los de casi todos; cada ficha los escribe siempre).
export const ATAQUE_NORMAL = 2;
export const RESISTENCIA_NORMAL = 10;
