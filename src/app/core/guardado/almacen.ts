// EL ALMACÉN (Sprint 8): el "cajón" donde se deja la partida (y la crónica) convertida en texto,
// para que siga ahí al cerrar el navegador.
//
// El juego (el store) solo usa estos tres botones y no sabe qué cajón hay detrás:
//   - AlmacenLocal (store/almacen-local.ts): el del navegador (localStorage). El que se usa al jugar.
//   - AlmacenEnMemoria (almacen-en-memoria.ts): uno de mentira para los tests.
//   - Algún día, uno en la nube (con un servidor y su base de datos). Como guardar por internet
//     tarda, ese día los botones pasarán a "esperar la respuesta" (async) y el store con ellos.
//
// Regla: el almacén NUNCA rompe el juego. Si el navegador se niega (incógnito, lleno...),
// leer devuelve null y escribir devuelve false, y el store decide si avisa.
export interface Almacen {
  /** El texto guardado con ese nombre, o null si no hay nada (o no se ha podido leer). */
  leer(clave: string): string | null;

  /** Guarda el texto con ese nombre (sustituye al anterior). true = guardado; false = el navegador se ha negado. */
  escribir(clave: string, texto: string): boolean;

  /** Tira el texto de ese nombre (si no había nada, no pasa nada). */
  borrar(clave: string): void;
}

// Los nombres de lo que se guarda, en un solo sitio. El prefijo evita mezclarse con otras
// cosas que guarde la misma web.
export const CLAVES_DE_GUARDADO = {
  partida: 'pirate-prince.partida',
  cronica: 'pirate-prince.cronica',
} as const;
