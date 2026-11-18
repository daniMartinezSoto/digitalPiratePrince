import type { Dados } from '../dados/dados';
import type { Cambio } from '../efectos/cambio';
import type { Estado } from '../estado/estado';
import type { Lugar, Rasgo } from '../turno/lugar';

// LA FASE DE ACCIÓN. Cada día el jugador hace UNA acción (pescar, cazar, reposar...).
// Todas las acciones siguen el mismo molde:
//   1. comprobarQueSePuedeActuar: la partida sigue y está en la fase "accion".
//   2. Hacen lo suyo y aplican sus efectos con aplicarEfectos (no tocan el estado recibido).
//   3. cerrarFaseDeAccion: la partida pasa a la fase "comida".
// Devuelven datos, no mensajes: la interfaz decide cómo contarlo.

// Acciones que existen por ahora. (Viajar, buscar información, contratar... irán llegando.)
// "reposar" es la ACCIÓN de pasar el día recuperándose (core/acciones/reposar.ts).
// "ir_al_mercado": entrar en el mercado de un puerto (core/mercado/mercado.ts).
// "dar_discurso", "contratar_marineros", "buscar_seguidor": las tres formas de contratar en un
// puerto (core/contratar/contratar.ts). Cada día solo una: son acciones distintas.
// "rezar", "descansar_en_monasterio": las dos acciones del monasterio (core/monasterio/monasterio.ts).
// "enterrar_tesoro": 100 de oro = 1 de fama, en tierra salvaje (core/acciones/enterrar-tesoro.ts).
// "buscar_informacion": en puertos y aldeas, con su tabla 3d6 (core/acciones/buscar-informacion.ts).
// "solicitar_audiencia": con el gobernador, el jefe de la aldea o el capitán pirata (core/acciones/audiencia.ts).
// "jugar_a_los_dados", "echar_un_pulso": exclusivas de las guaridas piratas (core/guarida/).
// "investigar_naufragio", "registrar_ruinas": una vez por casilla (core/acciones/explorar.ts).
// "mendigar": la da el artista, en puertos y guaridas (core/acciones/mendigar.ts).
// No confundir con la FASE de descanso, que es dormir por la noche (core/turno/descansar.ts):
// son dos cosas distintas y por eso tienen nombres distintos.
export const ACCIONES = ['pescar', 'cazar', 'reposar', 'ir_al_mercado', 'dar_discurso', 'contratar_marineros', 'buscar_seguidor', 'rezar', 'descansar_en_monasterio', 'enterrar_tesoro', 'buscar_informacion', 'solicitar_audiencia', 'jugar_a_los_dados', 'echar_un_pulso', 'investigar_naufragio', 'registrar_ruinas', 'mendigar'] as const;
export type IdAccion = (typeof ACCIONES)[number];

/**
 * Dónde está el jugador, visto desde las acciones. Hasta que exista el mapa (Sprint 9),
 * lo dice quien llama; después lo calculará el mapa.
 */
export interface Sitio {
  lugar: Lugar;
  // En qué casilla del mapa está. Lo dirá el mapa (Sprint 9); hasta entonces es opcional.
  // Lo usan las reglas que recuerdan cosas por casilla (un tesoro enterrado por hexágono):
  // sin casilla, esas reglas no pueden comprobar nada y no limitan.
  hex?: { col: number; fila: number };
  // Rasgo de la casilla (naufragio, ruinas...), si tiene. Lo dirá el mapa; hasta entonces es opcional.
  rasgo?: Rasgo;
  // En tierra: ¿hay agua en una casilla de al lado? (Para pescar desde la orilla.)
  // A bordo no hace falta ponerlo: el barco siempre está en el agua.
  juntoAlAgua?: boolean;
}

/** La tirada que se ha hecho en la tabla de la acción, para enseñarla. */
export interface TiradaDeAccion {
  dados: number[];     // lo que ha salido en cada dado
  modificador: number; // bonificadores del jugador
  total: number;       // dados + modificador
  texto?: string;      // texto de la fila que ha tocado ("Buena pesca.")
}

/** Lo que devuelve cualquier acción. */
export interface ResultadoAccion {
  estado: Estado;
  cambios: Cambio[];        // cambios reales (comida ganada, vida perdida...)
  tirada?: TiradaDeAccion;  // si la acción tira en una tabla
  eventos: string[];        // ids de eventos pendientes (hasta que exista el motor de eventos)
}

/**
 * Paso 1 del molde: si la partida ha terminado, no es la fase de acción o hay una acción a medias
 * (dentro del mercado, eligiendo marineros...: la acción de hoy ya está elegida), error.
 */
export function comprobarQueSePuedeActuar(estado: Estado, accion: string): void {
  if (estado.mundo.finPartida) {
    throw new Error(`${accion}: la partida ya ha terminado`);
  }
  if (estado.mundo.fase !== 'accion') {
    throw new Error(`${accion}: solo se puede hacer en la fase "accion" (la partida está en "${estado.mundo.fase}")`);
  }
  if (estado.mundo.accionEnCurso) {
    throw new Error(`${accion}: hay una acción a medias ("${estado.mundo.accionEnCurso.tipo}"); primero hay que terminarla`);
  }
}

/** Paso 3 del molde: la acción ha terminado; toca comer. Apunta por dónde van los dados. */
export function cerrarFaseDeAccion(estado: Estado, dados: Dados): Estado {
  return { ...estado, mundo: { ...estado.mundo, fase: 'comida', estadoDados: dados.obtenerEstado() } };
}
