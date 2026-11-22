import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { Dados } from '../core/dados/dados';
import type { Estado } from '../core/estado/estado';
import type { Almacen } from '../core/guardado/almacen';
import { CLAVES_DE_GUARDADO } from '../core/guardado/almacen';
import { anadirACronica, crearEntradaCronica, guardarCronica, leerCronica, type EntradaCronica } from '../core/guardado/cronica';
import { guardarPartida } from '../core/guardado/guardar-partida';
import { dadosDePartida, leerPartida } from '../core/guardado/leer-partida';
import { abandonarPartida } from '../core/partida/abandonar-partida';
import { conSusEventos } from '../core/eventos/con-sus-eventos';
import { crearPartida } from '../core/partida/crear-partida';
import { esSemillaValida, SEMILLA_MAXIMA } from '../core/partida/semilla';
import type { Retrato } from '../core/personaje/retrato';
import { AlmacenLocal, pedirGuardadoPersistente } from './almacen-local';

// EL STORE DEL JUEGO (Sprint 8): el que lleva la partida en curso, como la persona sentada a
// la mesa con la hoja de personaje y los dados.
//   - Tiene la hoja (el estado, en un signal) y los dados (aparte: no son estado).
//   - TODO lo que cambia la partida pasa por aquí (sección 3.3 del CLAUDE.md): le pasa la hoja a
//     las reglas (core/), recibe la nueva y, EN ESE MISMO INSTANTE, la mete en el almacén.
//   - Al abrir el juego, saca la partida del almacén y sigue donde estaba.
//   - Al terminar la partida (ganar, morir o abandonar), apunta la ficha en la crónica y tira
//     la partida del almacén. La hoja final se queda a la vista para la pantalla de resultados.

// Piezas que se pueden cambiar (los tests ponen otras):
/** Dónde se guarda. Al jugar, el localStorage del navegador. */
export const ALMACEN = new InjectionToken<Almacen>('ALMACEN', {
  providedIn: 'root',
  factory: () => new AlmacenLocal(),
});
/** La fecha de ahora, en texto ISO (para la crónica). */
export const RELOJ = new InjectionToken<() => string>('RELOJ', {
  providedIn: 'root',
  factory: () => () => new Date().toISOString(),
});
/** Saca una semilla al azar de 6 cifras cuando el jugador no elige una. */
export const GENERAR_SEMILLA = new InjectionToken<() => number>('GENERAR_SEMILLA', {
  providedIn: 'root',
  factory: () => semillaAlAzar,
});

/**
 * Avisos para la pantalla (no rompen el juego):
 *   no_se_pudo_guardar:    el navegador se ha negado a guardar (incógnito, lleno...).
 *   partida_no_recuperada: había una partida guardada pero no se ha podido leer (estropeada o de
 *                          una versión más nueva). Se ha guardado una copia de seguridad.
 *   cronica_estropeada:    la crónica (o alguna ficha) no se ha podido leer. Copia de seguridad hecha.
 */
export type AvisoDeGuardado = 'no_se_pudo_guardar' | 'partida_no_recuperada' | 'cronica_estropeada';

@Injectable({ providedIn: 'root' })
export class JuegoStore {
  private readonly almacen = inject(ALMACEN);
  private readonly reloj = inject(RELOJ);
  private readonly generarSemilla = inject(GENERAR_SEMILLA);

  /** Los dados de la partida en curso (null si no hay). No son estado: se recuperan de mundo.estadoDados. */
  private dados: Dados | null = null;

  /** true = la crónica guardada no se pudo leer NI copiar a la copia de seguridad: no se escribe encima. */
  private cronicaBloqueada = false;

  private readonly _estado = signal<Estado | null>(null);
  private readonly _cronica = signal<EntradaCronica[]>([]);
  private readonly _avisos = signal<AvisoDeGuardado[]>([]);

  /** La hoja de la partida (null = no hay ninguna). Si ha terminado, la hoja final. Solo lectura. */
  readonly estado = this._estado.asReadonly();
  /** La crónica, ya ordenada. */
  readonly cronica = this._cronica.asReadonly();
  /** Avisos pendientes para la pantalla. */
  readonly avisos = this._avisos.asReadonly();
  /** true = hay una partida que se puede seguir jugando. */
  readonly hayPartidaEnCurso = computed(() => {
    const estado = this._estado();
    return estado !== null && estado.mundo.finPartida === null;
  });

  constructor() {
    void pedirGuardadoPersistente();
    this.cargarCronica();
    this.cargarPartida();
  }

  // -------------------------------------------------------------------------
  // Lo que puede hacer el jugador
  // -------------------------------------------------------------------------

  /**
   * Empieza una partida nueva. Sin semilla, se saca una al azar de 6 cifras.
   * Da error si hay una partida en curso (hay que abandonarla antes) o si la semilla no vale.
   * Los eventos del principio (el "deseo" del amuleto de "el maldito") entran en la pila del motor;
   * devuelve los que aún no están programados (para apuntarlos como pendientes).
   */
  nuevaPartida(nombre: string, retrato: Retrato = 'hombre', semilla?: number): string[] {
    if (this.hayPartidaEnCurso()) {
      throw new Error('nuevaPartida: ya hay una partida en curso; primero hay que abandonarla');
    }
    const semillaElegida = semilla ?? this.generarSemilla();
    if (!esSemillaValida(semillaElegida)) {
      throw new Error(`nuevaPartida: la semilla debe ser un número entero de 0 a ${SEMILLA_MAXIMA}`);
    }
    const partida = crearPartida(semillaElegida, nombre, retrato);
    // Los eventos del principio (el deseo del amuleto maldito) entran ya en la pila del motor.
    const conEventos = conSusEventos(partida, partida.dados);
    this.dados = partida.dados;
    this.cambiarEstado({ ...conEventos.estado, mundo: { ...conEventos.estado.mundo, estadoDados: partida.dados.obtenerEstado() } });
    return conEventos.pendientes;
  }

  /**
   * LA PUERTA DE TODAS LAS ACCIONES. Se le pasa una función de las reglas que recibe la hoja y los
   * dados y devuelve un resultado con la hoja nueva. Ejemplo:
   *   store.ejecutar((estado, dados) => pescar(estado, { lugar: 'barco' }, dados))
   * Guarda la hoja nueva en el acto y devuelve el resultado completo (cambios, tiradas...) para
   * enseñarlo. Si la regla da error, la partida se queda como estaba (y los dados también).
   */
  ejecutar<R extends { estado: Estado }>(accion: (estado: Estado, dados: Dados) => R): R {
    const estado = this._estado();
    if (!estado || !this.dados || estado.mundo.finPartida) {
      throw new Error('ejecutar: no hay ninguna partida en curso');
    }
    let resultado: R;
    try {
      resultado = accion(estado, this.dados);
    } catch (error) {
      // La regla pudo gastar dados antes de fallar: se vuelven a poner donde estaban.
      this.dados = dadosDePartida(estado);
      throw error;
    }
    // El store se asegura de que la hoja apunta dónde van los dados (para que, al volver,
    // salgan los mismos números), aunque alguna regla se olvidara de apuntarlo.
    const nuevo: Estado = {
      ...resultado.estado,
      mundo: { ...resultado.estado.mundo, estadoDados: this.dados.obtenerEstado() },
    };
    this.cambiarEstado(nuevo);
    return { ...resultado, estado: nuevo };
  }

  /** El jugador se rinde: derrota por "abandono", ficha a la crónica y partida borrada. */
  abandonar(): void {
    const estado = this._estado();
    if (!estado || estado.mundo.finPartida) {
      throw new Error('abandonar: no hay ninguna partida en curso');
    }
    this.cambiarEstado(abandonarPartida(estado));
  }

  /** La pantalla ya ha enseñado los avisos: se borran. */
  descartarAvisos(): void {
    this._avisos.set([]);
  }

  // -------------------------------------------------------------------------
  // Por dentro
  // -------------------------------------------------------------------------

  /** EL ÚNICO SITIO que cambia la hoja: la pone en el signal y la guarda (o cierra la partida). */
  private cambiarEstado(nuevo: Estado): void {
    this._estado.set(nuevo);
    if (nuevo.mundo.finPartida) {
      this.cerrarPartida(nuevo);
    } else if (!this.almacen.escribir(CLAVES_DE_GUARDADO.partida, guardarPartida(nuevo))) {
      this.avisar('no_se_pudo_guardar');
    }
  }

  /** La partida ha terminado: ficha a la crónica y partida fuera del almacén. */
  private cerrarPartida(estado: Estado): void {
    this.dados = null;
    const cronica = anadirACronica(this._cronica(), crearEntradaCronica(estado, this.reloj()));
    this._cronica.set(cronica);
    if (this.cronicaBloqueada || !this.almacen.escribir(CLAVES_DE_GUARDADO.cronica, guardarCronica(cronica))) {
      this.avisar('no_se_pudo_guardar');
    }
    this.almacen.borrar(CLAVES_DE_GUARDADO.partida);
  }

  private cargarCronica(): void {
    const texto = this.almacen.leer(CLAVES_DE_GUARDADO.cronica);
    if (texto === null) {
      return; // todavía no hay crónica
    }
    const leida = leerCronica(texto);
    if (!leida.ok || leida.descartadas > 0) {
      // No escribir encima sin más: primero, una copia de seguridad del texto original.
      // Si ni la copia se puede hacer, no se toca la crónica guardada en toda la sesión.
      this.cronicaBloqueada = !this.almacen.escribir(CLAVES_DE_GUARDADO.cronicaEstropeada, texto);
      this.avisar('cronica_estropeada');
    }
    this._cronica.set(leida.ok ? leida.entradas : []);
  }

  private cargarPartida(): void {
    const texto = this.almacen.leer(CLAVES_DE_GUARDADO.partida);
    if (texto === null) {
      return; // no hay partida guardada
    }
    const leida = leerPartida(texto);
    if (!leida.ok) {
      // Copia de seguridad y fuera (solo si la copia se ha podido hacer: si no, se deja donde está).
      if (this.almacen.escribir(CLAVES_DE_GUARDADO.partidaEstropeada, texto)) {
        this.almacen.borrar(CLAVES_DE_GUARDADO.partida);
      }
      this.avisar('partida_no_recuperada');
      return;
    }
    if (leida.estado.mundo.finPartida) {
      // Terminada pero sin cerrar (no debería pasar): se cierra ahora.
      this._estado.set(leida.estado);
      this.cerrarPartida(leida.estado);
      return;
    }
    this.dados = dadosDePartida(leida.estado);
    this._estado.set(leida.estado);
  }

  private avisar(aviso: AvisoDeGuardado): void {
    if (!this._avisos().includes(aviso)) {
      this._avisos.update(avisos => [...avisos, aviso]);
    }
  }
}

/**
 * Una semilla al azar de 0 a 999.999. Es el ÚNICO sitio del juego que usa el azar del navegador:
 * la semilla no es una tirada, es el punto de partida de los dados (todo lo demás sale de ella).
 */
export function semillaAlAzar(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0] % (SEMILLA_MAXIMA + 1);
  }
  return Math.floor(Math.random() * (SEMILLA_MAXIMA + 1));
}
