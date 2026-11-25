import { Component, computed, inject, signal } from '@angular/core';
import { recibirAmuletoMaldito } from '../../../core/amuleto-maldito/recibir-amuleto-maldito';
import { CONDICIONES } from '../../../core/catalogos/cargar-condiciones';
import { OBJETOS } from '../../../core/catalogos/cargar-objetos';
import { TIPOS_SEGUIDOR } from '../../../core/catalogos/cargar-seguidores';
import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import type { Efecto } from '../../../core/tablas/efecto';
import { EVENTOS } from '../../../core/eventos/cargar-eventos';
import { hayEventoEnCurso, lanzarEventos } from '../../../core/eventos/motor';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { TrampasDeEventos } from '../../servicios/trampas-de-eventos';
import { lineasSimples } from '../../textos/lineas-del-registro';

// TRAMPAS DE PRUEBA (solo la pantalla de pruebas, no existirán en el juego): cambian la partida a mano
// para poder probar cosas sin esperar a que pasen (contratar marineros, el hambre, el mercado lleno...).
// Usan aplicarEfectos, así que respetan las mismas reglas que el juego (topes, fin de partida...).
@Component({
  selector: 'app-trampas',
  templateUrl: './trampas.html',
  styleUrl: './trampas.css',
})
export class Trampas {
  private readonly jugar = inject(Jugar);
  private readonly store = inject(JuegoStore);
  /** El número fijado para la próxima tirada de un evento (Sprint 10). */
  protected readonly trampasDeEventos = inject(TrampasDeEventos);

  protected readonly objetos = OBJETOS.map(o => ({ id: o.id, nombre: o.nombre, descripcion: o.descripcion }));
  protected readonly condiciones = CONDICIONES.map(c => ({ id: c.id, nombre: `${c.nombre} (${c.categoria})` }));
  protected readonly seguidores = TIPOS_SEGUIDOR.map(t => ({ id: t.id, nombre: t.nombre }));

  protected readonly objeto = signal(OBJETOS[0]?.id ?? '');
  protected readonly condicion = signal(CONDICIONES[0]?.id ?? '');
  protected readonly seguidor = signal(TIPOS_SEGUIDOR[0]?.id ?? '');

  // --- Trampas de eventos (Sprint 10, paso 6) ---
  /** Todos los eventos programados, por su título. */
  protected readonly eventos = EVENTOS.map(e => ({ id: e.id, nombre: e.libro ? `${e.titulo} (${e.libro})` : e.titulo }));
  protected readonly evento = signal(EVENTOS[0]?.id ?? '');
  /** Lo que se escribe en la casilla de la próxima tirada. */
  protected readonly numeroATrucar = signal('');
  /** Con un evento ya en marcha no se lanza otro (se juega uno detrás de otro, no encima). */
  protected readonly hayEvento = computed(() => {
    const estado = this.store.estado();
    return !!estado && hayEventoEnCurso(estado);
  });

  protected aplicar(titulo: string, efectos: Efecto[]): void {
    this.jugar.hacer((e, d) => aplicarEfectos(e, efectos, d), (r, n) => lineasSimples(`Trampa: ${titulo}`, r, n));
  }

  protected darObjeto(): void {
    this.aplicar('ganar objeto', [{ tipo: 'ganar_objeto', objeto: this.objeto() }]);
  }

  protected ponerCondicion(): void {
    // El amuleto maldito no se pone vacío: como en el juego, se tiran sus dos tablas (una bendición y
    // una maldición) con recibirAmuletoMaldito. Si ya llevas uno, no recibes otro (pedido por el autor, 22-nov).
    if (this.condicion() === 'amuleto_maldito') {
      this.jugar.hacer((e, d) => recibirAmuletoMaldito(e, d), (r, n) => lineasSimples('Trampa: recibir un amuleto maldito', r, n));
      return;
    }
    this.aplicar('poner condición', [{ tipo: 'poner_condicion', condicion: this.condicion() }]);
  }

  protected quitarCondicion(): void {
    this.aplicar('quitar condición', [{ tipo: 'quitar_condicion', condicion: this.condicion() }]);
  }

  protected darSeguidor(): void {
    this.aplicar('ganar seguidor', [{ tipo: 'ganar_seguidor', seguidor: this.seguidor() }]);
  }

  protected lanzarEvento(): void {
    const id = this.evento();
    const nombre = this.eventos.find(e => e.id === id)?.nombre ?? id;
    this.jugar.hacer((e, d) => lanzarEventos(e, [id], d), r => [`Trampa: lanzar el evento ${nombre}`, ...r.pendientes.map(p => `  Evento pendiente: ${p}`)]);
  }

  protected fijarProximaTirada(): void {
    const numero = Number(this.numeroATrucar());
    if (!Number.isInteger(numero) || numero < 1) return;
    this.trampasDeEventos.proximaTirada.set(numero);
    this.numeroATrucar.set('');
  }
}
