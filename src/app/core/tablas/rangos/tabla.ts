import type { EfectoDefinicion } from '../efecto';

// REGLAS ESPECIALES de una fila: algo que no se puede escribir con efectos normales y que programa
// la acción que usa la tabla (buscar información). En el JSON: { ..., "especial": "haces_amigos" }.
//   haces_amigos: queda una marca "amigos" en la casilla: +1 la próxima vez que busques información
//                 (o des un discurso) allí. Se gasta al usarla.
//   cubil:        el cubil de contrabandistas solo se saquea una vez por casilla: la segunda vez
//                 está vacío y no da nada (sus efectos no se aplican).
//   fiesta:       fiesta de bienvenida en la aldea: ese día comes gratis y esa noche duermes allí gratis.
// Audiencias (las aplica solicitarAudiencia):
//   audiencia_concedida: te reciben. En este sitio ya no se puede volver a pedir audiencia en toda la partida.
//   audiencia_vetada:    le ofendes (o te reconoce un guardia): aquí no puedes volver a pedirla nunca.
//   audiencia_aplazada:  "hoy no": si vuelves a pedirla aquí MAÑANA, +1 (no se acumula; pasado mañana ya no vale).
export const ESPECIALES_DE_TABLA = [
  'haces_amigos',
  'cubil',
  'fiesta',
  'audiencia_concedida',
  'audiencia_vetada',
  'audiencia_aplazada',
] as const;
export type EspecialDeTabla = (typeof ESPECIALES_DE_TABLA)[number];

// Una fila cubre un rango de resultados del dado, ambos extremos incluidos.
export interface Fila {
  min: number;
  max: number;

  // Texto que describe lo que pasa ("No pescas nada"). Opcional.
  texto?: string;

  // Efectos sobre el jugador, tal como se escriben en el JSON.
  efectos?: EfectoDefinicion[];

  // Id del evento al que lleva esta fila, con nombre (p. ej. "taberna_clandestina").
  // Es un salto del motor de eventos, no un efecto sobre el estado.
  evento?: string;

  // Regla especial de la fila (ver ESPECIALES_DE_TABLA). Sin ponerla = ninguna.
  especial?: EspecialDeTabla;

  // Solo para cotejar con el PDF mientras se pasan los eventos (p. ej. "E081"). Se borrará.
  libro?: string;
}

export interface Tabla {
  // Identificador único de la tabla, p. ej. "pesca".
  id: string;

  // Expresión de dados con la que se tira, p. ej. "1d6" o "3d6".
  dado: string;

  // Filas ordenadas, sin huecos ni solapes (lo comprobará el test de validación).
  filas: Fila[];
}