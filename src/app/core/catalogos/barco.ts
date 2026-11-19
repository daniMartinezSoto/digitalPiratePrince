import type { EnemigoPedido } from '../combate/combate';
import type { EfectoDefinicion } from '../tablas/efecto';

// Ficha de catálogo de un BARCO enemigo (data/barcos.json, Sprint 7): los barcos del combate naval.
// Es lo que NO cambia: cómo se llama, cuánto daño hace, cuánta resistencia tiene, quién va a bordo
// y qué se gana al derrotarlo. Lo que cambia durante el combate (la resistencia que le queda) irá
// en el combate naval en curso (paso 2).
//
// Cómo se lucha (decidido por el autor, 19-nov): DUELO DE CAÑONES. Cada ronda tiras 1d6 + tus
// bonificadores (tirada "disparo_naval": mejoras del barco, minijuego) y el barco tira 1d6.
//   - Si sacas más, le quitas 1 de resistencia.
//   - Si sacas menos, pierdes tanta tripulación como su daño.
//   - Si empatáis, se repite.
// Cuando su resistencia baja a la mitad (redondeando hacia arriba: con 5, al llegar a 3) puedes
// ABORDARLO: empieza un combate normal contra su tripulación ("abordaje"), del que no se puede huir.
// Huir se puede a partir de la segunda ronda, pero salta el daño en la bodega (E006).
//
// El barco-taberna de Pit y el emporio de Bob NO están aquí: no se pueden atacar
// ("ningún pirata en su sano juicio lo haría").

/** Lo que se gana de más si lo derrotas ABORDÁNDOLO (además de su recompensa normal). */
export interface BotinDeAbordaje {
  // Efectos de una sola vez: [{ "tipo": "oro", "cantidad": "1d6x10" }].
  efectos?: EfectoDefinicion[];

  // Probabilidad (0-100) de que salte también el evento "tesoro" (E036).
  probabilidadTesoro?: number;
}

export interface Barco {
  // Identificador único, p. ej. "fragata_de_la_marina".
  id: string;

  // Nombre que ve el jugador ("Fragata de la marina").
  nombre: string;

  // Texto opcional: normalmente la historia la cuenta el evento.
  descripcion?: string;

  // Ruta del dibujo. Opcional mientras no haya dibujos.
  imagen?: string;

  // Tripulación que pierdes cada vez que pierdes un duelo (el "Daño" del libro).
  // Puede ser con dados ("1d6": el barco pirata); entonces se tira UNA vez al empezar el combate.
  dano: number | string;

  // Duelos que tienes que ganarle para hundirlo (la "Resistencia" del libro).
  resistencia: number;

  // Contra quién peleas si lo abordas: el mismo formato con el que los eventos piden un combate.
  abordaje: EnemigoPedido[];

  // Lo que da al derrotarlo, a cañonazos o abordándolo (lo del libro: oro, fama...).
  recompensa?: EfectoDefinicion[];

  // Eventos que saltan al derrotarlo ("cofre", el "amuleto_fantasmal"...). Un id puede repetirse
  // (el galeón da dos cofres). Mientras un evento no exista, saldrá como pendiente.
  eventosAlGanar?: string[];

  // Lo que se gana de más abordándolo.
  botinAbordaje?: BotinDeAbordaje;

  // Solo para cotejar con el libro de papel ("E008").
  libro?: string;
}
