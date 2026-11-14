// Un objeto que el jugador lleva en el inventario, tal como se guarda en la partida.
// Solo lo que cambia: el resto (nombre, dibujo, precio...) está en el catálogo
// (core/catalogos/objeto.ts) y se busca por el id.
export interface ObjetoLlevado {
  // Id del objeto en el catálogo, p. ej. "mano_de_mono".
  id: string;

  // Usos que le quedan. Sin él = objeto permanente.
  usosRestantes?: number;
}
