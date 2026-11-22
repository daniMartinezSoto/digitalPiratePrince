import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DadosEnElMapa } from '../../componentes/dados-en-el-mapa/dados-en-el-mapa';
import { MesaDeTiradas } from '../../servicios/mesa-de-tiradas';
import { hojaDePersonaje } from '../../../core/personaje/hoja-de-personaje';
import { JuegoStore, type AvisoDeGuardado } from '../../../store/juego.store';
import { DondeEstas } from '../../componentes/donde-estas/donde-estas';
import { HojaPersonaje } from '../../componentes/hoja-personaje/hoja-personaje';
import { PanelDelDia } from '../../componentes/panel-del-dia/panel-del-dia';
import { RegistroDeLaPartida } from '../../componentes/registro/registro';
import { Trampas } from '../../componentes/trampas/trampas';
import { Combate } from '../../componentes/combate/combate';
import { CombateDePrueba } from '../../componentes/combate-de-prueba/combate-de-prueba';
import { CombateNaval } from '../../componentes/combate-naval/combate-naval';
import { Objetos } from '../../componentes/objetos/objetos';
import { NOMBRE_DE_FASE, textoDeFin } from '../../textos/textos';
import { progresoDePuertos } from '../../../core/viaje/puertos-principales';
import { famaObjetivoActual } from '../../../core/condiciones/consultas';
import { hayCombate } from '../../../core/combate/hay-combate';
import { vasABordo } from '../../../core/mapa/donde-estas';
import type { Coordenada } from '../../../core/mapa/mapa';
import { casillasMarcadas, mapaActual } from '../../../core/mapa/sitio-actual';
import { condicionesQueImpidenViajar, destinosDeViaje } from '../../../core/viaje/viajar';
import { casillasDeEmbarque } from '../../../core/viaje/embarcar';
import { MapaDelJuego } from '../../componentes/mapa/mapa';
import { Navegar } from '../../servicios/navegar';
import { VentanaDeEvento } from '../../componentes/ventana-de-evento/ventana-de-evento';
import { hayEventoEnCurso } from '../../../core/eventos/motor';

type Pestana = 'acciones' | 'personaje' | 'registro' | 'pruebas';

const TEXTO_DE_AVISO: Record<AvisoDeGuardado, string> = {
  no_se_pudo_guardar: 'No se ha podido guardar la partida (¿modo incógnito o sin espacio?).',
  partida_no_recuperada: 'No se ha podido recuperar tu partida guardada.',
  cronica_estropeada: 'La crónica estaba estropeada: se ha guardado una copia aparte.',
};

// PANTALLA DE LA PARTIDA (pantalla de pruebas; colocada el 21-nov: barra arriba, mapa a la izquierda y
// panel con pestañas a la derecha, sin scroll general): junta el "¿dónde estás?", el panel del día, el
// registro y la hoja del personaje, más los avisos del guardado y el botón Abandonar (con confirmación). Si la partida ha
// terminado, lo dice y ofrece empezar otra. Todo lo que cambia la partida se pide al store.
@Component({
  selector: 'app-pantalla-partida',
  imports: [HojaPersonaje, DondeEstas, PanelDelDia, RegistroDeLaPartida, Trampas, Combate, CombateDePrueba, CombateNaval, Objetos, MapaDelJuego, DadosEnElMapa, VentanaDeEvento],
  host: { '[class.panel-plegado]': 'panelPlegado()' },
  templateUrl: './partida.html',
  styleUrl: './partida.css',
})
export class PantallaPartida {
  private readonly store = inject(JuegoStore);
  private readonly router = inject(Router);
  /** La mesa de tiradas: los dados que caen sobre el mapa y su sonido. */
  protected readonly mesa = inject(MesaDeTiradas);

  protected readonly estado = this.store.estado;
  protected readonly hoja = computed(() => {
    const estado = this.store.estado();
    return estado ? hojaDePersonaje(estado.jugador) : null;
  });
  protected readonly avisos = computed(() => this.store.avisos().map(aviso => TEXTO_DE_AVISO[aviso]));
  protected readonly confirmandoAbandono = signal(false);
  protected readonly nombreDeFase = NOMBRE_DE_FASE;
  protected readonly textoDeFin = textoDeFin;
  /** "Puertos 1/4": los 4 puertos principales y cuáles se han visitado. */
  protected readonly puertos = computed(() => {
    const estado = this.store.estado();
    return estado ? progresoDePuertos(estado) : null;
  });
  protected readonly famaObjetivo = computed(() => {
    const estado = this.store.estado();
    return estado ? famaObjetivoActual(estado.jugador) : 0;
  });

  // --- El mapa (Sprint 9, paso 8) ---
  private readonly navegar = inject(Navegar);
  /** El mapa tal como está ahora (con las casillas cambiadas por los eventos). */
  protected readonly mapa = computed(() => {
    const estado = this.store.estado();
    return estado ? mapaActual(estado) : null;
  });
  /** El retrato del personaje (hombre o mujer): decide el dibujo del monigote. */
  protected readonly retrato = computed(() => this.store.estado()?.jugador.retrato ?? 'hombre');
  /** El barco y, si vas a pie, el monigote. */
  protected readonly posiciones = computed(() => {
    const estado = this.store.estado();
    if (!estado) return null;
    return { barco: estado.mundo.posicionBarco, jugador: vasABordo(estado) ? null : estado.mundo.posicion };
  });
  /**
   * Las casillas a las que se puede viajar, SOLO después de pulsar "Viajar…" (decidido por el autor el
   * 21-nov) y cuando toca elegir la acción y nada lo impide.
   */
  protected readonly destinos = computed((): Coordenada[] => {
    const estado = this.store.estado();
    const sePuede =
      this.navegar.eligiendoViaje() &&
      estado &&
      !estado.mundo.finPartida &&
      estado.mundo.fase === 'accion' &&
      !estado.mundo.accionEnCurso &&
      !hayCombate(estado) &&
      !hayEventoEnCurso(estado) &&
      condicionesQueImpidenViajar(estado).length === 0;
    return sePuede ? destinosDeViaje(estado) : [];
  });
  /** Las casillas donde se puede subir o bajar del barco ahora (en amarillo), mientras no se elige viaje. */
  protected readonly embarques = computed((): Coordenada[] => {
    const estado = this.store.estado();
    return estado && !this.navegar.eligiendoViaje() ? casillasDeEmbarque(estado) : [];
  });
  protected readonly marcasDelMapa = computed(() => {
    const estado = this.store.estado();
    return estado ? casillasMarcadas(estado) : { bloqueadas: [], ofendidas: [] };
  });
  /** Barco 3D o 2D (de momento se puede cambiar para probar). */
  protected readonly tipoDeBarco = signal<'3d' | '2d'>('2d');
  /** La cuadrícula de hexágonos del mapa, encendida o apagada (irá al menú de opciones). */
  protected readonly cuadricula = signal(false);

  // --- Las pestañas del panel de la derecha ---
  protected readonly pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'acciones', nombre: 'Acciones' },
    { id: 'personaje', nombre: 'Personaje' },
    { id: 'registro', nombre: 'Registro' },
    { id: 'pruebas', nombre: 'Pruebas' },
  ];
  protected readonly pestana = signal<Pestana>('acciones');
  /** El panel de la derecha plegado: el mapa ocupa todo el ancho (pedido por el autor el 22-nov). */
  protected readonly panelPlegado = signal(false);
  /** ¿Hay un evento en marcha? (Entonces la ventana de eventos manda y lo demás espera.) */
  protected readonly hayEvento = computed(() => {
    const estado = this.store.estado();
    return !!estado && hayEventoEnCurso(estado);
  });
  private readonly hayCombateAhora = computed(() => {
    const estado = this.store.estado();
    return !!estado && hayCombate(estado);
  });

  constructor() {
    // Al empezar un combate (o al terminar la partida) se vuelve a Acciones, que es donde se ve.
    effect(() => {
      // Y el panel se despliega solo, porque el combate y el final se ven en él.
      if (this.hayCombateAhora() || this.store.estado()?.mundo.finPartida) {
        this.pestana.set('acciones');
        this.panelPlegado.set(false);
      }
    });
  }

  protected viajarA(casilla: Coordenada): void {
    this.navegar.viajar(casilla);
  }

  protected embarcarODesembarcar(casilla: Coordenada): void {
    this.navegar.embarcarODesembarcar(casilla);
  }

  protected abandonar(): void {
    this.store.abandonar();
    this.confirmandoAbandono.set(false);
  }

  protected nuevaPartida(): void {
    void this.router.navigate(['/nueva-partida']);
  }

  protected descartarAvisos(): void {
    this.store.descartarAvisos();
  }

  /** Las condiciones de la barra: todas menos las que solo llevan otras dentro (el amuleto: salen sus partes). */
  protected condicionesDeLaBarra<C extends { tienePartes: boolean }>(condiciones: C[]): C[] {
    return condiciones.filter(c => !c.tienePartes);
  }

  /** Lo que sale al pasar el ratón: "Hedor nauseabundo: No puedes tener más seguidores (Amuleto maldito)". */
  protected tituloDeCondicion(c: { nombre: string; descripcion: string; dentroDe?: string }): string {
    return `${c.nombre}: ${c.descripcion}${c.dentroDe ? ` (${c.dentroDe})` : ''}`;
  }
}
