// Una lista de eventos con pesos: una por terreno y otra para los eventos nocturnos.
// Sustituye a las cuadrículas 6x6 del papel: cada repetición en la cuadrícula = +1 de peso.
export interface EntradaEvento {
  evento: string; // id del evento, con nombre (p. ej. "tormenta")
  peso: number;   // cuántas veces más sale que uno con peso 1
  libro?: string; // solo para cotejar con el PDF (p. ej. "E034"). Se borrará.
}

export interface ListaEventos {
  id: string; // "alta_mar", "costa", "jungla", "jungla_profunda", "playa" o "nocturnos"
  eventos: EntradaEvento[];
}
