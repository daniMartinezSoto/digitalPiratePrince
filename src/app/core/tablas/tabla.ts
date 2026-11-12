import type { EfectoDefinicion } from './efecto';

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
}

export interface Tabla {
  // Identificador único de la tabla, p. ej. "pesca".
  id: string;

  // Expresión de dados con la que se tira, p. ej. "1d6" o "3d6".
  dado: string;

  // Filas ordenadas, sin huecos ni solapes (lo comprobará el test de validación).
  filas: Fila[];
}