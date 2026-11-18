import { AJUSTES } from '../ajustes/ajustes';
import type { Estado } from '../estado/estado';

// APUESTAS (jugar a los dados y echar un pulso, en la guarida). Se apuesta con botones:
// las cantidades de AJUSTES.apuestas (10, 25, 50, 100) o "todo" (todo el oro que lleva).

export type Apuesta = number | 'todo';

export interface BotonApuesta {
  apuesta: Apuesta;
  cantidad: number; // oro que se juega (con "todo", el que lleva ahora)
  disponible: boolean;
}

/** Solo consulta: los botones de apuesta, desactivados los que no puede pagar. */
export function opcionesDeApuesta(estado: Estado): BotonApuesta[] {
  const oro = estado.jugador.oro;
  return [
    ...AJUSTES.apuestas.map(cantidad => ({ apuesta: cantidad, cantidad, disponible: oro >= cantidad })),
    { apuesta: 'todo' as const, cantidad: oro, disponible: oro > 0 },
  ];
}

/** El oro que se juega con esa apuesta. Error si no es uno de los botones o no le llega el oro. */
export function cantidadApostada(estado: Estado, apuesta: Apuesta, que: string): number {
  const boton = opcionesDeApuesta(estado).find(b => b.apuesta === apuesta);
  if (!boton) {
    throw new Error(`${que}: la apuesta "${apuesta}" no existe (valen ${AJUSTES.apuestas.join(', ')} o "todo")`);
  }
  if (!boton.disponible) {
    throw new Error(`${que}: no le llega el oro para apostar ${boton.cantidad}`);
  }
  return boton.cantidad;
}

/** ¿Puede apostar algo? (Le llega al menos para la apuesta más pequeña... o tiene algo de oro para "todo".) */
export function puedeApostar(estado: Estado): boolean {
  return estado.jugador.oro > 0;
}
