// Identificadores de las tiradas que pueden recibir bonificadores.
// Sobrenombres (y más adelante seguidores y objetos) declaran sus +1 en el JSON
// usando estos nombres. Es un array para poder recorrerlo en el test que valida los datos.
export const IDS_TIRADA = [
  'buscar_info_puerto',
  'buscar_info_aldea',
  'audiencia_puerto',
  'audiencia_aldea',
  'audiencia_guarida',
  'pesca',
  'caza',
] as const;

export type IdTirada = (typeof IDS_TIRADA)[number];

// Lo que se escribe en el JSON: { "buscar_info_puerto": 1, "audiencia_puerto": 1 }.
// Partial = no hace falta poner todas las tiradas, solo las que dan bonificador.
export type Modificadores = Partial<Record<IdTirada, number>>;
