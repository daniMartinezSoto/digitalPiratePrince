import type { Modificadores } from '../modificadores/id-tirada';
import type { EfectoDefinicion } from '../tablas/efecto';

// Cuándo se puede usar un objeto activo:
//   accion:  al empezar la fase de acción, antes de elegir qué haces ese día. Usarlo NO gasta
//            la acción y se pueden usar varios seguidos (un ungüento que cura).
//   evento:  sale como botón al tirar los dados de un evento: la mano de mono ("Evitar evento"),
//            el amuleto del destino ("Elegir resultado"). Llega con el motor de eventos (Sprint 10).
//   combate: sale como botón en el combate, junto a "Atacar". Llega con el combate (Sprint 7).
export const MOMENTOS_DE_USO = ['accion', 'evento', 'combate'] as const;
export type MomentoDeUso = (typeof MOMENTOS_DE_USO)[number];

// Ficha de catálogo de un objeto (data/objetos.json, Sprint 4).
// Es lo que NO cambia durante la partida: nombre, texto, dibujo, precio...
// La partida solo guarda un ObjetoLlevado (el id y los usos que le quedan),
// así que corregir un texto o un dibujo aquí vale para todas las partidas.
export interface Objeto {
  // Identificador único, p. ej. "amuleto_del_destino".
  id: string;

  nombre: string;
  descripcion: string;

  // Ruta del dibujo del objeto. Opcional mientras no haya dibujos.
  imagen?: string;

  // Los pasivos se quedan en el inventario y funcionan solos.
  // Los activos se usan y se descartan al agotar sus usos.
  tipo: 'pasivo' | 'activo';

  // Usos con los que se consigue. Sin él = permanente (no se gasta).
  usosMaximos?: number;

  // Solo en los activos: cuándo se puede usar (ver MOMENTOS_DE_USO).
  cuandoSeUsa?: MomentoDeUso;

  // Solo en los activos: lo que pasa al usarlo, escrito como los efectos de las tablas
  // (un ungüento: [{ "tipo": "vida", "cantidad": 5 }]). Sin él = el efecto lo programa su sistema
  // (la mano de mono evita un evento: eso lo hará el motor de eventos).
  alUsar?: EfectoDefinicion[];

  // Huecos del inventario que ocupa. Sin él = 1 (p. ej. el ídolo dorado ocupa 4).
  espacios?: number;

  // Oro que se obtiene al venderlo (en el mercado de un puerto). Todos los objetos lo tienen,
  // mágicos incluidos. Venderlo no quita la fama que dio al conseguirlo.
  precioVenta: number;

  // Objeto mágico: da +1 de fama al conseguirlo (lo aplicará aplicarEfectos).
  magico?: boolean;

  // Bonificadores a tiradas mientras lo llevas, igual que los sobrenombres.
  modificadores?: Modificadores;

  // Bandera que el juego apunta si lo VENDES, para recordarlo más tarde. El ídolo antediluviano:
  // si lo vendiste y llegas a la ciudad perdida, el juego te recordará que lo necesitabas.
  banderaAlVender?: string;

  // Condiciones que tienes MIENTRAS lo llevas (ids del catálogo de condiciones).
  // El amuleto kalinago: ["vinculo_nativo"]. No se guardan en la partida: se calculan.
  otorga?: string[];
}
