import type { Almacen } from '../core/guardado/almacen';

// EL ALMACÉN DEL NAVEGADOR (Sprint 8): guarda los textos en el localStorage del navegador,
// que sigue ahí aunque se cierre. Va en store/ y no en core/ porque usa cosas del navegador.
//
// El navegador puede negarse (incógnito, espacio lleno, el jugador ha bloqueado los datos de
// sitios...). Por eso cada botón va dentro de un try/catch: leer devuelve null y escribir
// devuelve false, pero el juego NUNCA se rompe por esto.
//
// Aviso conocido (sección 3.7 del CLAUDE.md): si el jugador borra "cookies y datos de sitios",
// se pierden la partida y la crónica.
export class AlmacenLocal implements Almacen {
  leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  escribir(clave: string, texto: string): boolean {
    try {
      localStorage.setItem(clave, texto);
      return true;
    } catch {
      return false;
    }
  }

  borrar(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch {
      // Si el navegador no deja borrar, no hay nada más que hacer.
    }
  }
}

/**
 * Pide al navegador que NO borre los datos del juego por su cuenta (algunos los borran si
 * falta espacio). Se llamará una vez al arrancar (paso 4). Devuelve true si el navegador
 * acepta y false si no, si no lo admite o si falla: nunca rompe.
 */
export async function pedirGuardadoPersistente(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
