// Identificadores de las tiradas que pueden recibir bonificadores.
// Sobrenombres (y más adelante seguidores y objetos) declaran sus +1 en el JSON
// usando estos nombres. Es un array para poder recorrerlo en el test que valida los datos.
export const IDS_TIRADA = [
  'buscar_info_puerto',
  'buscar_info_aldea',
  'buscar_info_guarida', // buscar información en una guarida pirata neutral
  'audiencia_puerto',
  'audiencia_aldea',
  'audiencia_guarida',
  'pesca',
  'caza',
  'el_mal', // la tabla diaria de "el mal está a bordo"
  'discurso', // contratar: dar un discurso a los marineros del puerto
  'contratar_seguidor', // contratar: buscar un seguidor (2d6)
  'mendigar', // la acción del artista
] as const;

export type IdTirada = (typeof IDS_TIRADA)[number];

// Lo que se escribe en el JSON: { "buscar_info_puerto": 1, "audiencia_puerto": 1 }.
// Partial = no hace falta poner todas las tiradas, solo las que dan bonificador.
export type Modificadores = Partial<Record<IdTirada, number>>;
