// Fases de un turno (un día), en el orden en que ocurren.
//   inicio:      actúan las condiciones activas (tormenta, el mal está a bordo...).
//   accion:      el jugador elige su acción y se resuelven sus eventos.
//   comida:      se come o se pasa hambre.
//   descanso:    dónde se pasa la noche.
// Después del descanso empieza el día siguiente, otra vez en "inicio".
export const FASES = ['inicio', 'accion', 'comida', 'descanso'] as const;
export type Fase = (typeof FASES)[number];
