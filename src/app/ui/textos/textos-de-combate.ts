import type { HabilidadDeEnemigo } from '../../core/catalogos/enemigo';
import type { MotivoNoHuir, MotivoNoUsarObjeto, ResultadoRonda, SucesoDeCombate } from '../../core/combate/combate';
import type {
  Duelo,
  MotivoNoAbordar,
  MotivoNoHuirNaval,
  ResultadoHuidaNaval,
  ResumenCombateNaval,
} from '../../core/combate-naval/combate-naval';
import type { Estado } from '../../core/estado/estado';
import { describirCambio, nombreDeEvento, nombreDeObjeto, type NombresDeSeguidores } from './textos';

// TEXTOS DEL COMBATE (pantalla de pruebas): traducen los sucesos de una ronda, los duelos de cañones
// y los resúmenes a frases. Igual que el resto de textos, van en ui/ (las reglas devuelven datos).

export const NOMBRE_DE_HABILIDAD_DE_ENEMIGO: Record<HabilidadDeEnemigo, string> = {
  curarse: 'se cura cada 2 rondas',
  revivir_debilitado: 'revive debilitado',
  revivir_una_vez: 'puede revivir una vez',
  ataca_dos_veces: 'ataca dos veces',
  piel_de_piedra: 'piel de piedra',
  acierta_con_5: 'acierta con 5-6',
  maldice_con_6: 'maldice con un 6',
};

export const TEXTO_NO_HUIR: Record<MotivoNoHuir, string> = {
  no_se_puede_huir: 'De este combate no se puede huir',
  primera_ronda: 'Hay que pelear al menos una ronda',
  acabas_de_fallar: 'Acabas de fallar: pelea otra ronda antes',
  ronda_a_medias: 'Primero decide qué haces con tu 6',
};

export const TEXTO_NO_USAR_OBJETO: Record<MotivoNoUsarObjeto, string> = {
  ya_usado_en_este_combate: 'Ya lo has usado en este combate',
  no_se_puede_huir: 'De este combate no se puede huir',
  ronda_a_medias: 'Primero decide qué haces con tu 6',
};

export const TEXTO_NO_HUIR_NAVAL: Record<MotivoNoHuirNaval, string> = {
  primera_ronda: 'Hay que disparar al menos una ronda',
  acabas_de_fallar: 'Acabas de fallar: dispara otra ronda antes',
  abordaje_en_curso: 'Estáis abordando',
};

export const TEXTO_NO_ABORDAR: Record<MotivoNoAbordar, string> = {
  resistencia_alta: 'Aún le queda demasiada resistencia',
  abordaje_en_curso: 'Ya estáis abordando',
};

/** Nombres de todos los que luchan, por su id: "jugador" → "Tú", seguidores y enemigos. */
export function nombresDeLuchadores(...estados: (Estado | null)[]): Record<string, string> {
  const nombres: Record<string, string> = { jugador: 'Tú' };
  for (const estado of estados) {
    for (const s of estado?.jugador.seguidores ?? []) nombres[s.id] = s.nombre;
    for (const e of estado?.mundo.combate?.enemigos ?? []) nombres[e.id] = e.nombre;
  }
  return nombres;
}

/** Un suceso de combate en una frase. */
export function describirSuceso(suceso: SucesoDeCombate, nombres: Record<string, string>): string {
  const quien = (id: string) => nombres[id] ?? id;
  switch (suceso.tipo) {
    case 'seis':
      return `¡SEIS! Llevas ${suceso.dados.join(' + ')}. ¿Vuelves a tirar? (con un 1 pierdes todo el ataque)`;
    case 'emboscada':
      return suceso.quien === 'nuestra' ? '¡Emboscáis vosotros! En esta ronda solo atacáis vosotros.' : '¡EMBOSCADA! En esta ronda solo atacan ellos.';
    case 'enemigos_no_fallan':
      return 'Tras tu huida fallida, los enemigos no fallan esta ronda.';
    case 'ataque': {
      const t = suceso.tirada;
      const dados = t.dados.join(' + ');
      // "Tú atacas" / "Jaguar ataca": el jugador va en segunda persona.
      const ataca = suceso.atacante === 'jugador' ? 'atacas' : 'ataca';
      const cabeza = `${quien(suceso.atacante)} ${ataca} a ${quien(suceso.objetivo)}`;
      if (!t.acierta) {
        // Un 1 después de arriesgar un 6 es una pifia: se pierde todo el ataque.
        const pifia = suceso.atacante === 'jugador' && t.dados.length > 1;
        return `${cabeza}: dados ${dados} → ${pifia ? '¡PIFIA! Pierdes todo el ataque' : '¡Fallo!'}`;
      }
      const partes = [`dados ${dados}`];
      if (suceso.dadosExtra?.length) partes.push(`+ pistola ${suceso.dadosExtra.join(' + ')}`);
      if (t.bonificador) partes.push(`${t.bonificador > 0 ? '+' : '−'} ${Math.abs(t.bonificador)} bonificador`);
      if (t.castigoHambre) partes.push(`− ${t.castigoHambre} por hambre`);
      if (suceso.pielDePiedra) partes.push(`− ${suceso.pielDePiedra} piel de piedra`);
      return `${cabeza}: ${partes.join(' ')} → ${suceso.dano} de daño`;
    }
    case 'maldicion_pendiente':
      return `${quien(suceso.luchador)} saca un 6: ¡MALDITO! (al terminar el combate)`;
    case 'golpe_de_gracia':
      return 'Ibas a caer, pero has matado a tu rival: ¡golpe de gracia! Te quedas con 1 PV.';
    case 'afortunado':
      return 'Ibas a caer, pero tienes suerte (el afortunado): te quedas con 1 PV.';
    case 'derrota_no_mortal':
      return 'Caes, pero no era a muerte: te quedas con 1 PV y pierdes el combate.';
    case 'herido':
      return `  ${quien(suceso.luchador)}: ${suceso.antes} → ${suceso.despues}`;
    case 'muerte':
      return `  ${suceso.nombre} cae.`;
    case 'revive':
      return `  ${quien(suceso.luchador)} vuelve a levantarse${suceso.dado ? ` (dado ${suceso.dado})` : ''}: ataque ${suceso.ataque}, resistencia ${suceso.resistencia}`;
    case 'no_revive':
      return `  ${quien(suceso.luchador)} intenta levantarse (dado ${suceso.dado}), pero no lo consigue`;
    case 'se_cura':
      return `${quien(suceso.luchador)} se cura (dado ${suceso.dado}): ${suceso.antes} → ${suceso.despues}`;
    case 'nuevo_objetivo':
      return `${quien(suceso.luchador)} ahora ataca a ${quien(suceso.objetivo)}`;
    case 'huida':
      return suceso.exito
        ? `Intentas huir: dado ${suceso.dado} → ¡lo consigues!`
        : `Intentas huir: dado ${suceso.dado} → ¡No logras huir! Tus enemigos acertarán el siguiente ataque.`;
    case 'objeto_usado':
      return `Usas: ${nombreDeObjeto(suceso.objeto)}`;
    case 'fin':
      return `FIN DEL COMBATE: ${suceso.resultado}`;
  }
}

/** Las líneas de una ronda (o de una huida, o de usar un objeto). */
export function lineasDeRonda(
  titulo: string,
  resultado: ResultadoRonda,
  luchadores: Record<string, string>,
  seguidores: NombresDeSeguidores,
): string[] {
  return [titulo, ...resultado.sucesos.map(s => '  ' + describirSuceso(s, luchadores)), ...resultado.cambios.map(c => '  ' + describirCambio(c, seguidores))];
}

/** Un duelo de cañones: cada pareja de dados (los empates se repiten) y quién gana. */
export function lineasDeDuelo(ronda: number, duelo: Duelo, nombreBarco: string): string[] {
  const tiradas = duelo.tiradas.map(t => {
    const bono = t.bonificador ? ` ${t.bonificador > 0 ? '+' : '−'} ${Math.abs(t.bonificador)}` : '';
    return `tú ${t.tuDado}${bono} = ${t.total} · ${nombreBarco} ${t.suDado}`;
  });
  const lineas = [`Ronda ${ronda} · Disparas: ${tiradas.join(' → empate, otra vez: ')}`];
  if (duelo.ganador === 'jugador') {
    lineas.push(`  Aciertas: ${nombreBarco} pierde ${duelo.danoAlBarco} de resistencia`);
  } else {
    const casco = duelo.reduccionCasco ? ` (el casco reforzado te ahorra ${duelo.reduccionCasco})` : '';
    lineas.push(`  Te aciertan: pierdes ${duelo.tripulacionPerdida} de tripulación${casco}`);
  }
  return lineas;
}

export function lineasDeHuidaNaval(resultado: ResultadoHuidaNaval): string[] {
  const bono = resultado.bonificador ? ` + ${resultado.bonificador}` : '';
  return [`Intentas huir: dado ${resultado.dado}${bono} = ${resultado.total} → ${resultado.huye ? 'huyes' : 'no lo consigues'}`];
}

/** El resumen final del combate naval (la "pantalla de resultados", en texto). */
export function lineasDeResumenNaval(resumen: ResumenCombateNaval): string[] {
  const como = resumen.resultado === 'victoria' ? (resumen.forma === 'abordado' ? 'VICTORIA, abordándolo' : 'VICTORIA, hundiéndolo') : resumen.resultado.toUpperCase();
  const lineas = [`Fin del combate contra ${resumen.nombre}: ${como}`, `  Tripulación perdida: ${resumen.tripulacionPerdida}`];
  if (resumen.vidaPerdida) lineas.push(`  Vida perdida en el abordaje: ${resumen.vidaPerdida}`);
  for (const s of resumen.seguidoresCaidos) lineas.push(`  ${s.nombre} cayó en el abordaje`);
  if (resumen.oroGanado) lineas.push(`  Oro: ${resumen.oroGanado > 0 ? '+' : ''}${resumen.oroGanado}`);
  if (resumen.famaGanada) lineas.push(`  Fama: +${resumen.famaGanada}`);
  if (resumen.comidaGanada) lineas.push(`  Comida: ${resumen.comidaGanada > 0 ? '+' : ''}${resumen.comidaGanada}`);
  for (const e of resumen.eventos) lineas.push(`  Evento pendiente: ${nombreDeEvento(e)}`);
  return lineas;
}
