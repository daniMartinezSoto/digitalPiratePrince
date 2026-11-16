// Fases de un turno (un día), en el orden en que ocurren.
//   inicio:      actúan las condiciones activas (tormenta, el mal está a bordo...).
//   accion:      el jugador elige su acción y se resuelven sus eventos.
//   comida:      se come o se pasa hambre.
//   alojamiento: dónde se pasa la noche.
// Después del alojamiento empieza el día siguiente, otra vez en "inicio".
export const FASES = ['inicio', 'accion', 'comida', 'alojamiento'] as const;
export type Fase = (typeof FASES)[number];
