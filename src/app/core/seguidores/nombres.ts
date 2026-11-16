import nombresJson from '../../data/nombres-seguidores.json';

/**
 * Listas de nombres propios para los seguidores ("Rufus Malapata"), cada una con su id:
 *   hombres y mujeres → nombres de pirata;  nativos → nombres de nativo (hombres y mujeres juntos).
 * Un seguidor normal coge su nombre de "hombres" + "mujeres", todo junto. La ficha de un tipo
 * puede pedir otras listas con el campo "nombres" (la bruja vudú: ["mujeres"]; el nativo: ["nativos"]).
 *
 * PARA AÑADIR NOMBRES: escríbelos en su lista de data/nombres-seguidores.json.
 * PARA AÑADIR UNA LISTA: añádela a ese archivo con un id nuevo y ponlo en la ficha del seguidor.
 */
export const LISTAS_DE_NOMBRES: Readonly<Record<string, readonly string[]>> = nombresJson;

// Las listas de las que sale el nombre cuando la ficha del seguidor no dice nada.
export const LISTAS_NORMALES: readonly string[] = ['hombres', 'mujeres'];

/**
 * Junta en una sola lista los nombres de las listas pedidas (sin poner = las normales).
 * Si alguna lista no existe, avisa con un error que dice cuáles hay.
 */
export function nombresDe(
  idsDeListas: readonly string[] = LISTAS_NORMALES,
  listas: Readonly<Record<string, readonly string[]>> = LISTAS_DE_NOMBRES,
): string[] {
  const nombres: string[] = [];
  for (const id of idsDeListas) {
    const lista = listas[id];
    if (!lista) {
      throw new Error(`No existe la lista de nombres "${id}". Listas disponibles: ${Object.keys(listas).join(', ')}`);
    }
    nombres.push(...lista);
  }
  return nombres;
}
