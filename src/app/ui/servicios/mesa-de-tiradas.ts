import { Injectable, signal } from '@angular/core';
import type { IdAccion } from '../../core/acciones/accion';

// LA MESA DE TIRADAS (pedido por el autor el 21-nov): las tiradas PÚBLICAS se enseñan con dados que
// caen encima del mapa; las demás van por detrás. Los dados NO deciden nada: enseñan los números que
// ya ha sacado el juego (con los dados de la semilla).
// Criterio: con dados, lo que en el libro es "tira 1d6 / 2d6 / 3d6" (tablas de acciones, chequeos,
// ataques, tiradas de eventos); por detrás, los sorteos internos (si salta un evento, cuál, nombres...).

/** Las acciones cuya tirada se enseña con dados (de momento, solo para probar: pescar y cazar). */
export const ACCIONES_CON_DADOS: ReadonlySet<IdAccion> = new Set<IdAccion>(['pescar', 'cazar']);

/** Una tirada para enseñar: lo que ha salido en cada dado, el bonificador y el total. */
export interface TiradaEnLaMesa {
  /** Cuenta las tiradas: así dos tiradas seguidas con los mismos números se enseñan las dos. */
  numero: number;
  dados: number[];
  modificador: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class MesaDeTiradas {
  private contador = 0;
  /** La última tirada que hay que enseñar (null = ninguna todavía). */
  readonly tirada = signal<TiradaEnLaMesa | null>(null);
  /** El sonido de los dados al chocar (se puede apagar debajo del mapa). */
  readonly sonido = signal(true);

  ensenar(tirada: { dados: number[]; modificador: number; total: number }): void {
    this.tirada.set({ numero: ++this.contador, dados: [...tirada.dados], modificador: tirada.modificador, total: tirada.total });
  }
}
