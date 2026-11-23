import { effect, inject, Injectable, InjectionToken, signal, untracked } from '@angular/core';
import {
  atacar,
  cerrarCombate,
  huir,
  quedarseConElAtaque,
  usarObjetoEnCombate,
  volverATirar,
  type ResultadoRonda,
} from '../../core/combate/combate';
import type { Dados } from '../../core/dados/dados';
import type { Estado } from '../../core/estado/estado';
import { cerrarCombateDelEvento, eventoEsperaUnCombate, vistaDelEvento } from '../../core/eventos/motor';
import { JuegoStore } from '../../store/juego.store';
import { guionDeRonda, type GuionDeRonda } from '../componentes/ventana-de-combate/guion-de-ronda';
import { lineasSimples } from '../textos/lineas-del-registro';
import { lineasDeRonda, nombresDeLuchadores } from '../textos/textos-de-combate';
import { lecturasDeLaVista, lineasDeEvento } from '../textos/textos-de-eventos';
import { describirCambio, nombreDeEvento, nombreDeObjeto } from '../textos/textos';
import { nombresDeSeguidores } from '../textos/lineas-del-registro';
import type { ResultadoCombate } from '../../core/estado/combate';
import { Jugar } from './jugar';
import { MesaDeTiradas } from './mesa-de-tiradas';

// LUCHAR (Sprint 11, paso 4): los botones del combate normal, en un solo sitio. Los usan la ventana de
// combate (encima del mapa) y el combate de texto de la pestaña Pruebas, así que hacen exactamente lo
// mismo. Cada botón pide la regla (con Jugar: registro incluido), tira los dados de colores sobre el
// mapa y deja la ronda (con su guion) en "ultimaRonda" y en "historial" (para la animación de la ventana).
/**
 * El ritmo de la animación del combate (ms): lo que tardan en caer los dados, el tiempo entre un mensaje
 * y el siguiente y lo que se queda cada mensaje a la vista. Con todo a 0 no hay animación (los tests).
 */
export interface RitmoDelCombate {
  dados: number;
  paso: number;
  mensaje: number;
}
export const RITMO_NORMAL: RitmoDelCombate = { dados: 1500, paso: 900, mensaje: 2600 };
export const SIN_ANIMACION: RitmoDelCombate = { dados: 0, paso: 0, mensaje: 0 };
export const RITMO_DEL_COMBATE = new InjectionToken<RitmoDelCombate>('RITMO_DEL_COMBATE', { providedIn: 'root', factory: () => RITMO_NORMAL });

/** Una ronda ya jugada, para enseñarla: su título, su guion y cómo estaba la partida justo antes. */
export interface RondaJugada {
  numero: number;   // cuenta los botones pulsados (dos rondas iguales seguidas se enseñan las dos)
  titulo: string;
  guion: GuionDeRonda;
  antes: Estado;
}

@Injectable({ providedIn: 'root' })
export class Luchar {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);
  private readonly mesa = inject(MesaDeTiradas);

  private contador = 0;
  /** La última ronda jugada (null = todavía ninguna en este combate). */
  readonly ultimaRonda = signal<RondaJugada | null>(null);
  /** Las rondas de este combate, en orden (para el historial). Se vacía cuando no hay combate. */
  readonly historial = signal<RondaJugada[]>([]);
  /**
   * Lo que ha pasado al cerrar el último combate (lo cobrado y los eventos que saltan), para enseñarlo
   * en una tarjeta sobre el mapa hasta que se pulse "Continuar". null = nada que enseñar. Los combates
   * de un evento no lo usan: lo que pasa después lo cuenta la ventana del evento.
   */
  readonly cierre = signal<{ resultado: ResultadoCombate; lineas: string[] } | null>(null);

  constructor() {
    // Sin combate (se ha cerrado, también el abordaje desde el combate naval), guion e historial se vacían.
    effect(() => {
      const hayCombate = !!this.store.estado()?.mundo.combate;
      if (hayCombate && this.cierre()) untracked(() => this.cierre.set(null)); // empieza otro combate
      if (!hayCombate) {
        untracked(() => {
          this.ultimaRonda.set(null);
          this.historial.set([]);
        });
      }
    });
  }

  atacar(): void {
    this.ronda(`Ronda ${this.rondaSiguiente()}`, (e, d) => atacar(e, d));
  }

  /** El 6: arriesgarse a tirar otra vez. */
  volverATirar(): void {
    this.ronda(`Ronda ${this.rondaSiguiente()}: vuelves a tirar`, (e, d) => volverATirar(e, d));
  }

  /** El 6: quedarse con lo que lleva. */
  quedarse(): void {
    this.ronda(`Ronda ${this.rondaSiguiente()}: te quedas con tu ataque`, (e, d) => quedarseConElAtaque(e, d));
  }

  huir(): void {
    this.ronda('Huir', (e, d) => huir(e, d));
  }

  usar(posicion: number, objeto: string): void {
    this.ronda(`Usar ${nombreDeObjeto(objeto)}`, (e, d) => usarObjetoEnCombate(e, posicion, d));
  }

  /** "Cerrar el combate": cobra las recompensas; si lo lanzó un evento, el evento sigue por donde toque. */
  cerrar(): void {
    const estado = this.store.estado();
    this.mesa.recoger();
    if (estado && eventoEsperaUnCombate(estado)) {
      const evento = vistaDelEvento(estado)?.titulo ?? '';
      this.jugar.hacer(
        (e, d) => cerrarCombateDelEvento(e, d),
        (r, n) => lineasDeEvento(`${evento}: se cierra el combate`, lecturasDeLaVista(vistaDelEvento(r.estado)), r.pendientes, n),
      );
      return;
    }
    const cerrado = this.jugar.hacer(
      (e, d) => cerrarCombate(e, d),
      (r, n) => [
        ...lineasSimples(`Se cierra el combate: ${r.resultado}`, r, n),
        ...r.eventos.map(ev => (ev === 'maldicion' ? '  ¡MALDITO! Evento pendiente: maldicion' : `  Evento pendiente: ${nombreDeEvento(ev)}`)),
      ],
    );
    if (cerrado && !cerrado.estado.mundo.finPartida) {
      const nombres = nombresDeSeguidores(estado, cerrado.estado);
      const pendientes = 'pendientes' in cerrado ? (cerrado.pendientes as string[]) : cerrado.eventos;
      const lineas = [
        ...cerrado.cambios.map(c => describirCambio(c, nombres)),
        ...pendientes.map(ev => (ev === 'maldicion' ? '¡TE HAN MALDECIDO! (evento pendiente: maldición)' : `Evento pendiente: ${nombreDeEvento(ev)}`)),
      ];
      this.cierre.set({ resultado: cerrado.resultado, lineas });
    }
  }

  /** "Continuar" en la tarjeta del cierre. */
  descartarCierre(): void {
    this.cierre.set(null);
  }

  private rondaSiguiente(): number {
    return (this.store.estado()?.mundo.combate?.ronda ?? 0) + 1;
  }

  private ronda(titulo: string, regla: (estado: Estado, dados: Dados) => ResultadoRonda): void {
    const antes = this.store.estado();
    const resultado = this.jugar.hacer(regla, (r, seguidores) => lineasDeRonda(titulo, r, nombresDeLuchadores(antes, r.estado), seguidores));
    if (!antes || !resultado) return;
    const guion = guionDeRonda(antes, resultado, nombresDeLuchadores(antes, resultado.estado));
    const ronda: RondaJugada = { numero: ++this.contador, titulo, guion, antes };
    this.ultimaRonda.set(ronda);
    this.historial.update(h => [...h, ronda]);
    this.tirarDados(antes, guion);
  }

  /**
   * Los dados de la ronda caen sobre el mapa, cada uno de su color: dorado tú, verde tus seguidores,
   * rojo los enemigos. Con un 6 se quedan en la mesa mientras decides; al volver a tirar, tu dado
   * nuevo cae con los demás; al resolverse la ronda, se van.
   */
  private tirarDados(antes: Estado, guion: GuionDeRonda): void {
    const veniaDeUnaPausa = !!antes.mundo.combate?.rondaEnPausa;
    if (guion.dados.length === 0) {
      if (veniaDeUnaPausa) this.mesa.recoger(); // te has quedado así: los dados de la pausa se van
      return;
    }
    const dados = guion.dados.map(d => d.valor);
    this.mesa.ensenar(
      { dados, modificador: 0, total: dados.reduce((a, b) => a + b, 0) },
      { colores: guion.dados.map(d => d.color), sinTotal: true, pequenos: true, seQueda: guion.enPausa, anadir: veniaDeUnaPausa },
    );
  }
}
