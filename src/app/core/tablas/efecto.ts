// Recursos numéricos del jugador que una tabla (o un evento) puede modificar.
// Es un array (y de él sale el tipo) para poder recorrerlo en el test que valida las tablas.
export const RECURSOS = ['oro', 'comida', 'tripulacion', 'vida', 'fama'] as const;
export type TipoRecurso = (typeof RECURSOS)[number];

// Qué se hace con el recurso. Si no se escribe, es "sumar".
//   sumar  → suma la cantidad (negativa = perder):        { "tipo": "oro", "cantidad": 20 }
//   fijar  → deja el recurso en ese valor:                 { "tipo": "vida", "operacion": "fijar", "cantidad": 1 }
//   mitad  → lo deja en la mitad (te roban medio oro):     { "tipo": "oro", "operacion": "mitad" }
//   maximo → lo sube a su máximo (curarse del todo):       { "tipo": "vida", "operacion": "maximo" }
//   todo   → lo pierde entero (te lo quitan todo):         { "tipo": "comida", "operacion": "todo" }
// mitad, maximo y todo dependen de cuánto tienes, así que los resuelve aplicarEfectos (Sprint 4).
export const OPERACIONES = ['sumar', 'fijar', 'mitad', 'maximo', 'todo'] as const;
export type Operacion = (typeof OPERACIONES)[number];

// Los únicos recursos que tienen máximo (y por tanto admiten "maximo").
export const RECURSOS_CON_MAXIMO: readonly TipoRecurso[] = ['vida', 'tripulacion', 'comida'];

// A quién afecta. Si no se escribe, es "jugador". Solo tiene sentido para la vida
// (los seguidores no tienen oro, comida ni fama).
//   todos             → el jugador y todos los seguidores ("todo el grupo pierde 2 PV")
//   seguidor_azar     → un seguidor al azar
//   seguidor_elegido  → un seguidor que elige el jugador
export const DESTINOS = ['jugador', 'todos', 'seguidor_azar', 'seguidor_elegido'] as const;
export type Destino = (typeof DESTINOS)[number];

// Efectos que terminan la partida: muertes, "pierdes la partida" y las victorias
// alternativas (la isla misteriosa, la ciudad perdida).
export const FINES_DE_PARTIDA = ['ganar_partida', 'perder_partida'] as const;
export type FinDePartida = (typeof FINES_DE_PARTIDA)[number];

// En el JSON la cantidad es un número fijo (8, -1) o una expresión de dados
// ("2d6", "1d6x10", "1d6+1", "-1d6"). El signo menos delante = se pierde.
export type CantidadDefinicion = number | string;

// Efecto tal como se escribe en el JSON.
export type EfectoDefinicion =
  | {
      tipo: TipoRecurso;
      operacion?: 'sumar' | 'fijar';
      cantidad: CantidadDefinicion;
      destino?: Destino;
    }
  | {
      tipo: TipoRecurso;
      operacion: 'mitad' | 'maximo' | 'todo';
      destino?: Destino;
    }
  | {
      tipo: FinDePartida;
    };

// Efecto ya resuelto por resolverTabla: igual que en el JSON, pero la cantidad
// es siempre un número concreto (positivo = ganar, negativo = perder).
export type Efecto =
  | {
      tipo: TipoRecurso;
      operacion?: 'sumar' | 'fijar';
      cantidad: number;
      destino?: Destino;
    }
  | {
      tipo: TipoRecurso;
      operacion: 'mitad' | 'maximo' | 'todo';
      destino?: Destino;
    }
  | {
      tipo: FinDePartida;
    };
