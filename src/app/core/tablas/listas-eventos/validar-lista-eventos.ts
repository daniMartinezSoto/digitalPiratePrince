import type { ListaEventos } from './lista-eventos';

const FORMATO_ID = /^[a-z][a-z0-9_]*$/;
const FORMATO_LIBRO = /^E\d{3}$/;

/** Revisa una lista de eventos y devuelve todos los errores, explicados. Lista vacía = está bien. */
export function validarListaEventos(lista: ListaEventos): string[] {
  const errores: string[] = [];
  const nombre = `Lista "${lista.id}"`;

  if (!FORMATO_ID.test(lista.id)) {
    errores.push(`${nombre}: el id debe ir en minúsculas y con guiones bajos.`);
  }
  if (lista.eventos.length === 0) {
    errores.push(`${nombre}: no tiene eventos.`);
  }

  const vistos = new Set<string>();
  for (const entrada of lista.eventos) {
    const donde = `${nombre}, evento "${entrada.evento}"`;

    if (!FORMATO_ID.test(entrada.evento)) {
      errores.push(`${donde}: el nombre debe ir en minúsculas y con guiones bajos.`);
    }
    if (!Number.isInteger(entrada.peso) || entrada.peso < 1) {
      errores.push(`${donde}: el peso debe ser un número entero mayor que 0 (tiene ${entrada.peso}).`);
    }
    if (entrada.libro !== undefined && !FORMATO_LIBRO.test(entrada.libro)) {
      errores.push(`${donde}: "libro" debe tener el formato E000 (tiene "${entrada.libro}").`);
    }
    if (vistos.has(entrada.evento)) {
      errores.push(`${donde}: aparece más de una vez. Escríbelo una sola vez y súbele el peso.`);
    }
    vistos.add(entrada.evento);
  }

  return errores;
}
