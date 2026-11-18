// Ficha de catálogo de un ENEMIGO (data/enemigos.json, Sprint 7): el bestiario.
// Es lo que NO cambia: cómo se llama, cuánto daño hace y cuánta resistencia tiene al empezar.
// Lo que cambia durante una pelea (la resistencia que le queda) irá en el combate en curso (paso 4).
//
// Los eventos lanzan "combate contra 2 de estos": solo nombran el id. Así, cambiar un número
// aquí vale para todos los eventos que usan a ese enemigo.
//
// Lucha con la regla de enemigos y seguidores (sección 4.8): 1d6, con 1-2 falla, con 3-5 hace
// su ataque y con un 6 su ataque +1. Sus habilidades especiales cambian esa regla (ver abajo).

// Qué es. Sirve para las reglas "contra no humanos" (la lanza kalinago) y para la silueta de
// reserva mientras no haya dibujo.
export const CATEGORIAS_ENEMIGO = ['humano', 'animal', 'no_muerto', 'criatura'] as const;
export type CategoriaEnemigo = (typeof CATEGORIAS_ENEMIGO)[number];

// Habilidades especiales de los enemigos (Sprint 7, paso 6). Se escriben en la ficha por su id:
//   curarse:            al final de las rondas 2, 4, 6... recupera 1d6 de resistencia (sin pasar del máximo).
//                       El guardián de la isla misteriosa.
//   revivir_debilitado: cada vez que cae, vuelve en el acto con −1 de ataque (mínimo 1) y −1 de
//                       resistencia máxima, como mucho 3 veces (decidido por el autor: 5 era demasiado).
//                       El pirata maldito: 3/5 → 2/4 → 1/3 → 1/2, y la cuarta vez muere.
//   revivir_una_vez:    la primera vez que cae, 1d6: con un 1 vuelve con toda su resistencia. Solo una vez.
//                       Los piratas esqueleto.
//   ataca_dos_veces:    tira dos ataques contra su rival; si el primero es un 1, no hay segundo. El velociraptor.
//   piel_de_piedra:     cada golpe que recibe le hace 1 menos (pero al menos 1). El gólem.
//   acierta_con_5:      solo acierta con 5 (su ataque) o 6 (su ataque +1). El cangrejo gigante.
//   maldice_con_6:      si saca algún 6 en el combate, al terminar (como termine) salta el evento
//                       "maldicion": ¡MALDITO! El chamán.
export const HABILIDADES_DE_ENEMIGO = [
  'curarse',
  'revivir_debilitado',
  'revivir_una_vez',
  'ataca_dos_veces',
  'piel_de_piedra',
  'acierta_con_5',
  'maldice_con_6',
] as const;
export type HabilidadDeEnemigo = (typeof HABILIDADES_DE_ENEMIGO)[number];

export interface Enemigo {
  // Identificador único, p. ej. "pirata_maldito".
  id: string;

  // Nombre que ve el jugador ("Pirata maldito").
  nombre: string;

  // Texto opcional: normalmente la historia la cuenta el evento.
  descripcion?: string;

  // Ruta del dibujo, para verlo en el combate. Opcional mientras no haya dibujos
  // (entonces, una silueta de reserva según su categoría).
  imagen?: string;

  // Qué es (ver CATEGORIAS_ENEMIGO).
  categoria: CategoriaEnemigo;

  // Daño que hace cuando acierta (el "Daño" del libro). Se llama igual que en los seguidores.
  ataque: number;

  // Resistencia con la que empieza el combate (su vida).
  resistencia: number;

  // Sus habilidades especiales (ver HABILIDADES_DE_ENEMIGO). Sin poner = ninguna.
  habilidades?: HabilidadDeEnemigo[];

  // Solo para cotejar con el libro de papel ("E078"). Se puede borrar cuando ya no haga falta.
  libro?: string;
}
