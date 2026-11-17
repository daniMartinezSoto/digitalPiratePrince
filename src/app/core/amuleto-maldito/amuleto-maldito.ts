import type { EfectoDefinicion } from '../tablas/efecto';

// Formato de data/amuleto-maldito.json: las dos tablas del amuleto maldito (E027 en el libro).
// Al recibir el amuleto se tira un dado en cada lista (1d6 si tiene 6 resultados) y el resultado
// es la POSICIÓN en la lista: un 1 es el primero, un 6 el sexto.
// Para añadir un resultado basta con escribirlo al final (con 7 resultados se tira 1d7).

/** Un resultado de una de las dos tablas del amuleto. */
export interface ResultadoDelAmuleto {
  // Condición del catálogo (data/condiciones.json) que el amuleto lleva DENTRO mientras dura:
  // una bendición en la lista de bendiciones y una maldición en la de maldiciones.
  condicion?: string;

  // Evento que se lanza en vez de llevar una condición dentro ("deseo": pasa una vez y ya;
  // por eso no se pierde aunque te quiten el amuleto). Hasta el motor de eventos (Sprint 10)
  // sale como evento pendiente.
  evento?: string;

  // Lo que pasa UNA SOLA VEZ, al recibirlo: gran fortaleza te cura del todo.
  alRecibir?: EfectoDefinicion[];
}

export interface AmuletoMaldito {
  bendiciones: ResultadoDelAmuleto[];
  maldiciones: ResultadoDelAmuleto[];
}
