// Una condición que afecta ahora mismo al jugador: maldición, bendición, enfermedad,
// tormenta, escorbuto, "el mal está a bordo"...
// Qué hace cada una (bonificadores, prohibiciones, qué pasa cada turno, cómo se quita)
// estará en el catálogo data/condiciones.json (Sprint 4). Aquí solo lo que cambia.
export interface CondicionActiva {
  // Id de la condición en el catálogo, p. ej. "escorbuto".
  id: string;

  // Turnos que le quedan. Sin él = dura hasta que algo la quite (monasterio, bruja...).
  turnosRestantes?: number;

  // Condiciones que lleva DENTRO (ids del catálogo). Solo lo usa el amuleto maldito: su bendición
  // y su maldición, las que le tocaron en los dados. Funcionan mientras dure la condición y
  // se van con ella: si un monasterio te quita el amuleto, pierdes lo malo Y lo bueno.
  partes?: string[];
}
