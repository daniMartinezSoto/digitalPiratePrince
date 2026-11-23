import { Injectable, signal } from '@angular/core';
import type { IdAccion } from '../../core/acciones/accion';

// LA MESA DE TIRADAS (pedido por el autor el 21-nov): las tiradas PÚBLICAS se enseñan con dados que
// caen encima del mapa; las demás van por detrás. Los dados NO deciden nada: enseñan los números que
// ya ha sacado el juego (con los dados de la semilla).
// Criterio: con dados, lo que en el libro es "tira 1d6 / 2d6 / 3d6" (tablas de acciones, chequeos,
// ataques, tiradas de eventos); por detrás, los sorteos internos (si salta un evento, cuál, nombres...).

/** Las acciones cuya tirada se enseña con dados (de momento, solo para probar: pescar y cazar). */
export const ACCIONES_CON_DADOS: ReadonlySet<IdAccion> = new Set<IdAccion>(['pescar', 'cazar']);

/** El color de un dado: hueso (el de siempre) o, en combate, dorado (tú), verde (tus seguidores) o rojo (enemigos). */
export type ColorDeDadoEnLaMesa = 'hueso' | 'dorado' | 'verde' | 'rojo';

/**
 * Cómo se enseña una tirada (Sprint 11, para el combate; sin poner nada, como siempre):
 *   colores: el color de cada dado, en el mismo orden que los dados (sin poner = todos de hueso).
 *   sinTotal: no sale el cartel con la suma ("4 + 3 = 7"): en combate cada dado es de alguien.
 *   seQueda: los dados no se desvanecen solos; se quedan hasta que alguien llame a recoger()
 *            (la ronda en pausa por un 6: los dados siguen a la vista mientras decides).
 *   anadir: no quita los dados que hay; los nuevos caen en un hueco libre (tu dado al volver a tirar).
 *   pequenos: dados más pequeños (en combate caen muchos a la vez).
 */
export interface OpcionesDeTirada {
  colores?: ColorDeDadoEnLaMesa[];
  sinTotal?: boolean;
  seQueda?: boolean;
  anadir?: boolean;
  pequenos?: boolean;
}

/** Una tirada para enseñar: lo que ha salido en cada dado, el bonificador y el total. */
export interface TiradaEnLaMesa extends OpcionesDeTirada {
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

  /** Cuenta las veces que se ha pedido recoger los dados que se habían quedado en la mesa. */
  readonly recogida = signal(0);

  ensenar(tirada: { dados: number[]; modificador: number; total: number }, opciones: OpcionesDeTirada = {}): void {
    if (opciones.colores && opciones.colores.length !== tirada.dados.length) {
      throw new Error('MesaDeTiradas: hace falta un color por dado');
    }
    this.tirada.set({
      ...opciones,
      ...(opciones.colores ? { colores: [...opciones.colores] } : {}),
      numero: ++this.contador,
      dados: [...tirada.dados],
      modificador: tirada.modificador,
      total: tirada.total,
    });
  }

  /** Recoge (desvanece) los dados que se habían quedado en la mesa con "seQueda". */
  recoger(): void {
    this.recogida.update(n => n + 1);
  }
}
