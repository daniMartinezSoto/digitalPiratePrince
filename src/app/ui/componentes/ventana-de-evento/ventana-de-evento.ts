import { Component, computed, effect, inject, signal } from '@angular/core';
import type { Dados } from '../../../core/dados/dados';
import type { Estado } from '../../../core/estado/estado';
import {
  continuarEvento,
  elegirOpcion,
  empezarCombateDelEvento,
  evitarEvento,
  hacerChequeo,
  seguirConElEvento,
  tirarDadosDelEvento,
  usarAmuletoDelDestino,
  vistaDelEvento,
  type ResultadoMotor,
  type ResultadoPosible,
} from '../../../core/eventos/motor';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { MesaDeTiradas } from '../../servicios/mesa-de-tiradas';
import { TrampasDeEventos } from '../../servicios/trampas-de-eventos';
import { nombresDeSeguidores } from '../../textos/lineas-del-registro';
import { etiquetaDeResultado, lecturasDeLaVista, lineasDeEvento, lineasDeLectura, NOMBRE_DE_CARACTERISTICA, TEXTO_DE_MOTIVO_DE_OPCION, textoDeOpcion } from '../../textos/textos-de-eventos';
import { textoDeMuerte } from '../../textos/textos';
import type { Lectura } from '../../../core/estado/pila-eventos';

// LA VENTANA DE EVENTOS (pantalla de pruebas, Sprint 10, paso 5): sale encima del mapa mientras hay
// un evento en marcha, con el flujo decidido por el autor (CLAUDE.md, sección 8):
//   - título y miga de pan ("Taberna clandestina › Pelea con un borracho");
//   - el texto y lo que ha cambiado; los botones que toquen (opciones, Tirar dados, Hacer el chequeo,
//     Luchar, Continuar; con la mano de mono, Evitar o Seguir; con el amuleto del destino, Elegir);
//   - NO se puede cerrar a mitad; solo plegar un momento para mirar el mapa;
//   - durante el combate se aparta (el combate se juega en la pestaña Acciones);
//   - todo queda en el registro.
// Sin estilos bonitos: la ventana definitiva irá en la interfaz pulida.
@Component({
  selector: 'app-ventana-de-evento',
  templateUrl: './ventana-de-evento.html',
  styleUrl: './ventana-de-evento.css',
})
export class VentanaDeEvento {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);
  private readonly mesa = inject(MesaDeTiradas);
  private readonly trampas = inject(TrampasDeEventos);

  /** Si mueres en un evento, la ventana se queda enseñando por qué hasta pulsar "Ver el final". */
  protected readonly finVisto = signal(false);

  protected readonly vista = computed(() => {
    const estado = this.store.estado();
    if (!estado || (estado.mundo.finPartida && this.finVisto())) return null;
    return vistaDelEvento(estado);
  });
  /** Las líneas de lo que se lee ahora (dados, chequeo, cambios), sin el texto, que sale aparte arriba. */
  protected readonly lineas = computed(() => this.lineasDe(this.vista()?.lectura ?? null));
  /** Lo de los pasos anteriores, que se queda arriba (sin "Continuar"): su texto y sus líneas. */
  protected readonly anteriores = computed(() => (this.vista()?.anteriores ?? []).map(l => ({ texto: l.texto, lineas: this.lineasDe(l) })));
  /** Al morir: por qué (el mensaje del evento o uno general según la causa). */
  protected readonly textoDeMuerte = computed(() => {
    const fin = this.store.estado()?.mundo.finPartida;
    return fin ? (textoDeMuerte(fin) ?? 'Tu aventura termina aquí.') : null;
  });

  private lineasDe(lectura: Lectura | null): string[] {
    if (!lectura) return [];
    const estado = this.store.estado();
    return lineasDeLectura({ ...lectura, texto: undefined }, nombresDeSeguidores(estado, estado));
  }

  /** Plegada = escondida un momento para ver el mapa (no se puede hacer nada mientras). */
  protected readonly plegada = signal(false);
  /** La imagen del evento es más alta que ancha: entonces va a la izquierda, al lado del texto. */
  protected readonly imagenVertical = signal(false);

  protected readonly textoDeMotivo = TEXTO_DE_MOTIVO_DE_OPCION;
  protected readonly textoDeOpcion = textoDeOpcion;

  constructor() {
    // Cuando ya no hay evento, la próxima ventana sale desplegada.
    effect(() => {
      if (!this.vista()?.imagen) this.imagenVertical.set(false);
      if (!this.vista()) this.plegada.set(false);
    });
  }
  protected readonly nombreDeCaracteristica = NOMBRE_DE_CARACTERISTICA;

  /** Al cargar la imagen se mira su forma: vertical, al lado del texto; apaisada, encima. */
  protected alCargarImagen(evento: Event): void {
    const img = evento.target as HTMLImageElement;
    this.imagenVertical.set(img.naturalHeight > img.naturalWidth);
  }

  protected readonly etiqueta = etiquetaDeResultado;

  protected elegir(indice: number, texto: string): void {
    this.boton(`Eliges: «${texto}»`, (e, d) => elegirOpcion(e, indice, d));
  }

  protected tirar(): void {
    // Trampa de prueba: si hay un número fijado para la próxima tirada, sale ese.
    const trucado = this.trampas.gastarProximaTirada();
    if (trucado !== null) {
      this.boton(`Tiras los dados (trampa: sale un ${trucado})`, (e, d) => tirarDadosDelEvento(e, d, { resultadoTrucado: trucado }), true);
      return;
    }
    this.boton('Tiras los dados', (e, d) => tirarDadosDelEvento(e, d), true);
  }

  /** Amuleto del destino: se gasta YA y se pasa a ver los resultados (no hay vuelta atrás). */
  protected usarAmuleto(): void {
    this.boton('Usas el amuleto del destino', (e, d) => usarAmuletoDelDestino(e, d));
  }

  protected elegirResultado(numero: number, resultado: ResultadoPosible): void {
    this.boton(`Eliges con el amuleto del destino: «${etiquetaDeResultado(resultado)}»`, (e, d) => tirarDadosDelEvento(e, d, { resultadoElegido: numero }));
  }

  protected verElFinal(): void {
    this.finVisto.set(true);
  }

  protected chequeo(): void {
    const trucado = this.trampas.gastarProximaTirada();
    if (trucado !== null) {
      this.boton(`Haces el chequeo (trampa: sale un ${trucado})`, (e, d) => hacerChequeo(e, d, { dadoTrucado: trucado }), true);
      return;
    }
    this.boton('Haces el chequeo', (e, d) => hacerChequeo(e, d), true);
  }

  protected luchar(): void {
    this.boton('¡A luchar!', (e, d) => empezarCombateDelEvento(e, d));
  }

  protected continuar(): void {
    this.boton('Continúas', (e, d) => continuarEvento(e, d));
  }

  protected evitar(): void {
    this.boton('Usas la mano de mono: evitas el evento', (e, d) => evitarEvento(e, d));
  }

  protected seguir(): void {
    this.boton('Decides seguir con el evento', (e, d) => seguirConElEvento(e, d));
  }

  /** Pulsa un botón del motor y lo apunta; si ha habido dados, los enseña sobre el mapa. */
  private boton(titulo: string, regla: (estado: Estado, dados: Dados) => ResultadoMotor, conDados = false): void {
    const evento = this.vista()?.titulo ?? '';
    const r = this.jugar.hacer(regla, (resultado, nombres) => {
      return lineasDeEvento(`${evento}: ${titulo}`, lecturasDeLaVista(vistaDelEvento(resultado.estado)), resultado.pendientes, nombres);
    });
    if (!r || !conDados) return;
    // Los dados de lo que acaba de pasar: la primera lectura con dados (la de arriba si se ha seguido sin parar).
    const lectura = lecturasDeLaVista(vistaDelEvento(r.estado)).find(l => l.tirada || l.chequeo);
    if (lectura?.tirada) this.mesa.ensenar(lectura.tirada);
    else if (lectura?.chequeo) this.mesa.ensenar({ dados: [lectura.chequeo.dado], modificador: lectura.chequeo.modificador, total: lectura.chequeo.total });
  }
}
