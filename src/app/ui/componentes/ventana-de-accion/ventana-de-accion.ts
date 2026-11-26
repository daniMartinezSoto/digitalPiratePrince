import { Component, computed, effect, inject, signal } from '@angular/core';
import { hayEventoEnCurso } from '../../../core/eventos/motor';
import { JuegoStore } from '../../../store/juego.store';
import { CombateNaval } from '../combate-naval/combate-naval';
import { Marineros } from '../marineros/marineros';
import { Mercado } from '../mercado/mercado';
import { MesaDeDados } from '../mesa-de-dados/mesa-de-dados';
import { SeguidorEnEspera } from '../seguidor-en-espera/seguidor-en-espera';

// VENTANA DE ACCIÓN, encima del mapa (decidido por el autor el 26-nov): todo lo que "se presenta"
// se resuelve en una ventana como la de los eventos, no en el panel de la derecha. En el panel se
// quedan solo elegir la acción, el inventario, comer y dormir.
// Aquí salen las acciones a medias (el mercado, los marineros, el seguidor que quiere unirse a ti,
// la mesa de dados) y el combate naval. Las piezas son las de siempre: solo cambia dónde se pintan.

type QueHay = 'mercado' | 'marineros' | 'seguidor' | 'dados' | 'naval';

const TITULO: Record<QueHay, string> = {
  mercado: 'Mercado',
  marineros: 'Marineros en el puerto',
  seguidor: 'Alguien quiere unirse a ti',
  dados: 'Mesa de dados',
  naval: 'Combate naval',
};

// La imagen de cada ventana (ruta dentro de public/), como la de los eventos. Sin ella, no sale nada.
// Para ponerla: deja el dibujo en public/eventos/ y escribe aquí su ruta ("eventos/mercado.png").
const IMAGEN: Partial<Record<QueHay, string>> = {};

@Component({
  selector: 'app-ventana-de-accion',
  imports: [Mercado, Marineros, SeguidorEnEspera, MesaDeDados, CombateNaval],
  templateUrl: './ventana-de-accion.html',
  styleUrl: './ventana-de-accion.css',
})
export class VentanaDeAccion {
  private readonly store = inject(JuegoStore);

  /** Qué hay que resolver ahora en la ventana (null = nada). */
  protected readonly queHay = computed<QueHay | null>(() => {
    const estado = this.store.estado();
    if (!estado || estado.mundo.finPartida) return null;
    // El combate naval sale aunque lo haya lanzado un evento (la ventana del evento espera escondida).
    if (estado.mundo.combateNaval) return 'naval';
    const accion = estado.mundo.accionEnCurso;
    if (!accion || estado.mundo.fase !== 'accion' || hayEventoEnCurso(estado)) return null;
    return accion.tipo;
  });
  protected readonly titulo = computed(() => {
    const que = this.queHay();
    return que ? TITULO[que] : '';
  });
  protected readonly imagen = computed(() => {
    const que = this.queHay();
    return que ? IMAGEN[que] : undefined;
  });

  /** Plegada = escondida un momento para ver el mapa (no se puede hacer nada mientras). */
  protected readonly plegada = signal(false);

  constructor() {
    // Cuando ya no hay nada que resolver, la próxima ventana sale desplegada.
    effect(() => {
      if (!this.queHay()) this.plegada.set(false);
    });
  }
}
