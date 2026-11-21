import { Component, DestroyRef, effect, ElementRef, inject, signal, untracked, viewChild, ViewEncapsulation } from '@angular/core';
import { MesaDeTiradas, type TiradaEnLaMesa } from '../../servicios/mesa-de-tiradas';

// LOS DADOS SOBRE EL MAPA (pedido por el autor el 21-nov): cuando hay una tirada pública, los dados
// caen encima del mapa como si fuera un tablero y enseñan lo que ha sacado el juego. A los 2 segundos
// de pararse se desvanecen. Solo pinta: no tira nada (los números vienen de la mesa de tiradas).
// Animación según el documento de "Dados del Capitán" (la versión que aprobó el autor): vista desde
// arriba, el 1 es una calavera, cada dado cae en un sitio al azar del tablero sin solaparse, entra
// desde abajo, hace un arco, un rebotito y resbala frenando, con UNA sola voltereta; la rotación y el
// desplazamiento frenan con la misma curva y terminan a la vez. El sitio y el giro de cada dado son
// adorno (Math.random está bien aquí: no cambia la partida).
// Los dados se crean a mano (no con la plantilla) porque se animan fotograma a fotograma; por eso
// los estilos van sin encapsular (todos empiezan por "dados-").

/** Qué giro [rx, ry] deja la cara n mirando hacia arriba. */
const CARA_ARRIBA: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
/** Qué celdas de la cuadrícula de 3×3 llevan punto en cada cara. */
const PUNTOS: Record<number, number[]> = { 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const CALAVERA =
  '<svg class="dados-calavera" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 15C30 15 17 29 17 47c0 11 6 19 13 23v9c0 3 2 5 5 5h30c3 0 5-2 5-5v-9c7-4 13-12 13-23C83 29 70 15 50 15zM27 47a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM55 47a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM50 58l-4.5 8h9zM42.5 74h3v10h-3zM54.5 74h3v10h-3z"/></svg>';

/** Cuánto se quedan los dados quietos antes de desvanecerse (ms). */
const TIEMPO_A_LA_VISTA = 2000;
/** Lo que tarda en desvanecerse (ms; igual que la transición del CSS). */
const TIEMPO_DESVANECER = 400;
/** Espacio que se deja abajo para no tapar la barra del mapa (texto y botones de zoom), en px. */
const MARGEN_ABAJO = 100;

const azar = (a: number, b: number) => a + Math.random() * (b - a);
const salidaCubica = (t: number) => 1 - (1 - t) ** 3;
/** El siguiente ángulo equivalente a "objetivo", con "vueltas" vueltas completas de más. */
const siguienteAngulo = (actual: number, objetivo: number, vueltas: number) =>
  Math.ceil((actual - objetivo) / 360) * 360 + objetivo + 360 * vueltas;

@Component({
  selector: 'app-dados-en-el-mapa',
  templateUrl: './dados-en-el-mapa.html',
  styleUrl: './dados-en-el-mapa.css',
  encapsulation: ViewEncapsulation.None,
})
export class DadosEnElMapa {
  private readonly mesa = inject(MesaDeTiradas);
  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('mesa');
  /** El texto del resultado ("4 + 1 = 5"), cuando los dados ya se han parado. */
  protected readonly resultado = signal<string | null>(null);
  protected readonly saliendo = signal(false);
  private relojes: number[] = [];
  private audio: AudioContext | null = null;

  constructor() {
    effect(() => {
      const tirada = this.mesa.tirada();
      if (tirada) untracked(() => this.tirar(tirada));
    });
    inject(DestroyRef).onDestroy(() => {
      this.limpiarRelojes();
      void this.audio?.close().catch(() => undefined);
    });
  }

  private limpiarRelojes(): void {
    this.relojes.forEach(r => clearTimeout(r));
    this.relojes = [];
  }

  private despues(ms: number, hacer: () => void): void {
    this.relojes.push(window.setTimeout(hacer, ms));
  }

  private tirar(tirada: TiradaEnLaMesa): void {
    const mesa = this.lienzo().nativeElement;
    this.limpiarRelojes();
    mesa.replaceChildren();
    mesa.classList.remove('dados-saliendo');
    this.resultado.set(null);
    this.saliendo.set(false);

    const W = mesa.clientWidth, H = mesa.clientHeight;
    if (W <= 0 || H <= 0 || tirada.dados.length === 0) return; // sin sitio (p. ej. en los tests) no se pinta
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const n = tirada.dados.length;
    // tamaño del dado: el del documento, más pequeño si hay muchos dados o poco sitio
    const s = Math.max(48, Math.min(100, W * 0.18, (H - MARGEN_ABAJO) * 0.3, 260 / Math.sqrt(n)));
    const centros = this.repartir(n, s, W, H);
    const duracion = reducir ? 250 : azar(1250, 1450);
    const origenX = W / 2 + azar(-0.25, 0.25) * W;
    const origenY = H - 0.55 * s;

    tirada.dados.forEach((valor, i) => {
      const [cx, cy] = centros[i];
      const dado = this.crearDado(s);
      dado.raiz.style.left = `${cx - s / 2}px`;
      dado.raiz.style.top = `${cy - s / 2}px`;
      mesa.appendChild(dado.raiz);

      // giro final: la cara del resultado arriba, con una voltereta, y un poco torcido sobre la mesa
      const [rxCara, ryCara] = CARA_ARRIBA[valor] ?? [0, 0];
      const vueltas = reducir ? 0 : 1;
      const rx = siguienteAngulo(0, rxCara, vueltas), ry = siguienteAngulo(0, ryCara, vueltas);
      const giro = Math.round(azar(-100, 100) / 90) * 90 + azar(-18, 18);
      void dado.raiz.offsetWidth; // que el navegador vea la posición de salida antes de la transición
      const transicion = `${duracion * 0.8}ms cubic-bezier(.33,1,.68,1)`;
      dado.cubo.style.transition = `transform ${transicion}`;
      dado.inclinacion.style.transition = `transform ${transicion}`;
      dado.sombra.style.transition = `rotate ${transicion}`;
      dado.cubo.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      dado.inclinacion.style.transform = `rotateZ(${giro}deg)`;
      dado.sombra.style.rotate = `${giro}deg`;

      // el vuelo: el mismo muestreo para el dado y su sombra (40 fotogramas, sin saltos)
      if (!reducir && typeof dado.vuelo.animate === 'function') {
        const dx = origenX + azar(-0.6, 0.6) * s - cx, dy = origenY - cy;
        const alturaSombra = Math.min(130, s * 1.05);
        const vuelo: Keyframe[] = [], sombra: Keyframe[] = [];
        for (let f = 0; f <= 40; f++) {
          const t = f / 40;
          const k = 1 - salidaCubica(Math.min(1, t / 0.8)); // mismo frenado que la rotación
          let h = 0;
          if (t < 0.38) {
            const u = t / 0.38;
            h = 4 * u * (1 - u) * 0.6; // arco de vuelo
          } else if (t < 0.56) {
            const v = (t - 0.38) / 0.18;
            h = 4 * v * (1 - v) * 0.08; // rebotito
          }
          vuelo.push({ transform: `translate(${dx * k}px, ${dy * k}px) scale(${1 + h * 0.35})` });
          sombra.push({
            translate: `${dx * k + 5 + h * alturaSombra * 0.35}px ${dy * k + 8 + h * alturaSombra * 0.5}px`,
            scale: `${1 + h * 0.15}`,
            opacity: `${1 - h * 0.8}`,
            filter: `blur(${5 + h * 12}px)`,
          });
        }
        dado.vuelo.animate(vuelo, { duration: duracion, easing: 'linear' });
        dado.sombra.animate(sombra, { duration: duracion, easing: 'linear' });
        this.choque(duracion * 0.38, 0.55);
        this.choque(duracion * 0.56, 0.25);
      }
    });

    // al pararse: el resultado; a los 2 segundos, se desvanece todo
    this.despues(duracion + 80, () => {
      const suma = tirada.dados.join(' + ');
      const mod = tirada.modificador > 0 ? ` + ${tirada.modificador}` : tirada.modificador < 0 ? ` − ${-tirada.modificador}` : '';
      this.resultado.set(n === 1 && !mod ? `${tirada.total}` : `${suma}${mod} = ${tirada.total}`);
      this.despues(TIEMPO_A_LA_VISTA, () => {
        mesa.classList.add('dados-saliendo');
        this.saliendo.set(true);
        this.despues(TIEMPO_DESVANECER, () => {
          mesa.replaceChildren();
          mesa.classList.remove('dados-saliendo');
          this.resultado.set(null);
          this.saliendo.set(false);
        });
      });
    });
  }

  /** Sitios al azar para n dados, sin solaparse ni salirse (el mejor de 60 intentos). */
  private repartir(n: number, s: number, W: number, H: number): [number, number][] {
    const m = s * 0.75 + 6; // cabe el dado girado
    const x0 = m, x1 = Math.max(m, W - m), y0 = m, y1 = Math.max(m, H - m - MARGEN_ABAJO);
    let mejor: [number, number][] = [], mejorSeparacion = -1;
    for (let intento = 0; intento < 60; intento++) {
      const puntos: [number, number][] = Array.from({ length: n }, () => [azar(x0, x1), azar(y0, y1)]);
      let separacion = Infinity;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          separacion = Math.min(separacion, Math.hypot(puntos[a][0] - puntos[b][0], puntos[a][1] - puntos[b][1]));
      if (separacion > mejorSeparacion) {
        mejor = puntos;
        mejorSeparacion = separacion;
      }
      if (separacion >= 1.6 * s) break;
    }
    return mejor;
  }

  /** Construye un dado: raíz > sombra + vuelo > inclinación > cubo > 6 caras. */
  private crearDado(s: number) {
    const div = (clase: string) => {
      const d = document.createElement('div');
      d.className = clase;
      return d;
    };
    const raiz = div('dados-dado'), sombra = div('dados-sombra'), vuelo = div('dados-vuelo');
    const inclinacion = div('dados-inclinacion'), cubo = div('dados-cubo');
    raiz.style.setProperty('--s', `${s}px`);
    for (let cara = 1; cara <= 6; cara++) {
      const c = div(`dados-cara dados-f${cara}`);
      if (cara === 1) c.innerHTML = CALAVERA;
      else
        for (let celda = 0; celda < 9; celda++) {
          const hueco = document.createElement('span');
          hueco.className = 'dados-celda';
          if (PUNTOS[cara].includes(celda)) hueco.appendChild(document.createElement('i')).className = 'dados-punto';
          c.appendChild(hueco);
        }
      cubo.appendChild(c);
    }
    inclinacion.appendChild(cubo);
    vuelo.appendChild(inclinacion);
    raiz.append(sombra, vuelo);
    return { raiz, sombra, vuelo, inclinacion, cubo };
  }

  /** Un "clac" de dado contra la mesa (ruido corto filtrado), si el sonido está puesto. */
  private choque(retrasoMs: number, volumen: number): void {
    if (!this.mesa.sonido()) return;
    try {
      const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) return;
      this.audio ??= new Contexto();
      const c = this.audio;
      if (c.state === 'suspended') void c.resume();
      const largo = Math.floor(c.sampleRate * 0.07);
      const buffer = c.createBuffer(1, largo, c.sampleRate);
      const datos = buffer.getChannelData(0);
      for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 3;
      const fuente = c.createBufferSource();
      fuente.buffer = buffer;
      const filtro = c.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 700 + Math.random() * 1300;
      filtro.Q.value = 1.2;
      const ganancia = c.createGain();
      ganancia.gain.value = volumen;
      fuente.connect(filtro).connect(ganancia).connect(c.destination);
      fuente.start(c.currentTime + retrasoMs / 1000);
    } catch {
      // sin sonido: no pasa nada
    }
  }
}
