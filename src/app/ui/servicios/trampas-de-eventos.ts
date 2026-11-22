import { Injectable, signal } from '@angular/core';

// TRAMPAS DE EVENTOS (solo la pantalla de pruebas, Sprint 10, paso 6). Recuerda el número que se ha
// fijado para la PRÓXIMA tirada de un evento ("Tirar dados" o "Hacer el chequeo"): la ventana de
// eventos lo usa una vez y lo borra. Es solo de la pantalla: no se guarda en la partida (al recargar
// se olvida), porque las trampas no existirán en el juego.
@Injectable({ providedIn: 'root' })
export class TrampasDeEventos {
  /** El número fijado para la próxima tirada de un evento (null = ninguno: los dados mandan). */
  readonly proximaTirada = signal<number | null>(null);

  /** Lo usa la ventana al tirar: devuelve el número fijado (si lo hay) y lo borra. */
  gastarProximaTirada(): number | null {
    const numero = this.proximaTirada();
    this.proximaTirada.set(null);
    return numero;
  }
}
