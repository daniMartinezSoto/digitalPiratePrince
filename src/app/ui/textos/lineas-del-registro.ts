import type { ResultadoAccion } from '../../core/acciones/accion';
import type { Cambio } from '../../core/efectos/cambio';
import type { Estado } from '../../core/estado/estado';
import type { ResultadoComida } from '../../core/turno/comer';
import type { ResultadoDescanso } from '../../core/turno/descansar';
import type { ResultadoInicioTurno } from '../../core/turno/iniciar-turno';
import { describirCambio, describirTirada, nombreDeCondicion, nombreDeEvento } from './textos';

// LAS LÍNEAS DEL REGISTRO (pantalla de pruebas): lo que se apunta en la lista de "lo que ha pasado"
// tras cada botón. Solo traducen los resultados de las reglas a frases.

/** Nombres de los seguidores por id, juntando los de antes y los de después (para los que mueren o se van). */
export function nombresDeSeguidores(...estados: (Estado | null)[]): Record<string, string> {
  const nombres: Record<string, string> = {};
  for (const estado of estados) {
    for (const s of estado?.jugador.seguidores ?? []) {
      nombres[s.id] = s.nombre;
    }
  }
  return nombres;
}

function cambiosYEventos(cambios: readonly Cambio[], eventos: readonly string[], nombres: Record<string, string>): string[] {
  return [
    ...cambios.map(c => '  ' + describirCambio(c, nombres)),
    ...eventos.map(e => `  Evento pendiente: ${nombreDeEvento(e)}`),
  ];
}

export function lineasDeAmanecer(resultado: ResultadoInicioTurno, nombres: Record<string, string>): string[] {
  const lineas = ['Amanece.'];
  for (const parte of resultado.parte) {
    const tirada = parte.tirada ? ` · ${describirTirada(parte.tirada)}` : '';
    lineas.push(`  ${nombreDeCondicion(parte.condicion)}${tirada}`);
    lineas.push(...parte.cambios.map(c => '    ' + describirCambio(c, nombres)));
  }
  lineas.push(...resultado.eventos.map(e => `  Evento pendiente: ${nombreDeEvento(e)}`));
  if (resultado.parte.length === 0 && resultado.eventos.length === 0) {
    lineas[0] = 'Amanece. Ninguna condición hace nada.';
  }
  if (resultado.accionPerdida) {
    lineas.push('  Hoy pierdes la fase de acción.');
  }
  return lineas;
}

export function lineasDeAccion(nombreDeLaAccion: string, resultado: ResultadoAccion, nombres: Record<string, string>): string[] {
  const tirada = resultado.tirada ? ` · ${describirTirada(resultado.tirada)}` : '';
  return [`${nombreDeLaAccion}${tirada}`, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}

export function lineasDeComida(nombreDeLaEleccion: string, resultado: ResultadoComida, nombres: Record<string, string>): string[] {
  const lineas = [resultado.haComido ? nombreDeLaEleccion : `${nombreDeLaEleccion}: no llega, PASAS HAMBRE`];
  if (resultado.tiradaDeMuerte !== undefined) {
    lineas.push(`  El hambre te deja al borde de la muerte · dado ${resultado.tiradaDeMuerte} (con 1, mueres)`);
  }
  return [...lineas, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}

export function lineasDeDescanso(nombreDeLaEleccion: string, resultado: ResultadoDescanso, nombres: Record<string, string>): string[] {
  const lineas = [nombreDeLaEleccion];
  if (resultado.chequeo) {
    const c = resultado.chequeo;
    lineas.push(`  Chequeo de ${c.caracteristica} (${c.valor}): dado ${c.dado} → ${c.superado ? 'superado' : 'fallado'}`);
  }
  if (resultado.echado) {
    lineas.push('  Te echan de la aldea: duermes al raso.');
  }
  if (resultado.haDormidoGenial === true) {
    lineas.push('  Has dormido genial.');
  }
  return [...lineas, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}
