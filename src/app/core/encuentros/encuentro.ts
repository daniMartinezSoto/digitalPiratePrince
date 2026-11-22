import type { EnemigoPedido } from '../combate/combate';
import type { EfectoDefinicion } from '../tablas/efecto';

// ENCUENTROS (Sprint 10, paso 7; decidido por el autor el 22-nov). Un encuentro es una tablita de
// enemigos posibles: se tira el dado y la fila que sale dice contra quién se lucha y con qué texto.
// Así "un combate con piratas" no es siempre el mismo: cada vez sale algo distinto (dos piratas con
// cuchillos, un fortachón con espada, un viejo loco con una cuchara...).
//
// Se escriben una vez en data/encuentros.json y los usa cualquier evento en su paso de combate:
//   "combate": { "encuentro": "piratas_hostiles", "victoria": { ... }, "huida": { ... } }
// Cada evento decide qué pasa al ganar o al huir. Si se cambia la tabla, cambia en todos a la vez.
// En la ventana: "Tirar dados" → sale la fila (su texto) → "Luchar".
//
// Ejemplo:
//   { "id": "piratas_hostiles", "dado": "1d6", "recompensaPorEnemigo": [{ "tipo": "oro", "cantidad": "1d6x2" }],
//     "filas": [ { "min": 1, "max": 2, "texto": "Dos piratas con cuchillos cargan hacia ti.",
//                  "enemigos": [{ "enemigo": "pirata", "cantidad": 2 }] }, ... ] }
//
// Pendiente para cuando haga falta (decidido): filas SIN pelea (nativos hostiles, E046: "la tensión se
// calma") y "tira dos veces" (polizones E016, cueva E088: se juntan los enemigos en un solo combate).

export interface FilaDeEncuentro {
  min: number;
  max: number;

  // Lo que se cuenta al jugador antes de luchar ("Un pirata anciano y loco, armado con una cuchara...").
  texto: string;

  // Contra quién se lucha: el mismo formato que el combate de un evento (bestiario, cantidad, números...).
  enemigos: EnemigoPedido[];
}

export interface Encuentro {
  id: string;
  dado: string;
  filas: FilaDeEncuentro[];

  // Lo que da CADA enemigo derrotado, si su pedido no dice otra cosa ("1d6×2 de oro por cada pirata").
  recompensaPorEnemigo?: EfectoDefinicion[];

  // Solo para cotejar con el libro de papel ("E003").
  libro?: string;
}
