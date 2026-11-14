import type { Modificadores } from '../modificadores/id-tirada';

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

  // Huecos del inventario que ocupa. Sin él = 1 (p. ej. el ídolo dorado ocupa 4).
  espacios?: number;

  // Oro que se obtiene al venderlo. Sin él = no se puede vender.
  precioVenta?: number;

  // Objeto mágico: da +1 de fama al conseguirlo (lo aplicará aplicarEfectos).
  magico?: boolean;

  // Bonificadores a tiradas mientras lo llevas, igual que los sobrenombres.
  modificadores?: Modificadores;
}
