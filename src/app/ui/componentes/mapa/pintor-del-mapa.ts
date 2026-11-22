import type { Coordenada, Mapa } from '../../../core/mapa/mapa';
import { crearBarco3D, type Barco3D } from './barco-3d';
import { BALANCEO, POSE_QUIETA, poseDelBalanceo } from './balanceo';
import { casillaInicialDelBarco } from '../../../core/mapa/donde-estas';
import {
  casillasParaPintar,
  direcciones,
  NOMBRE_DE_LUGAR,
  NOMBRE_DE_TERRENO,
  TINTES,
  type CasillaPintable,
} from './casillas-para-pintar';
import { boxBlur, edt, fbm, field, hash, S, smooth, type Campo } from './ruido';
import { SD_MIN, SD_RANGE, SOMBREADOR_DE_VERTICES, SOMBREADOR_DEL_AGUA } from './sombreador-del-agua';

// EL PINTOR DEL MAPA: dibuja el mapa como el HTML de referencia (docs/ContextoMapa/mapa.html,
// explicado en su LEEME.md), pero a partir del mapa del juego (data/mapas/<id>.json).
// Es el mismo código, llevado a TypeScript, con estos cambios (decididos por el autor el 20-nov):
//   - Solo llevan nombre los puertos (no las islas, los mares, los monasterios ni las guaridas).
//   - Las casillas y los lugares vienen del JSON (el .wxx ya lo ha leído el conversor).
//   - La rejilla se enciende y se apaga desde fuera (irá al menú de opciones), sin botón.
//   - Marcas de prueba (opcionales): zonas de eventos de barco y casilla de inicio.
//   - Dos barcos para elegir (pruebas del autor, 20-nov): el 3D del HTML o uno 2D (dibujo plano que se mece).
//   - Sin la ruta roja ni la X al elegir destino (pedido por el autor el 21-nov): el barco solo navega.
//   - Dos modos (Sprint 9, paso 8): "prueba" (el barco navega libre por el agua al tocar el mar) y
//     "partida" (barco y monigote donde diga la partida; las casillas a las que se puede viajar salen
//     con borde rojo discontinuo y al tocarlas se avisa a quien usa el mapa; rocas en las casillas
//     bloqueadas y una X roja en las aldeas ofendidas).
// Solo dibujo: nada de reglas del juego. Capas, de abajo arriba:
//   gl: el pergamino con el agua animada (WebGL) · cv: rejilla, ruta y barco a tinta · sh: barco 3D.

export interface LienzosDelMapa {
  agua: HTMLCanvasElement;
  tinta: HTMLCanvasElement;
  barco: HTMLCanvasElement;
}

/** Lo que dice el recuadro de información: un título destacado (opcional) y detalles separados por "·". */
export interface InfoDeCasilla {
  titulo: string;
  detalles: string[];
}

/** Qué barco se dibuja: el modelo 3D o el dibujo plano (public/barco/Ship.png). */
export type TipoDeBarco = '3d' | '2d';

export interface OpcionesDelPintor {
  rejilla: boolean;
  barco: TipoDeBarco;
  marcasDePrueba: boolean;
  /** Carpeta de los iconos (PNG de 300×300), p. ej. "iconosMapa/". */
  rutaIconos: string;
  rutaModeloBarco: string;
  rutaTexturaBarco: string;
  /** Dibujo del barco 2D: de perfil, con la proa a la IZQUIERDA (PNG cuadrado). */
  rutaBarco2D: string;
  /** Dibujo del monigote (el jugador a pie): PNG con fondo transparente, de pie, con los pies abajo. */
  monigote: DibujoDelMonigote;
  /** Mensajes para el recuadro de información (al tocar una casilla, al cargar...). */
  alInformar: (info: InfoDeCasilla) => void;
  modo: 'prueba' | 'partida';
  /** Dónde están el barco y el jugador al abrir el mapa (en modo partida). Jugador null = a bordo. */
  posiciones?: PosicionesEnElMapa;
  /** Modo partida: se ha tocado una de las casillas a las que se puede viajar. */
  alElegirCasilla?: (casilla: Coordenada) => void;
  /** Modo partida: se ha tocado una de las casillas amarillas (embarcar o desembarcar). */
  alElegirEmbarque?: (casilla: Coordenada) => void;
}

/** El dibujo del monigote: el PNG (con fondo transparente, de pie) y el grosor de su borde blanco. */
export interface DibujoDelMonigote {
  ruta: string;
  /** Grosor del borde blanco, en píxeles del dibujo reducido (de 512 de alto). Por fuera va la tinta. */
  bordeBlanco: number;
}

export interface PosicionesEnElMapa {
  barco: Coordenada;
  /** Dónde está el jugador si va a pie (se dibuja el monigote); null si va a bordo. */
  jugador: Coordenada | null;
}

/** Lo que la partida marca en el mapa. */
export interface MarcasDelMapa {
  bloqueadas: Coordenada[];
  ofendidas: Coordenada[];
}

export interface ControlDelMapa {
  cambiarRejilla(encendida: boolean): void;
  cambiarMarcasDePrueba(encendidas: boolean): void;
  cambiarBarco(tipo: TipoDeBarco): void;
  /** Cambia el dibujo del monigote (el retrato del personaje: hombre o mujer). */
  cambiarMonigote(dibujo: DibujoDelMonigote): void;
  /** Modo partida: mueve el barco y el monigote (con una pequeña animación). */
  colocar(posiciones: PosicionesEnElMapa): void;
  /** Modo partida: las casillas a las que se puede viajar ahora (borde rojo discontinuo). */
  cambiarDestinos(destinos: Coordenada[]): void;
  /** Modo partida: las casillas donde se puede embarcar o desembarcar ahora (borde amarillo). */
  cambiarEmbarques(casillas: Coordenada[]): void;
  cambiarMarcasDelMapa(marcas: MarcasDelMapa): void;
  /** El mapa ha cambiado (una casilla con otro rasgo): se vuelve a pintar el pergamino. */
  cambiarMapa(mapa: Mapa): void;
  acercar(): void;
  alejar(): void;
  centrar(): void;
  destruir(): void;
}

/* ---------- Iconos del mapa ----------
   PNG de 300×300 con fondo transparente (Cartography Kit de Highland Paranormal Society; ver CREDITOS.md).
   ICON_SETS dice qué iconos van en cada tipo. Para añadir uno: meter el PNG en public/iconosMapa/
   y añadir su nombre (sin .png) a la lista que toque. */
const ICON_SETS = {
  jungla: ['tree13', 'tree15', 'tree16', 'tree17'], // jungla normal: un grupo de árboles por casilla
  espesa: ['tree22', 'tree24', 'tree25'], // jungla profunda (falta tree23: cuando llegue, añadirlo aquí)
  hierba: ['tall_grass_3', 'reeds_4'], // en muy pocas casillas de jungla normal, en lugar de árboles
  playa: ['palmeras', 'palmeras2'], // en algo más de la mitad de las casillas de playa
  puerto: ['city2', 'city3', 'city8'], // puertos: se reparten para que salgan todos
  puerto_principal: ['city2', 'city3', 'city8'], // mismo icono que los normales (decisión del autor)
  aldea: ['village', 'village_5', 'village_9', 'huts'],
  ruinas: ['ruined_keep'],
  naufragio: ['ship_wreck'],
  monasterio: ['church_icon_2'],
  guarida_pirata: ['doodle_skull_icon'],
};
// Icono de las casillas bloqueadas (camino bloqueado de E047, guarida hostil...).
const ICONO_BLOQUEADA = 'rock';
// Icono fijo para lugares concretos (manda sobre el reparto automático).
// La clave es el nombre del lugar ('Port Royal') o "columna,fila" para lugares sin nombre (sale al tocar la casilla).
const ICONO_POR_LUGAR: Record<string, string> = {
  // 'Port Royal': 'city8',
  // '18,7': 'huts',
};

const R3 = Math.sqrt(3);
// El monigote: altura del dibujo en el mapa (en radios de casilla) y altura a la que se reduce al cargarlo.
const ALTO_DEL_MONIGOTE = 1.4;
const ALTO_MAXIMO_DEL_DIBUJO = 512;
// Modo partida: con cuánto zoom empieza el mapa, centrado en el personaje (1 = el mapa entero).
const ZOOM_INICIAL = 4;
// Grosor de la línea de tinta que va por fuera del borde blanco del monigote (píxeles del dibujo reducido).
const TINTA_DEL_CONTORNO = 5.4;

/** El monigote mientras anda (ver "El monigote andando" dentro de pintarMapa). */
interface Andarin {
  x: number;
  z: number;
  /** Casillas que le quedan por recorrer. */
  path: CasillaPintable[];
  /** 1 = mira a la derecha, -1 = a la izquierda. */
  dir: number;
  andando: boolean;
  /** El tramo actual: de dónde sale, a qué casilla va, en cuántos pasos y cuántos lleva. */
  desdeX: number;
  desdeZ: number;
  destino: CasillaPintable | null;
  pasos: number;
  hechos: number;
  /** Progreso dentro del paso actual (0 a 1) y número de paso (para inclinarse a un lado o al otro). */
  p: number;
  paso: number;
}

/**
 * Rodea el dibujo con un contorno (tinta por fuera, papel por dentro) para que se distinga del mapa.
 * El resultado es algo más grande que el dibujo: `margen` píxeles más por cada lado.
 */
function conContorno(dibujo: HTMLCanvasElement, bordeBlanco: number): HTMLCanvasElement {
  const margen = Math.ceil(bordeBlanco + TINTA_DEL_CONTORNO);
  const silueta = (color: string) => {
    const c = document.createElement('canvas');
    c.width = dibujo.width;
    c.height = dibujo.height;
    const g = c.getContext('2d');
    if (!g) return c;
    g.drawImage(dibujo, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const c = document.createElement('canvas');
  c.width = dibujo.width + margen * 2;
  c.height = dibujo.height + margen * 2;
  const g = c.getContext('2d');
  if (!g) return dibujo;
  const tinta = silueta('#2b1a0e'), papel = silueta('#fbf1d3');
  const rodear = (s: HTMLCanvasElement, r: number) => {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.drawImage(s, margen + Math.cos(a) * r, margen + Math.sin(a) * r);
    }
  };
  rodear(tinta, bordeBlanco + TINTA_DEL_CONTORNO);
  rodear(papel, bordeBlanco);
  g.drawImage(dibujo, margen, margen);
  return c;
}

/** Reduce un dibujo grande a la mitad las veces que haga falta (así se ve suave, sin dientes de sierra). */
function reducirDibujo(im: HTMLImageElement, altoMaximo: number): HTMLCanvasElement {
  let fuente: CanvasImageSource = im, w = im.naturalWidth, h = im.naturalHeight;
  do {
    const ancho = h / 2 >= altoMaximo ? Math.round(w / 2) : w, alto = h / 2 >= altoMaximo ? Math.round(h / 2) : h;
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    c.getContext('2d')?.drawImage(fuente, 0, 0, ancho, alto);
    fuente = c;
    if (ancho === w) return c;
    w = ancho;
    h = alto;
  } while (true);
}
const INK = '#3a2717', RED = '#9b2a1c', AMARILLO = '#f2c12e';
const SIMBOLO: Record<string, string> = { playa: 'beach', jungla: 'trees', jungla_profunda: 'dense' };

/** Pide el contexto 2D de un lienzo (en un navegador normal siempre lo hay). */
function contexto2d(lienzo: HTMLCanvasElement, opciones?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const g = lienzo.getContext('2d', opciones);
  if (!g) throw new Error('Tu navegador no puede dibujar el mapa');
  return g;
}

interface BarcoEnElMapa {
  x: number;
  z: number;
  path: CasillaPintable[];
  dir: number;
  yaw: number;
  dest: CasillaPintable | null;
}

/** Zona vista de cerca, redibujada a la resolución de la pantalla. */
interface Detalle {
  c: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function pintarMapa(lienzos: LienzosDelMapa, mapaInicial: Mapa, opciones: OpcionesDelPintor): ControlDelMapa {
  let mapaDelJuego = mapaInicial;
  const cv = lienzos.tinta, glc = lienzos.agua;
  const ctxONada = cv.getContext('2d');
  const info = (titulo: string, ...detalles: string[]) => opciones.alInformar({ titulo, detalles });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let destruido = false;
  let rafId = 0;
  const limpiezas: (() => void)[] = [];

  if (!ctxONada) {
    info('Tu navegador no puede dibujar el mapa');
    return { cambiarRejilla() {}, cambiarMarcasDePrueba() {}, cambiarBarco() {}, cambiarMonigote() {}, colocar() {}, cambiarDestinos() {}, cambiarEmbarques() {}, cambiarMarcasDelMapa() {}, cambiarMapa() {}, acercar() {}, alejar() {}, centrar() {}, destruir() {} };
  }
  const ctx = ctxONada;

  /* ---------- Iconos ---------- */
  const IMG: Record<string, HTMLImageElement> = {};
  function loadIcons(): Promise<void[]> {
    const names = [...new Set([...Object.values(ICON_SETS).flat(), ICONO_BLOQUEADA])];
    return Promise.all(
      names.map(
        n =>
          new Promise<void>(ok => {
            const im = new Image();
            im.onload = () => ok();
            im.onerror = () => {
              console.warn('Falta el icono del mapa', n);
              ok();
            };
            im.src = opciones.rutaIconos + n + '.png';
            IMG[n] = im;
          }),
      ),
    );
  }
  // dibuja un icono de 300×300 centrado en (x,y); size = lado del icono en píxeles de capa
  function icon(g: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, flip: boolean) {
    const im = IMG[name];
    if (!im || !im.complete || !im.naturalWidth) return;
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, -size / 2, -size / 2, size, size);
    g.restore();
  }

  /* ---------- Estado del dibujo ---------- */
  let grid = opciones.rejilla, marcas = opciones.marcasDePrueba, tipoBarco = opciones.barco, barco3dPintado = false;
  const barco2d = new Image();
  barco2d.onerror = () => console.warn('Falta el dibujo del barco 2D', opciones.rutaBarco2D);
  barco2d.src = opciones.rutaBarco2D;
  // El monigote: el dibujo del retrato del personaje (public/personaje/), reducido una vez al cargarlo
  // (los PNG son muy grandes y, encogidos de golpe en cada fotograma, se verían con dientes de sierra).
  let monigote: HTMLCanvasElement | null = null, margenDelMonigote = 0, cargaDelMonigote = 0;
  function cargarMonigote({ ruta, bordeBlanco }: DibujoDelMonigote) {
    const esta = ++cargaDelMonigote;
    const im = new Image();
    im.onload = () => {
      if (esta !== cargaDelMonigote) return;
      const reducido = reducirDibujo(im, ALTO_MAXIMO_DEL_DIBUJO);
      monigote = conContorno(reducido, bordeBlanco);
      margenDelMonigote = (monigote.height - reducido.height) / 2;
    };
    im.onerror = () => console.warn('Falta el dibujo del monigote', ruta);
    im.src = ruta;
  }
  cargarMonigote(opciones.monigote);
  let W = 1, H = 1, DPR = 1, Q = 1.25, LW = 1, LH = 1, LS = 1, LOX = 0, LOY = 0; // capa del pergamino y escala mundo→capa
  // (layer, decor, SD, map y ship se rellenan al pintar, antes de usarse: de ahí el "!")
  let layer!: HTMLCanvasElement, decor!: HTMLCanvasElement, SD!: Campo, det: Detalle | null = null, detTimer = 0;
  let view = { z: 1, x: 0, y: 0 };
  let ship!: BarcoEnElMapa, hover: CasillaPintable | null = null, time = 0;
  // Modo partida: el monigote (null = a bordo), las casillas elegibles y las marcas
  let walker: Andarin | null = null;
  let posiciones: PosicionesEnElMapa | null = opciones.posiciones ?? null;
  let destinos: CasillaPintable[] = [];
  let destinosPendientes: Coordenada[] = [];
  let embarques: CasillaPintable[] = [];
  let embarquesPendientes: Coordenada[] = [];
  let marcasDelMapa: MarcasDelMapa = { bloqueadas: [], ofendidas: [] };
  let map!: { cols: number; rows: number; tiles: CasillaPintable[]; minx: number; maxx: number; minz: number; maxz: number };
  function at(c: number, r: number): CasillaPintable | null {
    return c < 0 || r < 0 || c >= map.cols || r >= map.rows ? null : map.tiles[r * map.cols + c];
  }
  function nbrs(t: CasillaPintable): (CasillaPintable | null)[] {
    return direcciones(t.c).map(d => at(t.c + d[0], t.r + d[1]));
  }
  const LX = (wx: number) => LOX + wx * LS, LY = (wz: number) => LOY + wz * LS;
  function hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }

  function buildMap() {
    const tiles = casillasParaPintar(mapaDelJuego);
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    tiles.forEach(t => {
      minx = Math.min(minx, t.wx - 1);
      maxx = Math.max(maxx, t.wx + 1);
      minz = Math.min(minz, t.wz - R3 / 2);
      maxz = Math.max(maxz, t.wz + R3 / 2);
    });
    map = { cols: mapaDelJuego.columnas, rows: mapaDelJuego.filas, tiles, minx, maxx, minz, maxz };
    hover = null;
    destinos = destinosPendientes.map(c => at(c.col, c.fila)).filter((t): t is CasillaPintable => !!t);
    embarques = embarquesPendientes.map(c => at(c.col, c.fila)).filter((t): t is CasillaPintable => !!t);
    if (ship) return; // si se vuelve a construir (el mapa ha cambiado), el barco y el monigote se quedan
    // el barco: donde diga la partida, o donde empieza en una partida nueva (junto al puerto principal
    // más cercano al inicio)
    const inicioBarco = posiciones?.barco ?? casillaInicialDelBarco(mapaDelJuego) ?? mapaDelJuego.inicio;
    const st = tiles[inicioBarco.fila * mapaDelJuego.columnas + inicioBarco.col];
    ship = { x: st.wx, z: st.wz, path: [], dir: 1, yaw: Math.PI * 0.5, dest: null };
    const j = posiciones?.jugador;
    const tj = j ? tiles[j.fila * mapaDelJuego.columnas + j.col] : null;
    walker = tj ? nuevoAndarin(tj.wx, tj.wz) : null;
  }

  /** Modo partida: lleva el barco y el monigote a su sitio, andando o navegando. */
  function aplicarPosiciones(p: PosicionesEnElMapa) {
    const tb = at(p.barco.col, p.barco.fila);
    if (tb && (Math.abs(tb.wx - ship.x) > 0.01 || Math.abs(tb.wz - ship.z) > 0.01)) {
      const desde = nearestTile(ship.x, ship.z);
      const camino = route(desde, tb);
      ship.path = camino && camino.length ? camino : [tb];
    }
    if (!p.jugador) {
      walker = null;
      return;
    }
    const tj = at(p.jugador.col, p.jugador.fila);
    if (!tj) return;
    if (!walker) walker = nuevoAndarin(tj.wx, tj.wz); // acaba de bajar del barco
    else if (Math.abs(tj.wx - walker.x) > 0.01 || Math.abs(tj.wz - walker.z) > 0.01) walker.path = [tj];
  }

  /* ---------- Pintar el pergamino (una vez por mapa / tamaño) ---------- */
  function paint() {
    LW = Math.min(3600, Math.round(W * DPR * Q));
    Q = LW / (W * DPR);
    LH = Math.round(H * DPR * Q);
    // encuadre: el mapa ocupa toda la página, sin márgenes
    const ex = map.maxx - map.minx, ez = map.maxz - map.minz;
    LS = Math.min(LW / ex, LH / ez);
    LOX = (LW - ex * LS) / 2 - map.minx * LS;
    LOY = (LH - ez * LS) / 2 - map.minz * LS;

    // ruido del papel y de la costa (resolución 1/4)
    const nP = field(LW, LH, 4), nS = field(LW, LH, 4), nC = field(LW, LH, 4);
    for (let y = 0; y < nP.h; y++)
      for (let x = 0; x < nP.w; x++) {
        const i = y * nP.w + x, px = x * 4, py = y * 4, ux = px / LS, uy = py / LS;
        nP.d[i] = fbm(px / 230, py / 230, 4);
        nS.d[i] = fbm(px / 520 + 40, py / 520 + 13, 3);
        nC.d[i] = fbm(ux * 2.3 + 7, uy * 2.3 + 3, 3);
      }
    // tierra: hexágonos → suavizado → umbral con ruido = costa orgánica (resolución 1/2)
    const F2 = Math.min(2, Math.max(0.6, LS / 28)), LM = field(LW, LH, F2), mc = document.createElement('canvas');
    mc.width = LM.w;
    mc.height = LM.h;
    const mg = contexto2d(mc, { willReadFrequently: true });
    mg.scale(1 / F2, 1 / F2);
    mg.fillStyle = '#fff';
    map.tiles.forEach(t => {
      if (t.agua) return;
      hexPath(mg, LX(t.wx), LY(t.wz), LS * 1.02);
      mg.fill();
      // la tierra que toca el borde continúa fuera del mapa (no se le dibuja costa en el borde)
      direcciones(t.c).forEach(d => {
        const c = t.c + d[0], r = t.r + d[1];
        if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) {
          hexPath(mg, LX(1.5 * c), LY(R3 * (r + 0.5 * (c & 1))), LS * 1.02);
          mg.fill();
        }
      });
    });
    const md = mg.getImageData(0, 0, LM.w, LM.h).data;
    for (let i = 0; i < LM.w * LM.h; i++) LM.d[i] = md[i * 4] / 255;
    boxBlur(LM, (0.2 * LS) / F2);
    const mask = new Uint8Array(LM.w * LM.h);
    for (let y = 0; y < LM.h; y++)
      for (let x = 0; x < LM.w; x++) {
        const i = y * LM.w + x;
        mask[i] = LM.d[i] + (S(nC, x * F2, y * F2) - 0.5) * 0.45 > 0.5 ? 1 : 0;
      }
    const dOut = edt(mask, LM.w, LM.h, 1), dIn = edt(mask, LM.w, LM.h, 0), pu = LS / F2;
    SD = field(LW, LH, F2);
    for (let i = 0; i < mask.length; i++) SD.d[i] = (dOut[i] - dIn[i]) / pu; // >0 mar, <0 tierra (en unidades de mundo)
    boxBlur(SD, 1.5); // quita los escalones de la máscara binaria

    // colores de terreno (resolución 1/8, muy suavizados)
    const F8 = 8, TR = field(LW, LH, F8), TG = field(LW, LH, F8), TB = field(LW, LH, F8);
    const tc = document.createElement('canvas');
    tc.width = TR.w;
    tc.height = TR.h;
    const tg = contexto2d(tc, { willReadFrequently: true });
    tg.scale(1 / F8, 1 / F8);
    tg.fillStyle = 'rgb(180,175,120)';
    tg.fillRect(0, 0, LW, LH);
    map.tiles.forEach(t => {
      const tinte = TINTES[t.terreno];
      if (tinte) {
        tg.fillStyle = 'rgb(' + tinte + ')';
        hexPath(tg, LX(t.wx), LY(t.wz), LS * 1.05);
        tg.fill();
      }
    });
    const td = tg.getImageData(0, 0, TR.w, TR.h).data;
    for (let i = 0; i < TR.w * TR.h; i++) {
      TR.d[i] = td[i * 4];
      TG.d[i] = td[i * 4 + 1];
      TB.d[i] = td[i * 4 + 2];
    }
    const bt = (0.35 * LS) / F8;
    boxBlur(TR, bt);
    boxBlur(TG, bt);
    boxBlur(TB, bt);

    // píxel a píxel
    layer = document.createElement('canvas');
    layer.width = LW;
    layer.height = LH;
    const lg = contexto2d(layer);
    const img = lg.createImageData(LW, LH), px = img.data;
    for (let y = 0; y < LH; y++)
      for (let x = 0; x < LW; x++) {
        const o = (y * LW + x) * 4;
        const n = S(nP, x, y), st = S(nS, x, y), fib = (hash(x, y * 0.07, 1) - 0.5) * 9 + (hash(x * 0.05, y, 2) - 0.5) * 5;
        let r = 240 + (214 - 240) * n + fib, g = 226 + (192 - 226) * n + fib, b = 190 + (144 - 190) * n + fib * 0.8; // papel «Caribe vivo»
        const sd = S(SD, x, y);
        if (sd < 0) {
          // tierra
          const k = 0.86;
          r += (S(TR, x, y) - r) * k;
          g += (S(TG, x, y) - g) * k;
          b += (S(TB, x, y) - b) * k;
          const band = (1 - smooth(0, 0.13, -sd)) * 0.32;
          r += (112 - r) * band;
          g += (82 - g) * band;
          b += (46 - b) * band;
        } // el mar se deja en papel: el sombreador del agua lo tiñe y lo anima
        // manchas de humedad (con borde más oscuro)
        const sk = smooth(0.62, 0.74, st) * 0.2 + Math.exp(-Math.pow((st - 0.62) / 0.01, 2)) * 0.14;
        r += (150 - r) * sk;
        g += (112 - g) * sk;
        b += (70 - b) * sk;
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
        px[o + 3] = 255;
      }
    lg.putImageData(img, 0, 0);
    decor = document.createElement('canvas');
    decor.width = LW;
    decor.height = LH;
    drawDecor(contexto2d(decor));
    det = null;
    uploadGL();
    scheduleDetail();
  }

  /* ---------- Dibujo a tinta: vegetación, lugares y nombres ---------- */
  const isLand = (x: number, y: number, m: number) => S(SD, x, y) < -(m || 0);

  function drawDecor(g: CanvasRenderingContext2D) {
    const L = LS;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // símbolos de terreno, ordenados de arriba abajo para que se solapen bien
    const items: { y: number; f: () => void }[] = [];
    map.tiles.forEach(t => {
      if (t.agua) return;
      const sym = SIMBOLO[t.terreno], cx0 = LX(t.wx), cy0 = LY(t.wz);
      if (sym === 'trees' || sym === 'dense') {
        if (t.lugar) return; // la casilla del lugar lleva solo su icono
        const coastal = nbrs(t).some(n => !n || n.agua), sz = L * 2.0 * (coastal ? 0.86 : 1), flip = hash(t.c, t.r, 5) > 0.5;
        let set = sym === 'dense' ? ICON_SETS.espesa : ICON_SETS.jungla;
        if (sym === 'trees' && hash(t.c, t.r, 61) < 0.12) set = ICON_SETS.hierba; // ~1 de cada 8 casillas de jungla normal
        const name = set[Math.floor(hash(t.c, t.r, 3) * set.length)];
        items.push({ y: cy0, f: () => icon(g, name, cx0, cy0 - L * 0.08, sz, flip) });
      } else if (sym === 'beach') {
        if (!t.lugar && hash(t.c, t.r, 99) > 0.42) {
          // palmeras en algo más de la mitad de la playa
          const coastal = nbrs(t).some(n => !n || n.agua), set = ICON_SETS.playa, name = set[Math.floor(hash(t.c, t.r, 7) * set.length)];
          items.push({ y: cy0, f: () => icon(g, name, cx0, cy0 - L * 0.1, L * (coastal ? 1.45 : 1.7), hash(t.c, t.r, 8) > 0.5) });
        }
        for (let i = 0; i < 26; i++) {
          const a = hash(t.c, t.r, i) * 6.283, d = Math.sqrt(hash(t.c, t.r, i + 30)) * 0.75, x = cx0 + Math.cos(a) * d * L, y = cy0 + Math.sin(a) * d * L;
          if (isLand(x, y, 0.04))
            items.push({
              y: -1e9,
              f: () => {
                g.fillStyle = 'rgba(58,39,23,.55)';
                g.beginPath();
                g.arc(x, y, L * 0.012, 0, 6.283);
                g.fill();
              },
            });
        }
      }
    });
    map.tiles.forEach(t => {
      if (!t.lugar) return;
      const x = LX(t.wx), y = LY(t.wz), set = ICON_SETS[t.lugar];
      const nm = ICONO_POR_LUGAR[t.nombre ?? ''] || ICONO_POR_LUGAR[t.c + ',' + t.r] || set[t.variante % set.length];
      items.push({ y: y + L * 0.3, f: () => icon(g, nm, x, y - L * 0.05, L * 2.05, false) });
    });
    items.sort((a, b) => a.y - b.y).forEach(it => it.f());
    labels(g);
  }

  function labels(g: CanvasRenderingContext2D) {
    const boxes: number[][] = []; // zonas ya ocupadas por otros nombres
    const free = (x0: number, y0: number, x1: number, y1: number) =>
      x0 > 0 && y0 > 0 && x1 < LW && y1 < LH && !boxes.some(b => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
    const put = (txt: string, x: number, y: number, size: number) => {
      g.font = `italic ${size}px 'IM Fell English',serif`;
      const w = [...txt].reduce((a, c) => a + g.measureText(c).width, 0), h = size * 1.1;
      const bx = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (!free(bx[0], bx[1], bx[2], bx[3])) return false;
      boxes.push(bx);
      g.save();
      g.translate(x, y);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(236,222,180,.85)';
      g.lineWidth = size * 0.28;
      g.fillStyle = 'rgba(58,39,23,.9)';
      const ws = [...txt].map(c => g.measureText(c).width);
      let px = -w / 2;
      [...txt].forEach((c, i) => {
        g.strokeText(c, px + ws[i] / 2, 0);
        px += ws[i];
      });
      px = -w / 2;
      [...txt].forEach((c, i) => {
        g.fillText(c, px + ws[i] / 2, 0);
        px += ws[i];
      });
      g.restore();
      return true;
    };
    // solo los puertos llevan nombre: debajo del icono (si no cabe, encima)
    map.tiles.forEach(t => {
      if (!t.nombre) return;
      const x = LX(t.wx), y = LY(t.wz), big = t.lugar === 'puerto_principal';
      put(t.nombre, x, y + LS * (big ? 0.78 : 0.68), LS * (big ? 0.27 : 0.22)) || put(t.nombre, x, y - LS * 0.78, LS * (big ? 0.27 : 0.22));
    });
  }

  /* ---------- Agua animada (WebGL) ---------- */
  // (si no hay WebGL, initGL lo detecta y el agua se queda quieta; el resto solo se usa con glOK)
  const gl = glc.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext;
  let prog!: WebGLProgram;
  const U: Record<string, WebGLUniformLocation> = {}, T: Record<string, WebGLTexture> = {};
  function voronoiData(seed: number, n: number) {
    const S_ = 128, pts: number[][] = [], d = new Uint8Array(S_ * S_ * 4), k = Math.sqrt(n);
    for (let i = 0; i < n; i++) pts.push([hash(i, seed, 1), hash(i, seed, 2)]);
    for (let y = 0; y < S_; y++)
      for (let x = 0; x < S_; x++) {
        const u = (x + 0.5) / S_, v = (y + 0.5) / S_;
        let f1 = 9, f2 = 9;
        for (const p of pts)
          for (let ox = -1; ox <= 1; ox++)
            for (let oy = -1; oy <= 1; oy++) {
              const dd = Math.hypot(p[0] + ox - u, p[1] + oy - v);
              if (dd < f1) {
                f2 = f1;
                f1 = dd;
              } else if (dd < f2) f2 = dd;
            }
        const val = Math.pow(Math.max(0, 1 - ((f2 - f1) * k) / 0.42), 1.5) * 255, o = (y * S_ + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = val;
        d[o + 3] = 255;
      }
    return d;
  }
  function mkTex(unit: number, repeat = false) {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  function initGL() {
    if (!gl) return false;
    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, src);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? 'sombreador');
      return o;
    };
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, SOMBREADOR_DE_VERTICES));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, SOMBREADOR_DEL_AGUA));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'programa');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uBase', 'uDecor', 'uSD', 'uKind', 'uA', 'uB', 'uRes', 'uL', 'uSDsz', 'uGrid', 'uDet', 'uDetR', 'uDetOn', 'uView', 'uO', 'uT', 'uPxU', 'uCoastW', 'uCaus'].forEach(
      n => (U[n] = gl.getUniformLocation(prog, n)!),
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    T['base'] = mkTex(0);
    T['decor'] = mkTex(1);
    T['sd'] = mkTex(2);
    T['kind'] = mkTex(3);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    T['a'] = mkTex(4, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, voronoiData(11, 9));
    T['b'] = mkTex(5, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, voronoiData(23, 11));
    T['det'] = mkTex(6);
    [['uBase', 0], ['uDecor', 1], ['uSD', 2], ['uKind', 3], ['uA', 4], ['uB', 5], ['uDet', 6]].forEach(([n, i]) => gl.uniform1i(U[n as string], i as number));
    return true;
  }
  let glOK = false;
  function uploadGL() {
    if (!glOK) return;
    const up = (unit: number, t: WebGLTexture, src: HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    };
    up(0, T['base'], layer);
    up(1, T['decor'], decor);
    // una celda por casilla: r = alta mar, g = parte del mapa
    const kb = new Uint8Array(map.cols * map.rows * 4);
    map.tiles.forEach(t => {
      const o = (t.r * map.cols + t.c) * 4;
      kb[o] = t.terreno === 'alta_mar' ? 255 : 0;
      kb[o + 1] = 255;
      kb[o + 3] = 255;
    });
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, T['kind']);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, map.cols, map.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, kb);
    const b = new Uint8Array(SD.w * SD.h);
    for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(((SD.d[i] - SD_MIN) / SD_RANGE) * 255)));
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, T['sd']);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SD.w, SD.h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, b);
    gl.uniform2f(U['uL'], LW, LH);
    gl.uniform2f(U['uSDsz'], SD.w * SD.f, SD.h * SD.f);
    gl.uniform2f(U['uGrid'], map.cols, map.rows);
    gl.uniform3f(U['uO'], LOX, LOY, LS);
  }
  function drawGL() {
    const k = view.z / Q;
    gl.viewport(0, 0, glc.width, glc.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U['uRes'], glc.width, glc.height);
    gl.uniform3f(U['uView'], view.x * DPR, view.y * DPR, k);
    gl.uniform1f(U['uDetOn'], det ? 1 : 0);
    if (det) gl.uniform4f(U['uDetR'], det.x0, det.y0, det.x1, det.y1);
    gl.uniform1f(U['uT'], time);
    gl.uniform1f(U['uPxU'], LS * k);
    gl.uniform1f(U['uCoastW'], Math.max(1.3, LS * 0.017 * k));
    gl.uniform1f(U['uCaus'], 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- Barco 3D ---------- */
  let s3: Barco3D | null = null;

  /* ---------- Detalle al hacer zoom ----------
     La capa a tinta (árboles, iconos, nombres) es dibujo vectorial: al acercar la cámara y pararte,
     se vuelve a dibujar solo la zona visible a la resolución real de la pantalla (nunca se ve pixelada). */
  function scheduleDetail() {
    clearTimeout(detTimer);
    detTimer = window.setTimeout(renderDetail, 160);
  }
  function renderDetail() {
    if (destruido) return;
    const k = view.z / Q;
    if (k < 1.05 || !layer) {
      det = null;
      return;
    }
    let [x0, y0] = toLayer(0, 0), [x1, y1] = toLayer(W, H);
    const mx = (x1 - x0) * 0.12, my = (y1 - y0) * 0.12;
    x0 = Math.max(0, x0 - mx);
    y0 = Math.max(0, y0 - my);
    x1 = Math.min(LW, x1 + mx);
    y1 = Math.min(LH, y1 + my);
    if (x1 <= x0 || y1 <= y0) {
      det = null;
      return;
    }
    const sc = Math.min(k, 4096 / (x1 - x0), 4096 / (y1 - y0)), w = Math.ceil((x1 - x0) * sc), h = Math.ceil((y1 - y0) * sc);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = contexto2d(c);
    g.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    drawDecor(g);
    det = { c, x0, y0, x1, y1 };
    if (glOK) {
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, T['det']);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    }
  }

  /* ---------- Vista y dibujo por fotograma ---------- */
  function resize() {
    const b = cv.getBoundingClientRect();
    W = Math.max(1, b.width);
    H = Math.max(1, b.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    Q = 1.25;
    glc.width = cv.width;
    glc.height = cv.height;
    s3?.redimensionar(W, H, DPR);
  }
  const toLayer = (sx: number, sy: number) => [((sx - view.x) / view.z) * DPR * Q, ((sy - view.y) / view.z) * DPR * Q];
  let last = 0;
  function frame(ts: number) {
    if (destruido) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    if (!reduce) time = ts / 1000;
    // barco
    if (ship.path.length) {
      const tg = ship.path[0], dx = tg.wx - ship.x, dz = tg.wz - ship.z, d = Math.hypot(dx, dz), st = 2.2 * dt;
      if (Math.abs(dx) > 0.01) ship.dir = dx > 0 ? 1 : -1;
      if (d > 0.001) {
        let df = Math.atan2(dx, dz) - ship.yaw;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        ship.yaw += df * Math.min(1, dt * 6);
      }
      if (d <= st) {
        ship.x = tg.wx;
        ship.z = tg.wz;
        ship.path.shift();
        if (!ship.path.length) ship.dest = null;
      } else {
        ship.x += (dx / d) * st;
        ship.z += (dz / d) * st;
      }
    }
    // monigote: anda a saltitos (el balanceo)
    if (walker) moverAndarin(walker, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const k = view.z / Q;
    ctx.setTransform(k, 0, 0, k, view.x * DPR, view.y * DPR);
    if (glOK) drawGL();
    else {
      // sin WebGL: pergamino estático
      ctx.drawImage(layer, 0, 0);
      ctx.drawImage(decor, 0, 0);
      if (det) ctx.drawImage(det.c, det.x0, det.y0, det.x1 - det.x0, det.y1 - det.y0);
    }
    const L = LS;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (grid) {
      ctx.strokeStyle = 'rgba(58,39,23,.2)';
      ctx.lineWidth = Math.max(1, L * 0.01);
      ctx.setLineDash([L * 0.05, L * 0.06]);
      map.tiles.forEach(t => {
        hexPath(ctx, LX(t.wx), LY(t.wz), L);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    if (marcas) drawMarcasDePrueba(L);
    if (hover) {
      ctx.strokeStyle = 'rgba(58,39,23,.75)';
      ctx.lineWidth = Math.max(1.5, L * 0.022);
      ctx.setLineDash([L * 0.1, L * 0.07]);
      hexPath(ctx, LX(hover.wx), LY(hover.wz), L * 0.93);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // casillas bloqueadas (roca) y aldeas ofendidas (X roja)
    drawMarcasDelMapa(L);
    // casillas donde embarcar o desembarcar: borde amarillo discontinuo (decidido por el autor el 21-nov)
    if (embarques.length) {
      // primero un trazo oscuro continuo (para que el amarillo se lea sobre la arena) y encima el amarillo
      embarques.forEach(t => {
        hexPath(ctx, LX(t.wx), LY(t.wz), L * 0.86);
        ctx.strokeStyle = 'rgba(58,39,23,.55)';
        ctx.lineWidth = Math.max(2.5, L * 0.075);
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.strokeStyle = AMARILLO;
        ctx.lineWidth = Math.max(1.5, L * 0.045);
        ctx.setLineDash([L * 0.12, L * 0.08]);
        ctx.lineDashOffset = -time * L * 0.25;
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // casillas a las que se puede viajar: borde rojo discontinuo que "respira"
    if (destinos.length) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(1.5, L * 0.035);
      ctx.setLineDash([L * 0.12, L * 0.08]);
      ctx.lineDashOffset = -time * L * 0.25;
      destinos.forEach(t => {
        hexPath(ctx, LX(t.wx), LY(t.wz), L * 0.86);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    if (tipoBarco === '2d' && barco2d.complete && barco2d.naturalWidth) {
      if (barco3dPintado) {
        s3?.limpiar();
        barco3dPintado = false;
      }
      drawShip2D(L);
    } else if (s3 && s3.listo()) {
      barco3dPintado = true;
      ctx.fillStyle = 'rgba(30,40,50,.22)';
      ctx.beginPath();
      ctx.ellipse(LX(ship.x) + L * 0.05, LY(ship.z) + L * 0.12, L * 0.34, L * 0.16, 0, 0, 6.283);
      ctx.fill();
      const sx = (LX(ship.x) * k) / DPR + view.x, sy = (LY(ship.z) * k) / DPR + view.y;
      s3.dibujar(sx, sy, (LS * k) / DPR, ship.yaw, time, reduce);
    } else drawShip(ctx, LX(ship.x), LY(ship.z), L * 0.42, ship.dir);
    if (walker) drawAndarin(walker, L);
    rafId = requestAnimationFrame(frame);
  }

  // Marcas solo para las pruebas (se quitarán): zonas de eventos de barco y casilla de inicio.
  function drawMarcasDePrueba(L: number) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = Math.max(1.5, L * 0.03);
    ctx.setLineDash([L * 0.08, L * 0.07]);
    map.tiles.forEach(t => {
      if (!t.eventosDeBarco) return;
      ctx.beginPath();
      ctx.arc(LX(t.wx), LY(t.wz), L * 0.55, 0, 6.283);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    const ini = map.tiles.find(t => t.inicio);
    if (ini) {
      const x = LX(ini.wx), y = LY(ini.wz);
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(2, L * 0.05);
      ctx.setLineDash([L * 0.12, L * 0.08]);
      hexPath(ctx, x, y, L * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `italic ${L * 0.42}px 'IM Fell English',serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = L * 0.07;
      ctx.strokeStyle = 'rgba(236,222,180,.9)';
      ctx.strokeText('Inicio', x, y);
      ctx.fillStyle = RED;
      ctx.fillText('Inicio', x, y);
    }
  }

  /* El barco 2D: un dibujo plano de perfil. Para que parezca que flota (sin girar como el 3D):
     sube y baja despacio, se balancea desde la línea de flotación, se da la vuelta según hacia dónde
     navega, y a su alrededor salen ondas de espuma (y una estela detrás cuando se mueve). */
  const FLOTACION_2D = 200 / 300; // altura de la línea de flotación dentro del dibujo (Ship.png)
  function drawShip2D(L: number) {
    const x = LX(ship.x), y = LY(ship.z) + L * 0.12, t = reduce ? 0 : time, moving = ship.path.length > 0;
    const size = L * 1.75, bob = Math.sin(t * 1.6) * L * 0.035;
    const roll = Math.sin(t * 1.25) * 0.045 + (moving ? Math.sin(t * 3.1) * 0.02 : 0);
    // sombra en el agua
    ctx.fillStyle = 'rgba(30,40,50,.2)';
    ctx.beginPath();
    ctx.ellipse(x + L * 0.04, y + L * 0.03, L * 0.5, L * 0.11, 0, 0, 6.283);
    ctx.fill();
    // ondas de espuma que salen del casco y se desvanecen
    ctx.lineWidth = Math.max(1, L * 0.022);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.45 + k * 0.5) % 1, rx = L * (0.42 + ph * 0.4);
      ctx.strokeStyle = `rgba(237,229,209,${((1 - ph) * 0.75).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.25, 0, 0, 6.283);
      ctx.stroke();
    }
    // estela detrás (la popa está al lado contrario de hacia donde va)
    if (moving) {
      const popa = -ship.dir;
      ctx.strokeStyle = 'rgba(237,229,209,.7)';
      ctx.lineWidth = Math.max(1, L * 0.03);
      ctx.setLineDash([L * 0.09, L * 0.07]);
      ctx.lineDashOffset = time * L * 0.4 * ship.dir;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + popa * L * 0.45, y + lado * L * 0.03);
        ctx.quadraticCurveTo(x + popa * L * 0.8, y + lado * L * 0.1, x + popa * L * 1.15, y + lado * L * 0.2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // el barco: girado desde la línea de flotación; el dibujo mira a la izquierda, así que se voltea al ir a la derecha
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(roll);
    ctx.scale(ship.dir > 0 ? -1 : 1, 1);
    ctx.drawImage(barco2d, -size / 2, -size * FLOTACION_2D, size, size);
    ctx.restore();
  }

  /* Rocas en las casillas bloqueadas y una X roja (como trazada a mano) en las aldeas ofendidas. */
  function drawMarcasDelMapa(L: number) {
    for (const c of marcasDelMapa.bloqueadas) {
      const t = at(c.col, c.fila);
      if (t) icon(ctx, ICONO_BLOQUEADA, LX(t.wx), LY(t.wz) - L * 0.05, L * 1.5, false);
    }
    ctx.strokeStyle = RED;
    ctx.lineWidth = Math.max(2, L * 0.08);
    for (const c of marcasDelMapa.ofendidas) {
      const t = at(c.col, c.fila);
      if (!t) continue;
      const x = LX(t.wx), y = LY(t.wz), s = L * 0.42;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.9);
      ctx.quadraticCurveTo(x, y + s * 0.05, x + s, y + s * 0.95);
      ctx.moveTo(x + s * 0.95, y - s);
      ctx.quadraticCurveTo(x + s * 0.05, y, x - s * 0.9, y + s * 0.9);
      ctx.stroke();
    }
  }

  /* ---------- El monigote andando: el balanceo (pedido por el autor el 21-nov; cuentas en balanceo.ts) ----------
     Cruza de una casilla a otra en BALANCEO.pasosPorCasilla saltitos. Solo avanza en el aire; la
     dirección (hacia dónde mira) solo cambia al empezar un tramo, es decir, al aterrizar; para pararse
     termina el paso que está dando y se queda de pie. */
  function nuevoAndarin(x: number, z: number): Andarin {
    return { x, z, path: [], dir: 1, andando: false, desdeX: x, desdeZ: z, destino: null, pasos: 1, hechos: 0, p: 0, paso: 0 };
  }
  function empezarTramo(w: Andarin) {
    const tg = w.path[0], dx = tg.wx - w.x, dz = tg.wz - w.z;
    w.desdeX = w.x;
    w.desdeZ = w.z;
    w.destino = tg;
    w.pasos = Math.max(1, Math.round(Math.hypot(dx, dz) / (R3 / BALANCEO.pasosPorCasilla)));
    w.hechos = 0;
    if (Math.abs(dx) > 0.01) w.dir = dx > 0 ? 1 : -1;
    w.andando = true;
  }
  function moverAndarin(w: Andarin, dt: number) {
    if (!w.andando) {
      if (!w.path.length) return;
      empezarTramo(w);
    }
    w.p += dt / BALANCEO.periodo;
    while (w.andando && w.p >= 1) {
      w.p -= 1;
      w.hechos++;
      w.paso++;
      if (w.hechos < w.pasos) continue;
      // ha llegado al final del tramo
      const tg = w.destino!;
      w.x = tg.wx;
      w.z = tg.wz;
      if (w.path[0] === tg) w.path.shift();
      if (w.path.length) empezarTramo(w); // sigue andando (hacia otra casilla) sin pararse
      else {
        w.andando = false;
        w.p = 0;
      }
    }
    if (!w.andando || !w.destino) return;
    const k = (w.hechos + poseDelBalanceo(w.p, w.paso).avance) / w.pasos;
    w.x = w.desdeX + (w.destino.wx - w.desdeX) * k;
    w.z = w.desdeZ + (w.destino.wz - w.desdeZ) * k;
  }
  function drawAndarin(w: Andarin, L: number) {
    if (!monigote) {
      // mientras carga el dibujo (o si falta), el pirata a tinta de antes
      drawMonigote(LX(w.x), LY(w.z), L, w.dir, w.andando);
      return;
    }
    const pose = w.andando && !reduce ? poseDelBalanceo(w.p, w.paso) : POSE_QUIETA;
    // el dibujo lleva el contorno alrededor: se calcula la escala con la altura sin el contorno
    const escala = (L * ALTO_DEL_MONIGOTE) / (monigote.height - margenDelMonigote * 2);
    const alto = monigote.height * escala, ancho = monigote.width * escala, margen = margenDelMonigote * escala;
    const x = LX(w.x), pie = LY(w.z) + L * 0.45, salto = pose.alto * (alto - margen * 2);
    ctx.save();
    const rx = L * 0.5, ry = L * 0.2;
    // sombra en el suelo (se encoge un poco mientras salta)
    const sombra = 1 - (pose.alto / BALANCEO.altura) * 0.25;
    ctx.fillStyle = 'rgba(30,20,10,.35)';
    ctx.beginPath();
    ctx.ellipse(x, pie, rx * 0.6 * sombra, ry * 0.55 * sombra, 0, 0, 6.283);
    ctx.fill();
    // gira y escala desde los pies (el centro de la base del dibujo, sin contar el contorno)
    ctx.translate(x, pie - salto);
    ctx.rotate(((pose.giro * Math.PI) / 180) * w.dir);
    ctx.scale(pose.escalaX * w.dir, pose.escalaY);
    ctx.drawImage(monigote, -ancho / 2, -alto + margen, ancho, alto);
    ctx.restore();
  }

  /* El monigote de reserva: un pirata minimalista a tinta (provisional, decidido por el autor el 20-nov).
     Sale mientras carga el dibujo del personaje.
     Sombrero de tres picos, parche, fajín rojo y sable. Mira hacia donde anda y mueve las piernas. */
  function drawMonigote(x: number, y: number, L: number, dir: number, andando: boolean) {
    const s = L * 0.5, t = reduce ? 0 : time, paso = andando ? Math.sin(t * 12) : 0;
    const pie = y + s * 0.5;
    ctx.save();
    // sombra
    ctx.fillStyle = 'rgba(30,40,50,.22)';
    ctx.beginPath();
    ctx.ellipse(x, pie, s * 0.38, s * 0.1, 0, 0, 6.283);
    ctx.fill();
    ctx.translate(x, pie);
    ctx.scale(dir, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const trazo = (ancho: number) => {
      // primero un borde de papel (para que se lea sobre los árboles) y luego la tinta
      ctx.strokeStyle = 'rgba(236,222,180,.9)';
      ctx.lineWidth = ancho + s * 0.09;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ancho;
      ctx.stroke();
    };
    // piernas
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(-s * 0.13 + paso * s * 0.12, 0);
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(s * 0.13 - paso * s * 0.12, 0);
    trazo(s * 0.07);
    // sable (a la espalda, asomando)
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.45);
    ctx.lineTo(-s * 0.42, -s * 0.15);
    trazo(s * 0.04);
    // cuerpo (camisa clara) y fajín rojo
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, -s * 0.36);
    ctx.lineTo(-s * 0.13, -s * 0.78);
    ctx.lineTo(s * 0.13, -s * 0.78);
    ctx.lineTo(s * 0.17, -s * 0.36);
    ctx.closePath();
    ctx.fillStyle = '#efe2bf';
    ctx.fill();
    trazo(s * 0.05);
    ctx.fillStyle = RED;
    ctx.fillRect(-s * 0.16, -s * 0.5, s * 0.32, s * 0.08);
    // brazo
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.72);
    ctx.lineTo(s * 0.28, -s * 0.5 - paso * s * 0.06);
    trazo(s * 0.06);
    // cabeza
    ctx.beginPath();
    ctx.arc(0, -s * 0.93, s * 0.16, 0, 6.283);
    ctx.fillStyle = '#e9c9a0';
    ctx.fill();
    trazo(s * 0.045);
    // parche
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 1.01);
    ctx.lineTo(s * 0.15, -s * 0.95);
    ctx.strokeStyle = INK;
    ctx.lineWidth = s * 0.03;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(s * 0.07, -s * 0.95, s * 0.045, 0, 6.283);
    ctx.fill();
    // sombrero de tres picos
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 1.03);
    ctx.quadraticCurveTo(0, -s * 1.42, s * 0.3, -s * 1.03);
    ctx.quadraticCurveTo(0, -s * 1.13, -s * 0.3, -s * 1.03);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,222,180,.9)';
    ctx.lineWidth = s * 0.04;
    ctx.stroke();
    ctx.restore();
  }

  // el barco dibujado a tinta (mientras carga el 3D, o si no hay WebGL)
  function drawShip(g: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number) {
    g.save();
    g.translate(x, y);
    g.rotate(reduce ? 0 : Math.sin(time * 1.8) * 0.05);
    g.scale(dir, 1);
    g.lineWidth = Math.max(1, s * 0.06);
    g.strokeStyle = 'rgba(58,39,23,.5)';
    g.beginPath();
    g.moveTo(-s * 1.1, s * 0.32);
    g.quadraticCurveTo(-s * 0.5, s * 0.22, 0, s * 0.34);
    g.quadraticCurveTo(s * 0.5, s * 0.44, s * 1.1, s * 0.3);
    g.stroke();
    g.strokeStyle = INK;
    g.fillStyle = '#6b4423';
    g.beginPath();
    g.moveTo(-s * 0.95, 0);
    g.lineTo(s * 0.95, -s * 0.06);
    g.quadraticCurveTo(s * 0.75, s * 0.3, s * 0.35, s * 0.32);
    g.lineTo(-s * 0.6, s * 0.32);
    g.quadraticCurveTo(-s * 0.9, s * 0.2, -s * 0.95, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.03);
    g.lineTo(-s * 0.1, -s * 1.15);
    g.moveTo(s * 0.45, -s * 0.05);
    g.lineTo(s * 0.45, -s * 0.85);
    g.stroke();
    g.fillStyle = '#efe2bf';
    const sail = (mx: number, top: number, bot: number, w: number) => {
      g.beginPath();
      g.moveTo(mx - w, top);
      g.quadraticCurveTo(mx + w * 0.25, top + (bot - top) / 2, mx - w, bot);
      g.lineTo(mx + w, bot);
      g.quadraticCurveTo(mx + w * 1.35, top + (bot - top) / 2, mx + w, top);
      g.closePath();
      g.fill();
      g.stroke();
    };
    sail(-s * 0.1, -s * 1.0, -s * 0.2, s * 0.32);
    sail(s * 0.45, -s * 0.75, -s * 0.22, s * 0.24);
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 1.15);
    g.lineTo(-s * 0.1 + s * 0.3, -s * 1.08);
    g.lineTo(-s * 0.1, -s * 1.0);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* ---------- Navegación de prueba (el barco va libre por el agua; las reglas llegarán después) ---------- */
  function route(from: CasillaPintable, to: CasillaPintable) {
    const prev = new Map<CasillaPintable, CasillaPintable | null>([[from, null]]), q = [from];
    while (q.length) {
      const c = q.shift()!;
      if (c === to) break;
      for (const n of nbrs(c))
        if (n && n.agua && !prev.has(n)) {
          prev.set(n, c);
          q.push(n);
        }
    }
    if (!prev.has(to)) return null;
    const p: CasillaPintable[] = [];
    for (let c: CasillaPintable | null | undefined = to; c && c !== from; c = prev.get(c)) p.unshift(c);
    return p;
  }
  function tileAt(lx: number, ly: number): CasillaPintable | null {
    const wx = (lx - LOX) / LS, wz = (ly - LOY) / LS;
    let b: CasillaPintable | null = null, bd = 1e9;
    for (const t of map.tiles) {
      const d = (t.wx - wx) ** 2 + (t.wz - wz) ** 2;
      if (d < bd) {
        bd = d;
        b = t;
      }
    }
    return bd < 1.05 ? b : null;
  }
  function nearestTile(x: number, z: number): CasillaPintable {
    let b: CasillaPintable = map.tiles[0], bd = 1e9;
    for (const t of map.tiles) {
      const d = (t.wx - x) ** 2 + (t.wz - z) ** 2;
      if (d < bd) {
        bd = d;
        b = t;
      }
    }
    return b;
  }
  function tap(sx: number, sy: number) {
    const [lx, ly] = toLayer(sx, sy);
    const t = tileAt(lx, ly);
    if (!t) return;
    const titulo = t.lugar ? NOMBRE_DE_LUGAR[t.lugar] + (t.nombre ? ' · ' + t.nombre : '') : NOMBRE_DE_TERRENO[t.terreno];
    const detalles: string[] = [];
    if (t.lugar) detalles.push(NOMBRE_DE_TERRENO[t.terreno].toLowerCase());
    detalles.push(`${t.c},${t.r}`);
    if (t.inicio) detalles.push('casilla de inicio');
    if (t.eventosDeBarco) detalles.push('zona de eventos de barco');
    if (marcasDelMapa.bloqueadas.some(c => c.col === t.c && c.fila === t.r)) detalles.push('bloqueada');
    if (marcasDelMapa.ofendidas.some(c => c.col === t.c && c.fila === t.r)) detalles.push('aquí no te quieren');
    if (opciones.modo === 'partida') {
      // la partida decide: si es una casilla elegible, se avisa (y quien usa el mapa viaja)
      const elegible = destinos.includes(t);
      const deEmbarque = !elegible && embarques.includes(t);
      if (elegible) detalles.push('viajas aquí');
      if (deEmbarque) detalles.push(t.agua ? 'subes al barco' : 'bajas aquí');
      info(titulo, ...detalles);
      if (elegible) opciones.alElegirCasilla?.({ col: t.c, fila: t.r });
      if (deEmbarque) opciones.alElegirEmbarque?.({ col: t.c, fila: t.r });
      return;
    }
    if (t.agua) {
      const p = route(nearestTile(ship.x, ship.z), t);
      if (p && p.length) {
        ship.path = p;
        detalles.push('rumbo fijado, ' + p.length + ' casillas');
      } else detalles.push(p ? 'ya estás aquí' : 'no hay paso');
    } else detalles.push('tierra firme, el barco no puede entrar');
    info(titulo, ...detalles);
  }

  /* ---------- Interacción: arrastrar para mover, rueda o pellizco para zoom ---------- */
  const ptrs = new Map<number, { x: number; y: number }>();
  let moved = 0, pinch = 0;
  /**
   * Acerca la vista al personaje (a pie, el monigote; a bordo, el barco) con ese zoom, lo más centrado
   * posible pero sin enseñar nada de fuera del mapa: si está cerca del borde, el borde del mapa se
   * queda pegado al borde de la pantalla y el personaje sale descentrado (pedido por el autor el 21-nov).
   */
  function enfocarAlPersonaje(z: number) {
    const wx = walker ? walker.x : ship.x, wz = walker ? walker.z : ship.z;
    const k = z / (Q * DPR); // de píxeles de capa a píxeles de pantalla
    // centrado, pero sin pasarse del borde (si el mapa cabe entero en ese lado, se centra el mapa)
    const ajustar = (centrado: number, desde: number, hasta: number, pantalla: number) => {
      const min = pantalla - hasta * k, max = -desde * k;
      return min > max ? (min + max) / 2 : Math.max(min, Math.min(max, centrado));
    };
    view = {
      z,
      x: ajustar(W / 2 - LX(wx) * k, LX(map.minx), LX(map.maxx), W),
      y: ajustar(H / 2 - LY(wz) * k, LY(map.minz), LY(map.maxz), H),
    };
    scheduleDetail();
  }
  function zoomAt(nz: number, sx: number, sy: number) {
    scheduleDetail();
    nz = Math.max(0.8, Math.min(6, nz));
    view.x = sx - ((sx - view.x) * nz) / view.z;
    view.y = sy - ((sy - view.y) * nz) / view.z;
    view.z = nz;
  }
  // coordenadas del puntero relativas al lienzo (el mapa puede no empezar en la esquina de la página)
  const rel = (e: PointerEvent | WheelEvent) => {
    const b = cv.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  function escuchar<K extends keyof HTMLElementEventMap>(el: HTMLElement, tipo: K, fn: (e: HTMLElementEventMap[K]) => void, opc?: AddEventListenerOptions) {
    el.addEventListener(tipo, fn, opc);
    limpiezas.push(() => el.removeEventListener(tipo, fn, opc));
  }
  escuchar(cv, 'pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, rel(e));
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2) {
      const a = [...ptrs.values()];
      pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      moved = 99;
    }
  });
  escuchar(cv, 'pointermove', e => {
    const p = ptrs.get(e.pointerId), q = rel(e);
    if (!p) {
      if (!layer) return;
      const [lx, ly] = toLayer(q.x, q.y);
      hover = tileAt(lx, ly) || null;
      return;
    }
    if (ptrs.size === 1) {
      const dx = q.x - p.x, dy = q.y - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      view.x += dx;
      view.y += dy;
      scheduleDetail();
    }
    p.x = q.x;
    p.y = q.y;
    if (ptrs.size === 2) {
      const a = [...ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      zoomAt((view.z * d) / pinch, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
      pinch = d;
    }
  });
  escuchar(cv, 'pointerup', e => {
    if (ptrs.size === 1 && moved < 6 && layer) {
      const q = rel(e);
      tap(q.x, q.y);
    }
    ptrs.delete(e.pointerId);
  });
  escuchar(cv, 'pointercancel', e => ptrs.delete(e.pointerId));
  escuchar(cv, 'pointerleave', () => (hover = null));
  escuchar(
    cv,
    'wheel',
    e => {
      e.preventDefault();
      const q = rel(e);
      zoomAt(view.z * (e.deltaY < 0 ? 1.12 : 0.9), q.x, q.y);
    },
    { passive: false },
  );
  let rt = 0;
  const alRedimensionar = () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      if (destruido || !map) return;
      resize();
      paint();
      // Con el hueco nuevo (p. ej. al plegar el panel), el pergamino se ha vuelto a pintar a otra
      // escala: se encuadra otra vez al personaje (después de pintar, que es cuando cambia la escala)
      // con el mismo zoom, sin enseñar nada de fuera del mapa.
      enfocarAlPersonaje(view.z);
    }, 250);
  };
  window.addEventListener('resize', alRedimensionar);
  limpiezas.push(() => window.removeEventListener('resize', alRedimensionar));
  // También cuando cambia el hueco del mapa sin cambiar la ventana (al plegar o desplegar el panel, 22-nov).
  if (typeof ResizeObserver !== 'undefined') {
    const observador = new ResizeObserver(alRedimensionar);
    observador.observe(cv);
    limpiezas.push(() => observador.disconnect());
  }

  /* ---------- Arranque ---------- */
  info('', 'Desplegando el pergamino…');
  resize();
  const fontsReady = Promise.race([
    Promise.all(["40px 'Pirata One'", "20px 'IM Fell English'", "italic 20px 'IM Fell English'"].map(f => document.fonts.load(f))),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  fontsReady.then(async () => {
    if (destruido) return;
    try {
      try {
        glOK = initGL();
      } catch (e) {
        console.warn('WebGL no disponible, agua estática', e);
        glOK = false;
      }
      try {
        s3 = crearBarco3D(lienzos.barco, opciones.rutaModeloBarco, opciones.rutaTexturaBarco);
        s3.redimensionar(W, H, DPR);
      } catch (e) {
        console.warn('Barco 3D no disponible', e);
      }
      await loadIcons();
      if (destruido) return;
      buildMap();
      paint();
      if (opciones.modo === 'partida') enfocarAlPersonaje(ZOOM_INICIAL);
      if (opciones.modo === 'partida') info('', 'Rojo: viajar (pulsa "Viajar…") · amarillo: subir o bajar del barco', 'arrastra para moverte');
      else info('', 'Toca el mar para fijar rumbo', 'arrastra para moverte');
      rafId = requestAnimationFrame(frame);
    } catch (err) {
      console.error(err);
      info('Error al dibujar el mapa', String((err as Error).message ?? err));
    }
  });

  return {
    cambiarRejilla: encendida => (grid = encendida),
    cambiarMarcasDePrueba: encendidas => (marcas = encendidas),
    cambiarBarco: tipo => (tipoBarco = tipo),
    cambiarMonigote: dibujo => cargarMonigote(dibujo),
    colocar: p => {
      posiciones = p;
      if (map) aplicarPosiciones(p);
    },
    cambiarDestinos: lista => {
      destinosPendientes = lista;
      if (map) destinos = lista.map(c => at(c.col, c.fila)).filter((t): t is CasillaPintable => !!t);
    },
    cambiarEmbarques: lista => {
      embarquesPendientes = lista;
      if (map) embarques = lista.map(c => at(c.col, c.fila)).filter((t): t is CasillaPintable => !!t);
    },
    cambiarMarcasDelMapa: m => (marcasDelMapa = m),
    cambiarMapa: nuevo => {
      if (nuevo === mapaDelJuego) return;
      mapaDelJuego = nuevo;
      if (!map || destruido) return;
      buildMap();
      paint();
    },
    acercar: () => zoomAt(view.z * 1.25, W / 2, H / 2),
    alejar: () => zoomAt(view.z / 1.25, W / 2, H / 2),
    centrar: () => {
      view = { z: 1, x: 0, y: 0 };
      scheduleDetail();
    },
    destruir() {
      destruido = true;
      cancelAnimationFrame(rafId);
      clearTimeout(detTimer);
      clearTimeout(rt);
      limpiezas.forEach(f => f());
      s3?.destruir();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
