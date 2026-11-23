import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { aliadosQueLuchan, ID_JUGADOR, opcionesDeCombate, vistaPreviaDeLaRonda } from '../../../core/combate/combate';
import { eventoEsperaUnCombate } from '../../../core/eventos/motor';
import { ENEMIGOS } from '../../../core/catalogos/cargar-enemigos';
import { TIPOS_SEGUIDOR } from '../../../core/catalogos/cargar-seguidores';
import { vidaMaxActual } from '../../../core/condiciones/consultas';
import type { Estado } from '../../../core/estado/estado';
import { JuegoStore } from '../../../store/juego.store';
import { Luchar, RITMO_DEL_COMBATE, type RondaJugada } from '../../servicios/luchar';
import type { AnimacionDeCarta, PasoDelGuion } from './guion-de-ronda';
import { NOMBRE_DE_HABILIDAD_DE_ENEMIGO, TEXTO_NO_HUIR, TEXTO_NO_USAR_OBJETO } from '../../textos/textos-de-combate';
import { nombreDeObjeto } from '../../textos/textos';

// LA VENTANA DE COMBATE (Sprint 11, paso 4): el combate normal, encima del mapa (como la ventana de
// eventos, pero más grande). Tu bando a la izquierda y los enemigos a la derecha, cada uno en una
// carta con su dibujo, su barra de vida y lo que sabe hacer; debajo de cada carta, a quién ataca.
// Con un 6 en la mesa, todas las barras enseñan en translúcido lo que van a perder y salen los dos
// botones del 6. Los botones son los del servicio Luchar (los mismos del combate de texto).
// El abordaje de un combate naval no sale aquí: se sigue jugando en el panel del combate naval.
//
// LA ANIMACIÓN (paso 5): al pulsar un botón, la partida ya ha cambiado del todo, pero la ventana lo
// enseña poco a poco con el guion de la ronda (servicio Luchar): mientras caen los dados se ven las
// cartas como estaban ANTES; después sale cada mensaje encima de su carta (o en el centro), las barras
// bajan con él y la carta hace su gesto (el que ataca avanza, el golpeado se sacude en rojo, el que cae
// se apaga...). Los mensajes se quedan unos segundos y se van. Mientras dura, los botones esperan;
// "Rápido" salta al final. El historial desplegable deja repasar todas las rondas del combate.

/** Lo que enseña una carta. */
export interface CartaDeCombate {
  id: string;
  nombre: string;
  vida: number;
  maximo: number;
  ataque: number | null;          // null = el jugador (su ataque es su dado)
  detalles: string[];             // habilidades, categoría...
  imagen: string;                 // el dibujo: el de su ficha o, si no tiene, una silueta (paso 7)
  silueta: boolean;               // true = es una silueta de reserva (no un dibujo de verdad)
  inicial: string;
  caido: boolean;
  atacaA: string | null;          // el nombre de su rival
  rival: string | null;           // el id de su rival (para la línea)
  perdera: number;                // con un 6 en la mesa, lo que va a perder (0 si nada)
  esJugador: boolean;
}

/**
 * Siluetas de reserva (paso 7, hechas por Claude, en public/combate/): una por categoría de enemigo y
 * otra para los seguidores. Si la ficha del bestiario o del seguidor tiene "imagen", manda esa.
 */
export const SILUETAS = {
  humano: 'combate/humano.svg',
  animal: 'combate/animal.svg',
  no_muerto: 'combate/no_muerto.svg',
  criatura: 'combate/criatura.svg',
  seguidor: 'combate/seguidor.svg',
} as const;

/** Una línea de quién ataca a quién, ya medida sobre la pantalla (un trazo SVG). */
interface LineaDeAtaque {
  clave: string;
  d: string;
  bando: 'nuestro' | 'suyo';
}

/** Un mensaje a la vista (se va solo a los pocos segundos). */
interface MensajeALaVista {
  clave: number;
  paso: PasoDelGuion;
}

@Component({
  selector: 'app-ventana-de-combate',
  templateUrl: './ventana-de-combate.html',
  styleUrl: './ventana-de-combate.css',
})
export class VentanaDeCombate {
  private readonly store = inject(JuegoStore);
  protected readonly luchar = inject(Luchar);
  protected readonly plegada = signal(false);
  private readonly ritmo = inject(RITMO_DEL_COMBATE);

  /** La ronda que se está enseñando y el mensaje por el que va (-1 = aún caen los dados). null = nada. */
  private readonly reproduccion = signal<{ ronda: RondaJugada; indice: number } | null>(null);
  /** Los mensajes que hay a la vista ahora. */
  protected readonly mensajes = signal<MensajeALaVista[]>([]);
  /** El gesto que hace cada carta ahora mismo (id del luchador → animación; "ataca" = el que golpea). */
  protected readonly gestos = signal<Record<string, AnimacionDeCarta | 'ataca'>>({});
  /** ¿Se está enseñando una ronda? (los botones esperan) */
  protected readonly animando = computed(() => this.reproduccion() !== null);
  private relojes: number[] = [];
  private claves = 0;
  private readonly zonaDeBandos = viewChild<ElementRef<HTMLElement>>('bandos');
  /** Las líneas de quién ataca a quién (se miden cuando cambian las cartas o el tamaño). */
  protected readonly lineas = signal<LineaDeAtaque[]>([]);
  private observador: ResizeObserver | null = null;

  /** El combate normal (no el abordaje de un combate naval, que va en su panel). */
  protected readonly combate = computed(() => {
    const estado = this.store.estado();
    return estado && !estado.mundo.combateNaval ? estado.mundo.combate : null;
  });

  /** Las cartas: mientras se anima, las de ANTES de la ronda con las barras del mensaje por el que va. */
  protected readonly cartas = computed(() => {
    const estado = this.store.estado();
    if (!estado || !this.combate()) return { aliados: [], enemigos: [] };
    const r = this.reproduccion();
    if (!r || !r.ronda.antes.mundo.combate) return cartasDelCombate(estado);
    const paso = r.indice >= 0 ? r.ronda.guion.pasos[r.indice] : undefined;
    const vidas = paso?.vidas ?? r.ronda.guion.vidasIniciales;
    const maximos = paso?.maximos ?? r.ronda.guion.maximosIniciales;
    const conBarras = (c: CartaDeCombate): CartaDeCombate => {
      const vida = vidas[c.id] ?? c.vida;
      return { ...c, vida, maximo: maximos[c.id] ?? c.maximo, caido: vida <= 0, perdera: 0 };
    };
    const antes = cartasDelCombate(r.ronda.antes);
    return { aliados: antes.aliados.map(conBarras), enemigos: antes.enemigos.map(conBarras) };
  });

  /**
   * El resumen del combate terminado (la tarjeta final): rondas, a quién has derrotado, lo que has
   * perdido, quién de tu bando ha caído, si te han maldecido y si hay botín por recoger.
   */
  protected readonly resumen = computed(() => {
    const estado = this.store.estado();
    const c = this.combate();
    if (!estado || !c?.resultado) return null;
    const alEmpezar = this.luchar.historial()[0]?.antes;
    const caidos = (alEmpezar?.jugador.seguidores ?? []).filter(s => !estado.jugador.seguidores.some(x => x.id === s.id)).map(s => s.nombre);
    const derrotados = c.enemigos.filter(e => e.resistencia <= 0);
    return {
      rondas: c.ronda,
      derrotados: derrotados.map(e => e.nombre),
      vidaPerdida: alEmpezar ? Math.max(0, alEmpezar.jugador.vida - estado.jugador.vida) : null,
      caidos,
      maldito: c.eventosAlTerminar.includes('maldicion'),
      botin: derrotados.some(e => (e.recompensa ?? []).length > 0),
      deUnEvento: eventoEsperaUnCombate(estado),
    };
  });

  /** Mensajes del centro (sin carta) y de cada carta. */
  protected readonly mensajesDelCentro = computed(() => this.mensajes().filter(m => m.paso.luchador === null));
  protected mensajesDe(id: string): MensajeALaVista[] {
    return this.mensajes().filter(m => m.paso.luchador === id);
  }

  /** El historial, lo más nuevo arriba: cada ronda con sus dados y sus mensajes. */
  protected readonly historial = computed(() =>
    [...this.luchar.historial()].reverse().map(r => ({
      numero: r.numero,
      titulo: r.titulo,
      dados: r.guion.dados.map(d => `${d.valor}`),
      colores: r.guion.dados.map(d => d.color),
      mensajes: r.guion.pasos.map(p => p.mensaje),
    })),
  );

  constructor() {
    // Cada ronda nueva que llega del servicio Luchar se enseña paso a paso.
    effect(() => {
      const ronda = this.luchar.ultimaRonda();
      untracked(() => (ronda ? this.ensenar(ronda) : this.saltarAlFinal()));
    });
    // Las líneas: cuando cambian las cartas, se vuelven a medir (después de pintarse).
    effect(() => {
      this.cartas();
      const zona = this.zonaDeBandos()?.nativeElement;
      untracked(() => {
        if (!zona) return;
        if (!this.observador && typeof ResizeObserver !== 'undefined') {
          this.observador = new ResizeObserver(() => this.medirLineas());
          this.observador.observe(zona);
        }
        requestAnimationFrame(() => this.medirLineas());
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.limpiarRelojes();
      this.observador?.disconnect();
    });
  }

  /**
   * Dibuja una línea curva desde cada luchador hasta su rival: las de tu bando, verdes y por arriba;
   * las de los enemigos, rojas y por abajo (así no se tapan cuando dos se atacan entre sí).
   */
  private medirLineas(): void {
    const zona = this.zonaDeBandos()?.nativeElement;
    if (!zona) return;
    const caja = zona.getBoundingClientRect();
    if (caja.width === 0) return; // sin pintar (los tests)
    const { aliados, enemigos } = this.cartas();
    const rect = (id: string) => zona.querySelector(`.carta[data-luchador="${id}"]`)?.getBoundingClientRect();
    const lineas: LineaDeAtaque[] = [];
    for (const [lista, bando] of [[aliados, 'nuestro'], [enemigos, 'suyo']] as const) {
      for (const carta of lista) {
        const rival = carta.rival ?? undefined;
        const a = rect(carta.id), b = rival ? rect(rival) : undefined;
        if (!a || !b || carta.caido) continue;
        const nuestro = bando === 'nuestro';
        const x1 = (nuestro ? a.right : a.left) - caja.left, y1 = a.top + a.height * (nuestro ? 0.35 : 0.65) - caja.top;
        const x2 = (nuestro ? b.left : b.right) - caja.left, y2 = b.top + b.height * (nuestro ? 0.35 : 0.65) - caja.top;
        const curva = nuestro ? -18 : 18;
        lineas.push({ clave: `${carta.id}-${rival}`, d: `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 + curva} ${x2},${y2}`, bando });
      }
    }
    this.lineas.set(lineas);
  }

  /** "Rápido": se acaba la animación y se ve cómo ha quedado todo. */
  protected saltarAlFinal(): void {
    this.limpiarRelojes();
    this.reproduccion.set(null);
    this.mensajes.set([]);
    this.gestos.set({});
  }

  private ensenar(ronda: RondaJugada): void {
    this.saltarAlFinal();
    const { dados, paso, mensaje } = this.ritmo;
    if (paso <= 0 || ronda.guion.pasos.length === 0) return; // sin animación: se ve el final en el acto
    const reducido = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const ritmoPaso = reducido ? Math.min(paso, 400) : paso;
    this.reproduccion.set({ ronda, indice: -1 });
    const esperaDados = ronda.guion.dados.length > 0 ? dados : 0;
    ronda.guion.pasos.forEach((p, i) => {
      this.despues(esperaDados + i * ritmoPaso, () => {
        this.reproduccion.set({ ronda, indice: i });
        this.gestos.set({ ...(p.luchador && p.animacion ? { [p.luchador]: p.animacion } : {}), ...(p.atacante ? { [p.atacante]: 'ataca' } : {}) });
        const clave = ++this.claves;
        // Un mensaje nuevo sobre la misma carta (o en el centro) sustituye al que hubiera: así no se pisan.
        this.mensajes.update(m => [...m.filter(x => x.paso.luchador !== p.luchador), { clave, paso: p }]);
        this.despues(mensaje, () => this.mensajes.update(m => m.filter(x => x.clave !== clave)));
      });
    });
    // al terminar (un poco después del último mensaje): las cartas, como están de verdad
    this.despues(esperaDados + ronda.guion.pasos.length * ritmoPaso, () => {
      this.reproduccion.set(null);
      this.gestos.set({});
    });
  }

  private despues(ms: number, hacer: () => void): void {
    this.relojes.push(window.setTimeout(hacer, ms));
  }

  private limpiarRelojes(): void {
    this.relojes.forEach(r => clearTimeout(r));
    this.relojes = [];
  }

  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado ? opcionesDeCombate(estado) : null;
  });

  protected readonly textoNoHuir = TEXTO_NO_HUIR;
  protected readonly textoNoUsar = TEXTO_NO_USAR_OBJETO;
  protected readonly nombreDeObjeto = nombreDeObjeto;

  protected readonly textoDelResultado: Record<string, string> = {
    victoria: '¡VICTORIA!',
    huida: 'Os ponéis a salvo',
    derrota: 'DERROTA',
  };

  /** Ancho (en %) de la parte de la barra que se queda y de la que se va a perder. */
  protected barra(carta: CartaDeCombate): { queda: number; pierde: number } {
    const maximo = Math.max(1, carta.maximo);
    const pierde = Math.min(carta.perdera, Math.max(0, carta.vida));
    return { queda: (100 * Math.max(0, carta.vida - pierde)) / maximo, pierde: (100 * pierde) / maximo };
  }
}

/** Las cartas de los dos bandos, tal como están ahora (con la vista previa si hay un 6 en la mesa). */
export function cartasDelCombate(estado: Estado): { aliados: CartaDeCombate[]; enemigos: CartaDeCombate[] } {
  const combate = estado.mundo.combate!;
  const previa = vistaPreviaDeLaRonda(estado) ?? {};
  const nombres: Record<string, string> = { [ID_JUGADOR]: estado.jugador.nombre };
  for (const s of estado.jugador.seguidores) nombres[s.id] = s.nombre;
  for (const e of combate.enemigos) nombres[e.id] = e.nombre;
  const rival = (id: string) => (combate.objetivos[id] ? nombres[combate.objetivos[id]] ?? null : null);
  const rivalId = (id: string) => combate.objetivos[id] ?? null;

  const aliados = aliadosQueLuchan(estado.jugador).map((id): CartaDeCombate => {
    if (id === ID_JUGADOR) {
      const j = estado.jugador;
      return {
        id,
        nombre: `${j.nombre} (tú)`,
        vida: j.vida,
        maximo: vidaMaxActual(j),
        ataque: null,
        detalles: [],
        imagen: j.retrato === 'mujer' ? 'personaje/tokenMujer.png' : 'personaje/tokenHombre.png',
        silueta: false,
        inicial: j.nombre.charAt(0).toUpperCase(),
        caido: j.vida <= 0,
        atacaA: rival(id),
        rival: rivalId(id),
        perdera: previa[id] ?? 0,
        esJugador: true,
      };
    }
    const s = estado.jugador.seguidores.find(x => x.id === id)!;
    return {
      id,
      nombre: s.nombre,
      vida: s.resistencia,
      maximo: s.resistenciaMaxima,
      ataque: s.ataque,
      detalles: [],
      ...dibujo(TIPOS_SEGUIDOR.find(t => t.id === s.tipo)?.imagen, SILUETAS.seguidor),
      inicial: s.nombre.charAt(0).toUpperCase(),
      caido: s.resistencia <= 0,
      atacaA: rival(id),
      rival: rivalId(id),
      perdera: previa[id] ?? 0,
      esJugador: false,
    };
  });

  const enemigos = combate.enemigos.map(
    (e): CartaDeCombate => ({
      id: e.id,
      nombre: e.nombre,
      vida: e.resistencia,
      maximo: e.resistenciaMaxima,
      ataque: e.ataque,
      detalles: e.habilidades.map(h => NOMBRE_DE_HABILIDAD_DE_ENEMIGO[h]),
      ...dibujo(ENEMIGOS.find(f => f.id === e.tipo)?.imagen, SILUETAS[e.categoria]),
      inicial: e.nombre.charAt(0).toUpperCase(),
      caido: e.resistencia <= 0,
      atacaA: e.resistencia > 0 ? rival(e.id) : null,
      rival: e.resistencia > 0 ? rivalId(e.id) : null,
      perdera: previa[e.id] ?? 0,
      esJugador: false,
    }),
  );
  return { aliados, enemigos };
}

/** El dibujo de su ficha, o la silueta de reserva si no tiene. */
function dibujo(imagen: string | undefined, silueta: string): { imagen: string; silueta: boolean } {
  return imagen ? { imagen, silueta: false } : { imagen: silueta, silueta: true };
}
