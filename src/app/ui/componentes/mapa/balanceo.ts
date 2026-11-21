// EL BALANCEO (pedido por el autor el 21-nov): cómo anda el monigote por el mapa.
// Se mueve como una ficha de juego de mesa: a saltitos, y en cada paso se inclina a un lado y al otro.
// Solo avanza mientras está en el aire; al aterrizar se queda quieto un instante (se aplasta un poco).
// Aquí solo están las cuentas (sin dibujar nada); el pintor del mapa las usa en cada fotograma.

/** Los números del balanceo. Para una ficha más rápida o más lenta, cambiar solo `periodo`. */
export const BALANCEO = {
  /** Segundos que dura un paso (un saltito). */
  periodo: 0.3,
  /** Saltitos para cruzar de una casilla a la vecina (cada paso avanza lo que falte repartido). */
  pasosPorCasilla: 4,
  /** Altura máxima del saltito, en proporción a la altura del dibujo. */
  altura: 0.075,
  /** Parte del paso que pasa en el aire (el resto está apoyado en el suelo). */
  enElAire: 0.7,
  /** Cuánto se estira en el aire y se aplasta al aterrizar. */
  estirar: 0.06,
  /** Inclinación máxima a cada lado, en grados. */
  inclinacion: 11,
} as const;

/** Cómo está el monigote en un momento del paso. */
export interface PoseDelBalanceo {
  /** Cuánto del paso ha avanzado ya (0 = donde empezó el paso, 1 = donde termina). */
  avance: number;
  /** Altura del salto, en proporción a la altura del dibujo (0 = en el suelo). */
  alto: number;
  escalaX: number;
  escalaY: number;
  /** Inclinación en grados (positivo = hacia delante, mirando a la derecha). */
  giro: number;
}

/** Quieto: de pie, sin inclinarse y sin estirar. */
export const POSE_QUIETA: PoseDelBalanceo = { avance: 0, alto: 0, escalaX: 1, escalaY: 1, giro: 0 };

/** Empieza despacio, acelera y frena al final. */
export function suavizar(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * La pose en un momento del paso.
 * @param p    progreso dentro del paso, de 0 a 1
 * @param paso número del paso (los pares se inclinan a un lado y los impares al otro)
 */
export function poseDelBalanceo(p: number, paso: number): PoseDelBalanceo {
  const { enElAire, estirar, altura, inclinacion } = BALANCEO;
  const giro = inclinacion * (paso % 2 === 1 ? 1 : -1) * Math.sin(Math.PI * p);
  if (p < enElAire) {
    // en el aire: arco hacia arriba, se estira un poco y avanza
    const t = p / enElAire;
    const s = estirar * 0.5 * Math.sin(Math.PI * t);
    return { avance: suavizar(t), alto: altura * 4 * t * (1 - t), escalaX: 1 - s * 0.6, escalaY: 1 + s, giro };
  }
  // apoyado: se aplasta al aterrizar y no avanza
  const u = (p - enElAire) / (1 - enElAire);
  const s = estirar * Math.sin(Math.PI * u);
  return { avance: 1, alto: 0, escalaX: 1 + s * 0.8, escalaY: 1 - s, giro };
}
