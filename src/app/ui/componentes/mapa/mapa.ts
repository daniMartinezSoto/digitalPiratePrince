import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import type { Coordenada, Mapa } from '../../../core/mapa/mapa';
import {
  pintarMapa,
  type ControlDelMapa,
  type InfoDeCasilla,
  type MarcasDelMapa,
  type PosicionesEnElMapa,
  type TipoDeBarco,
} from './pintor-del-mapa';

// EL MAPA (Sprint 9): pinta un mapa del juego como el HTML de referencia (docs/ContextoMapa/):
// pergamino, agua animada, iconos, nombres de los puertos y el barco. Solo pinta: no conoce las
// reglas ni cambia la partida. El dibujo en sí está en pintor-del-mapa.ts.
//   modo:           'prueba' (el barco navega libre al tocar el mar) o 'partida' (lo que diga la partida).
//   rejilla:        encender o apagar la rejilla de hexágonos (irá al menú de opciones).
//   marcasDePrueba: enseña las zonas de eventos de barco y la casilla de inicio (solo para probar).
//   barco:          '3d' (el modelo del HTML) o '2d' (el dibujo plano public/barco/Ship.png).
// Solo en modo partida:
//   posiciones:     dónde están el barco y el jugador (jugador null = a bordo; si no, el monigote).
//   destinos:       las casillas a las que se puede viajar ahora (borde rojo discontinuo).
//   embarques:      las casillas donde se puede embarcar o desembarcar ahora (borde amarillo).
//   marcasDelMapa:  casillas bloqueadas (roca) y aldeas ofendidas (X roja).
//   casillaElegida: se ha tocado una de las casillas de "destinos".
//   embarqueElegido: se ha tocado una de las casillas de "embarques".
// Si "mapa" cambia (una casilla con otro rasgo), se vuelve a pintar el pergamino.
@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.html',
  styleUrl: './mapa.css',
})
export class MapaDelJuego {
  readonly mapa = input.required<Mapa>();
  readonly modo = input<'prueba' | 'partida'>('prueba');
  readonly rejilla = input(true);
  readonly marcasDePrueba = input(false);
  readonly barco = input<TipoDeBarco>('3d');
  readonly posiciones = input<PosicionesEnElMapa | null>(null);
  readonly destinos = input<Coordenada[]>([]);
  readonly embarques = input<Coordenada[]>([]);
  readonly marcasDelMapa = input<MarcasDelMapa>({ bloqueadas: [], ofendidas: [] });
  readonly casillaElegida = output<Coordenada>();
  readonly embarqueElegido = output<Coordenada>();

  private readonly lienzoAgua = viewChild.required<ElementRef<HTMLCanvasElement>>('agua');
  private readonly lienzoTinta = viewChild.required<ElementRef<HTMLCanvasElement>>('tinta');
  private readonly lienzoBarco = viewChild.required<ElementRef<HTMLCanvasElement>>('barco');

  protected readonly info = signal<InfoDeCasilla>({ titulo: '', detalles: ['Desplegando el pergamino…'] });
  private control: ControlDelMapa | null = null;

  constructor() {
    afterNextRender(() => {
      // Sin WebGL (un navegador muy viejo, o los tests, que no tienen pantalla) no se intenta dibujar.
      if (typeof WebGLRenderingContext === 'undefined') {
        this.info.set({ titulo: '', detalles: ['Tu navegador no puede dibujar el mapa'] });
        return;
      }
      const control = pintarMapa(
        { agua: this.lienzoAgua().nativeElement, tinta: this.lienzoTinta().nativeElement, barco: this.lienzoBarco().nativeElement },
        this.mapa(),
        {
          modo: this.modo(),
          rejilla: this.rejilla(),
          marcasDePrueba: this.marcasDePrueba(),
          barco: this.barco(),
          posiciones: this.posiciones() ?? undefined,
          rutaIconos: 'iconosMapa/',
          rutaModeloBarco: 'barco/barco.glb',
          rutaTexturaBarco: 'barco/barco_textura.png',
          rutaBarco2D: 'barco/Ship.png',
          alInformar: info => this.info.set(info),
          alElegirCasilla: casilla => this.casillaElegida.emit(casilla),
          alElegirEmbarque: casilla => this.embarqueElegido.emit(casilla),
        },
      );
      control.cambiarDestinos(this.destinos());
      control.cambiarEmbarques(this.embarques());
      control.cambiarMarcasDelMapa(this.marcasDelMapa());
      this.control = control;
    });
    // OJO: leer la señal ANTES del "?.": si control aún no existe, "?." se salta también los
    // argumentos, el effect no sabría que depende de la señal y no volvería a ejecutarse nunca.
    effect(() => {
      const rejilla = this.rejilla();
      this.control?.cambiarRejilla(rejilla);
    });
    effect(() => {
      const marcas = this.marcasDePrueba();
      this.control?.cambiarMarcasDePrueba(marcas);
    });
    effect(() => {
      const barco = this.barco();
      this.control?.cambiarBarco(barco);
    });
    effect(() => {
      const posiciones = this.posiciones();
      if (posiciones) this.control?.colocar(posiciones);
    });
    effect(() => {
      const destinos = this.destinos();
      this.control?.cambiarDestinos(destinos);
    });
    effect(() => {
      const embarques = this.embarques();
      this.control?.cambiarEmbarques(embarques);
    });
    effect(() => {
      const marcas = this.marcasDelMapa();
      this.control?.cambiarMarcasDelMapa(marcas);
    });
    effect(() => {
      const mapa = this.mapa();
      this.control?.cambiarMapa(mapa);
    });
    inject(DestroyRef).onDestroy(() => this.control?.destruir());
  }

  protected acercar(): void {
    this.control?.acercar();
  }

  protected alejar(): void {
    this.control?.alejar();
  }

  protected centrar(): void {
    this.control?.centrar();
  }
}
