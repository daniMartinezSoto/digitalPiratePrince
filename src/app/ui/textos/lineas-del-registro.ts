import type { ResultadoAccion } from '../../core/acciones/accion';
import type { ResultadoBuscarInformacion } from '../../core/acciones/buscar-informacion';
import type { ResultadoPartidaDeDados } from '../../core/guarida/dados';
import type { ResultadoPulso } from '../../core/guarida/pulso';
import type { Cambio } from '../../core/efectos/cambio';
import type { Estado } from '../../core/estado/estado';
import type { ResultadoComida } from '../../core/turno/comer';
import type { ResultadoDescanso } from '../../core/turno/descansar';
import type { ResultadoInicioTurno } from '../../core/turno/iniciar-turno';
import { describirCambio, describirTirada, NOMBRE_DEL_RIVAL, nombreDeCondicion, nombreDeEvento, type NombresDeSeguidores } from './textos';

// LAS LÍNEAS DEL REGISTRO (pantalla de pruebas): lo que se apunta en la lista de "lo que ha pasado"
// tras cada botón. Solo traducen los resultados de las reglas a frases.

/** Los nombres de los seguidores por id, antes y después de la regla (ver NombresDeSeguidores). */
export function nombresDeSeguidores(antes: Estado | null, despues: Estado | null): NombresDeSeguidores {
  const nombres = (estado: Estado | null) => Object.fromEntries((estado?.jugador.seguidores ?? []).map(s => [s.id, s.nombre]));
  return { antes: nombres(antes), despues: nombres(despues) };
}

function cambiosYEventos(cambios: readonly Cambio[], eventos: readonly string[], nombres: NombresDeSeguidores): string[] {
  return [
    ...cambios.map(c => '  ' + describirCambio(c, nombres)),
    ...eventos.map(e => `  Evento pendiente: ${nombreDeEvento(e)}`),
  ];
}

export function lineasDeAmanecer(resultado: ResultadoInicioTurno, nombres: NombresDeSeguidores): string[] {
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

export function lineasDeAccion(nombreDeLaAccion: string, resultado: ResultadoAccion, nombres: NombresDeSeguidores): string[] {
  const tirada = resultado.tirada ? ` · ${describirTirada(resultado.tirada)}` : '';
  return [`${nombreDeLaAccion}${tirada}`, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}

export function lineasDeComida(nombreDeLaEleccion: string, resultado: ResultadoComida, nombres: NombresDeSeguidores): string[] {
  const lineas = [resultado.haComido ? nombreDeLaEleccion : `${nombreDeLaEleccion}: no llega, PASAS HAMBRE`];
  if (resultado.tiradaDeMuerte !== undefined) {
    lineas.push(`  El hambre te deja al borde de la muerte · dado ${resultado.tiradaDeMuerte} (con 1, mueres)`);
  }
  return [...lineas, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}

export function lineasDeDescanso(nombreDeLaEleccion: string, resultado: ResultadoDescanso, nombres: NombresDeSeguidores): string[] {
  const lineas = [nombreDeLaEleccion];
  if (resultado.chequeo) {
    const c = resultado.chequeo;
    lineas.push(`  Chequeo de ${c.caracteristica} (${c.valor}): dado ${c.dado} → ${c.superado ? 'superado' : 'fallado'}`);
  }
  if (resultado.echado) {
    const donde = resultado.expulsadoA ? ` en ${resultado.expulsadoA.col},${resultado.expulsadoA.fila}` : '';
    lineas.push(`  Te echan de la aldea: duermes al raso${donde}.`);
  }
  if (resultado.amigoDeLaAldea) {
    lineas.push('  Te has hecho amigo de esta aldea: a partir de ahora podrás descansar aquí siempre que quieras.');
  }
  if (resultado.haDormidoGenial === true) {
    lineas.push('  Has dormido genial.');
  }
  return [...lineas, ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres)];
}

/** Un botón sin tirada (comprar comida, vender, salir...): el título y lo que ha cambiado. */
export function lineasSimples(titulo: string, resultado: { cambios: readonly Cambio[]; eventos?: readonly string[] }, nombres: NombresDeSeguidores): string[] {
  return [titulo, ...cambiosYEventos(resultado.cambios, resultado.eventos ?? [], nombres)];
}

/** Buscar información: la tirada, lo que roba (o le cuesta) cada mono y lo demás. */
export function lineasDeBuscarInformacion(titulo: string, resultado: ResultadoBuscarInformacion, nombres: NombresDeSeguidores): string[] {
  const lineas = lineasDeAccion(titulo, resultado, nombres);
  for (const robo of resultado.manosLargas) {
    const quien = nombres.antes[robo.seguidor] ?? robo.seguidor;
    lineas.push(robo.multa === undefined ? `  ${quien} (mono) roba ${robo.dado} de oro` : `  A ${quien} (mono) lo pillan: multa de ${robo.multa}`);
  }
  return lineas;
}

/** Una apuesta a los dados: cada tirada (los empates se repiten) y si gana o pierde. */
export function lineasDeApuesta(resultado: ResultadoPartidaDeDados, nombres: NombresDeSeguidores): string[] {
  const tiradas = resultado.tiradas.map(t => `tú ${t.tuyo} · rival ${t.suyo}`).join(' → empate, otra vez: ');
  return [
    `Dados (apuestas ${resultado.apostado}): ${tiradas} → ${resultado.ganada ? 'GANAS' : 'pierdes'}`,
    ...cambiosYEventos(resultado.cambios, [], nombres),
  ];
}

/** Un pulso: quién se sienta, el chequeo de Fuerza y el resultado. */
export function lineasDePulso(resultado: ResultadoPulso, nombres: NombresDeSeguidores): string[] {
  const c = resultado.chequeo;
  const modificador = c.modificador === 0 ? '' : ` ${c.modificador > 0 ? '+' : '−'} ${Math.abs(c.modificador)}`;
  return [
    `Pulso (apuestas ${resultado.apostado}) · se sienta ${NOMBRE_DEL_RIVAL[resultado.rival]} (dado ${resultado.dadoRival})`,
    `  Chequeo de fuerza (${c.valor}): dado ${c.dado}${modificador} = ${c.total} → ${c.superado ? 'GANAS' : 'pierdes'}`,
    ...cambiosYEventos(resultado.cambios, resultado.eventos, nombres),
  ];
}
