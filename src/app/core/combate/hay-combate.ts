import type { Estado } from '../estado/estado';

/**
 * ¿Hay algún combate en marcha, normal (mundo.combate) o naval (mundo.combateNaval)?
 * Mientras lo haya, no se puede hacer nada más: ni acciones, ni comer, ni dormir, ni usar o tirar objetos.
 * Todas esas comprobaciones usan esta consulta, así que un combate nuevo solo se añade aquí.
 */
export function hayCombate(estado: Estado): boolean {
  return Boolean(estado.mundo.combate || estado.mundo.combateNaval);
}
