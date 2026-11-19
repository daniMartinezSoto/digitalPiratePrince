import { Injectable, signal } from '@angular/core';

/** Una entrada del registro: el día y las líneas de lo que ha pasado al pulsar un botón. */
export interface EntradaDelRegistro {
  dia: number;
  lineas: string[];
}

// EL REGISTRO DE LA PANTALLA (pantalla de pruebas): la lista de lo que va pasando, lo más nuevo
// arriba. Es solo de la pantalla (no es parte de la partida ni se guarda): al recargar se vacía.
@Injectable({ providedIn: 'root' })
export class Registro {
  private readonly _entradas = signal<EntradaDelRegistro[]>([]);
  readonly entradas = this._entradas.asReadonly();

  apuntar(dia: number, lineas: string[]): void {
    this._entradas.update(entradas => [{ dia, lineas }, ...entradas]);
  }

  vaciar(): void {
    this._entradas.set([]);
  }
}
