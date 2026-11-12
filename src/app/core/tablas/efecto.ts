// Recursos numéricos del jugador que una tabla puede modificar.
// Es un array (y de él sale el tipo) para poder recorrerlo en el test que valida las tablas.
export const RECURSOS = ['oro', 'comida', 'tripulacion', 'vida', 'fama'] as const;
export type TipoRecurso = (typeof RECURSOS)[number];

// En el JSON la cantidad es un número fijo (8) o una expresión de dados ("2d6", "1d6x10").
export type CantidadDefinicion = number | string;

// Efecto tal como se escribe en el JSON.
export type EfectoDefinicion =
  | {
      tipo: TipoRecurso;
      cantidad: CantidadDefinicion;
    }
  | {
      // Depende del estado (cuánto oro lleva el jugador): lo resolverá aplicarEfectos (Sprint 4).
      tipo: 'perder_mitad_oro';
    };

// Efecto ya resuelto por resolverTabla: la cantidad es siempre un número concreto.
// Positivo = ganar, negativo = perder.
export type Efecto =
  | {
      tipo: TipoRecurso;
      cantidad: number;
    }
  | {
      tipo: 'perder_mitad_oro';
    };