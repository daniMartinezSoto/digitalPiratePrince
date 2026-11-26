import { Injectable, signal } from '@angular/core';

// RESULTADO EN VENTANA (pantalla de pruebas; decidido por el autor el 26-nov): lo que ha pasado al
// hacer una acción con tirada o cambios (pescar, cazar, mendigar, el discurso...) sale en una ventana
// encima del mapa y SE VA SOLA (sin "Continuar": demasiados clics). Comer, dormir y el amanecer,
// solo si pasa algo (pasas hambre, duermes genial, te echan de la aldea, actúa una condición).
// Viajar y embarcar, nunca. El registro sigue apuntándolo todo igual.
// Con el ratón encima no se va (para leer con calma); al hacer clic, se va ya.
// Esto no es estado de la partida: al recargar, se pierde.

export interface Resultado {
  // Para buscar su imagen (el id de la acción, "comer", "dormir", "amanecer").
  id: string;
  titulo: string;
  lineas: string[];
}

// Cuánto se queda: lo mismo todas, lo que dura la de pescar (decidido por el autor el 26-nov).
const MILISEGUNDOS = 4000;
// Al quitar el ratón de encima, lo que tarda en irse.
const MILISEGUNDOS_AL_SALIR = 1500;

@Injectable({ providedIn: 'root' })
export class ResultadoEnVentana {
  readonly actual = signal<Resultado | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  ensenar(resultado: Resultado): void {
    this.actual.set(resultado);
    this.irseEn(MILISEGUNDOS);
  }

  cerrar(): void {
    this.parar();
    this.actual.set(null);
  }

  /** Ratón encima: se queda hasta que salga. */
  retener(): void {
    this.parar();
  }

  /** Ratón fuera: se va en un momento. */
  soltar(): void {
    if (this.actual()) this.irseEn(MILISEGUNDOS_AL_SALIR);
  }

  private irseEn(milisegundos: number): void {
    this.parar();
    this.temporizador = setTimeout(() => this.cerrar(), milisegundos);
  }

  private parar(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}
