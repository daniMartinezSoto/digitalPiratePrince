import type { Almacen } from './almacen';

// ALMACÉN DE MENTIRA, PARA LOS TESTS (Sprint 8). Guarda los textos en memoria: no toca el
// navegador y se olvida de todo al terminar. Con "fallarAlEscribir" / "fallarAlLeer" se finge
// que el navegador se niega, para comprobar que el juego avisa en vez de romperse.
export class AlmacenEnMemoria implements Almacen {
  private readonly textos = new Map<string, string>();

  /** true = escribir devuelve false y no guarda nada (como un navegador que se niega). */
  fallarAlEscribir = false;

  /** true = leer devuelve null aunque haya algo guardado. */
  fallarAlLeer = false;

  leer(clave: string): string | null {
    if (this.fallarAlLeer) {
      return null;
    }
    return this.textos.get(clave) ?? null;
  }

  escribir(clave: string, texto: string): boolean {
    if (this.fallarAlEscribir) {
      return false;
    }
    this.textos.set(clave, texto);
    return true;
  }

  borrar(clave: string): void {
    this.textos.delete(clave);
  }
}
