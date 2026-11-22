import type { Lectura } from '../../core/estado/pila-eventos';
import { ENEMIGOS } from '../../core/catalogos/cargar-enemigos';
import type { OpcionVisible, ResultadoPosible } from '../../core/eventos/motor';
import { RECURSOS, type EfectoDefinicion, type TipoRecurso } from '../../core/tablas/efecto';
import { describirCambio, NOMBRE_DE_RECURSO, nombreDeEvento, nombreDeObjeto, type NombresDeSeguidores } from './textos';

// TEXTOS DE LOS EVENTOS (pantalla de pruebas, Sprint 10): lo que se lee en la ventana de eventos y
// lo que se apunta en el registro. Solo traducen lo que devuelve el motor a frases.

/** Por qué una opción sale desactivada. */
export const TEXTO_DE_MOTIVO_DE_OPCION: Record<NonNullable<OpcionVisible['motivo']>, string> = {
  ya_lo_tienes: 'Ya lo tienes',
  grupo_lleno: 'Tu grupo está lleno',
  prohibido: 'No puedes tener más seguidores',
  al_maximo: 'Ya está al máximo',
  ya_ocurrio: 'Eso ya ocurrió',
};

export const NOMBRE_DE_CARACTERISTICA: Record<'fuerza' | 'ingenio', string> = { fuerza: 'Fuerza', ingenio: 'Ingenio' };

const NOMBRE_DE_RESULTADO: Record<NonNullable<Lectura['combate']>, string> = {
  victoria: 'has vencido',
  huida: 'has huido',
  derrota: 'has caído',
};

/** "🎲 4 (+1) = 5" (con "elegido con el amuleto del destino" si toca). */
export function describirTiradaDeEvento(tirada: NonNullable<Lectura['tirada']>): string {
  // Con el amuleto del destino no se tira: se elige el resultado.
  if (tirada.elegida) return `Resultado elegido con el amuleto del destino: ${tirada.total}`;
  const modificador = tirada.modificador === 0 ? '' : ` (${tirada.modificador > 0 ? '+' : ''}${tirada.modificador})`;
  const elegida = tirada.elegida ? ' (elegido con el amuleto del destino)' : tirada.trucada ? ' (trampa de prueba)' : '';
  return `Dados: ${tirada.dados.join(' + ')}${modificador} = ${tirada.total}${elegida}`;
}

/** "Chequeo de Fuerza: sacas 2 (necesitas 3 o menos): superado". */
export function describirChequeo(chequeo: NonNullable<Lectura['chequeo']>): string {
  const modificador = chequeo.modificador === 0 ? '' : ` ${chequeo.modificador > 0 ? '+' : '−'} ${Math.abs(chequeo.modificador)} = ${chequeo.total}`;
  const nombre = NOMBRE_DE_CARACTERISTICA[chequeo.caracteristica];
  return `Chequeo de ${nombre}: sacas ${chequeo.dado}${modificador} (necesitas ${chequeo.valor} o menos): ${chequeo.superado ? 'superado' : 'fallado'}`;
}

/** Cómo acabó el combate que lanzó el evento. */
export function describirResultadoDeCombate(resultado: NonNullable<Lectura['combate']>): string {
  return `Combate: ${NOMBRE_DE_RESULTADO[resultado]}`;
}

/** Todas las líneas de una lectura: dados, chequeo, combate, texto y cambios (sin sangría). */
export function lineasDeLectura(lectura: Lectura | null, nombres: NombresDeSeguidores): string[] {
  if (!lectura) return [];
  return [
    ...(lectura.tirada ? [describirTiradaDeEvento(lectura.tirada)] : []),
    ...(lectura.chequeo ? [describirChequeo(lectura.chequeo)] : []),
    ...(lectura.combate ? [describirResultadoDeCombate(lectura.combate)] : []),
    ...(lectura.evitado ? ['Usas la mano de mono: el evento no llega a ocurrir.'] : []),
    ...(lectura.texto ? [lectura.texto] : []),
    ...sinUsoRepetido(lectura.cambios).map(c => describirCambio(c, nombres)),
  ];
}

/** Si un objeto se agota, sobra el "Usas: X (quedan 0 usos)" de justo antes: ya lo dice el texto de agotarse. */
function sinUsoRepetido(cambios: Lectura['cambios']): Lectura['cambios'] {
  return cambios.filter(c => !(c.tipo === 'objeto_usado' && c.usosRestantes === 0 && cambios.some(o => o.tipo === 'objeto_agotado' && o.objeto === c.objeto)));
}

/** Para el registro: el título y lo que ha pasado, con sangría, más los eventos pendientes. */
export function lineasDeEvento(titulo: string, lectura: Lectura | null, pendientes: readonly string[], nombres: NombresDeSeguidores): string[] {
  return [titulo, ...lineasDeLectura(lectura, nombres).map(l => '  ' + l), ...pendientes.map(e => `  Evento pendiente: ${nombreDeEvento(e)}`)];
}

/**
 * La etiqueta de un resultado al elegir con el amuleto del destino: "1: Un tentáculo se desploma...",
 * "4: Cofre" (el título del evento al que lleva), "3-4: +1d6x10 oro" (sus efectos) o sus enemigos.
 */
export function etiquetaDeResultado(resultado: ResultadoPosible): string {
  const rango = resultado.min === resultado.max ? `${resultado.min}` : `${resultado.min}-${resultado.max}`;
  return `${rango}: ${contenidoDeResultado(resultado)}`;
}

function contenidoDeResultado(r: ResultadoPosible): string {
  if (r.texto) return r.texto;
  if (r.evento) return r.evento.titulo ?? nombreDeEvento(r.evento.id);
  if (r.efectos?.length) return r.efectos.map(describirEfectoDefinicion).join(', ');
  if (r.enemigos?.length) return r.enemigos.map(e => `${e.cantidad ?? 1} × ${ENEMIGOS.find(x => x.id === e.enemigo)?.nombre ?? e.enemigo}`).join(', ');
  return 'no pasa nada';
}

/** Un efecto tal como se escribe en el JSON, resumido: "+1d6x10 oro", "vida al máximo", "Ganas: Ungüento". */
export function describirEfectoDefinicion(efecto: EfectoDefinicion): string {
  const e = efecto as Record<string, unknown>;
  const tipo = String(e['tipo']);
  if ((RECURSOS as readonly string[]).includes(tipo)) {
    const recurso = NOMBRE_DE_RECURSO[tipo as TipoRecurso];
    switch (e['operacion']) {
      case 'maximo':
        return `${recurso} al máximo`;
      case 'mitad':
        return `pierdes la mitad de ${recurso}`;
      case 'todo':
        return `pierdes todo ${recurso}`;
      case 'fijar':
        return `${recurso} a ${String(e['cantidad'])}`;
      default: {
        const cantidad = String(e['cantidad']);
        return `${cantidad.startsWith('-') ? cantidad : '+' + cantidad} ${recurso}`;
      }
    }
  }
  if (tipo === 'ganar_objeto') return `Ganas: ${nombreDeObjeto(String(e['objeto']))}`;
  if (tipo === 'perder_objeto') return `Pierdes: ${nombreDeObjeto(String(e['objeto']))}`;
  return tipo.replaceAll('_', ' ');
}
