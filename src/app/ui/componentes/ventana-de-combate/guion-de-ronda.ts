import { ID_JUGADOR, type ResultadoRonda, type SucesoDeCombate } from '../../../core/combate/combate';
import { vidaMaxActual } from '../../../core/condiciones/consultas';
import type { Estado } from '../../../core/estado/estado';
import { nombreDeObjeto } from '../../textos/textos';

// EL GUION DE UNA RONDA (Sprint 11, paso 2). Las reglas devuelven lo que ha pasado (los sucesos) y la
// partida ya está cambiada del todo. La ventana de combate, en cambio, lo enseña POCO A POCO:
//   1. caen los dados de la ronda, todos a la vez (dorado = tú, verde = tus seguidores, rojo = enemigos);
//   2. salen los mensajes uno tras otro, encima de la carta de quien toca ("¡Impactas! 5 de daño");
//   3. las barras de vida bajan con cada mensaje.
// Este archivo solo calcula ese guion (no pinta nada): para cada mensaje, cómo quedan las barras en
// ese momento. Así la pantalla no tiene que saber nada de las reglas.

/** El color de cada dado: el tuyo, el de tus seguidores o el de los enemigos. */
export type ColorDeDado = 'dorado' | 'verde' | 'rojo';

/** Un dado que cae sobre el mapa: de quién es, su color y lo que ha salido. */
export interface DadoDeCombate {
  luchador: string;
  color: ColorDeDado;
  valor: number;
}

/** Cómo se ve un mensaje: bueno para ti (verde), malo (rojo), un aviso (amarillo) o neutro. */
export type TonoDeMensaje = 'bueno' | 'malo' | 'aviso' | 'neutro';

/** Lo que hace la carta mientras sale el mensaje. */
export type AnimacionDeCarta = 'golpeado' | 'falla' | 'muere' | 'revive' | 'se_cura';

/** Un mensaje del guion y cómo quedan las barras cuando sale. */
export interface PasoDelGuion {
  mensaje: string;
  tono: TonoDeMensaje;
  // Encima de qué carta sale (null = en el centro de la ventana).
  luchador: string | null;
  // Quién da el golpe (para que su carta avance un poco), si es un ataque.
  atacante?: string;
  animacion?: AnimacionDeCarta;
  // La vida (o resistencia) de cada luchador cuando sale este mensaje, y su máximo.
  vidas: Record<string, number>;
  maximos: Record<string, number>;
}

/** Todo lo que la ventana enseña de una ronda (o de una huida, o de usar un objeto). */
export interface GuionDeRonda {
  dados: DadoDeCombate[];
  pasos: PasoDelGuion[];
  // Las barras antes de empezar (lo que se ve mientras caen los dados).
  vidasIniciales: Record<string, number>;
  maximosIniciales: Record<string, number>;
  // true = la ronda se ha quedado en pausa por un 6 tuyo (la ventana pregunta si vuelves a tirar).
  enPausa: boolean;
}

/** De quién es cada id: tú, un seguidor o un enemigo. */
export function colorDe(luchador: string): ColorDeDado {
  if (luchador === ID_JUGADOR) return 'dorado';
  return luchador.startsWith('enemigo_') ? 'rojo' : 'verde';
}

/** Las barras de todos los que están en el combate: vida (tú) o resistencia (seguidores y enemigos). */
export function vidasDelCombate(estado: Estado | null): { vidas: Record<string, number>; maximos: Record<string, number> } {
  const vidas: Record<string, number> = {};
  const maximos: Record<string, number> = {};
  if (!estado) return { vidas, maximos };
  vidas[ID_JUGADOR] = estado.jugador.vida;
  maximos[ID_JUGADOR] = vidaMaxActual(estado.jugador);
  for (const s of estado.jugador.seguidores) {
    vidas[s.id] = s.resistencia;
    maximos[s.id] = s.resistenciaMaxima;
  }
  for (const e of estado.mundo.combate?.enemigos ?? []) {
    vidas[e.id] = e.resistencia;
    maximos[e.id] = e.resistenciaMaxima;
  }
  return { vidas, maximos };
}

/**
 * Prepara el guion de una ronda.
 *   antes:     la partida justo antes de pulsar el botón (de ahí salen las barras iniciales).
 *   resultado: lo que han devuelto las reglas (atacar, volverATirar, quedarseConElAtaque, huir...).
 *   nombres:   los nombres de los luchadores ("Tú", "Rufus", "Jaguar"...).
 * Si "antes" ya estaba en pausa por un 6, los dados de la ronda ya cayeron: solo caen tus dados nuevos.
 */
export function guionDeRonda(antes: Estado, resultado: ResultadoRonda, nombres: Record<string, string>): GuionDeRonda {
  const { vidas: vidasIniciales, maximos: maximosIniciales } = vidasDelCombate(antes);
  const vidas = { ...vidasIniciales };
  const maximos = { ...maximosIniciales };
  const pasos: PasoDelGuion[] = [];
  const quien = (id: string) => nombres[id] ?? id;
  const anadir = (paso: Omit<PasoDelGuion, 'vidas' | 'maximos'>) => pasos.push({ ...paso, vidas: { ...vidas }, maximos: { ...maximos } });

  const dados = dadosQueCaen(antes, resultado);

  // La maldición del chamán sale en la lista antes que los golpes; se enseña después, para que se lea en su momento.
  const maldiciones = resultado.sucesos.filter(s => s.tipo === 'maldicion_pendiente');

  for (const suceso of resultado.sucesos) {
    switch (suceso.tipo) {
      case 'seis':
        anadir({ mensaje: `¡SEIS! ¿Volver a tirar?`, tono: 'aviso', luchador: ID_JUGADOR });
        break;
      case 'emboscada':
        anadir(
          suceso.quien === 'nuestra'
            ? { mensaje: '¡Los pilláis por sorpresa! Esta ronda solo atacáis vosotros', tono: 'bueno', luchador: null }
            : { mensaje: '¡EMBOSCADA! Esta ronda solo atacan ellos', tono: 'malo', luchador: null },
        );
        break;
      case 'enemigos_no_fallan':
        anadir({ mensaje: 'Tras tu huida fallida, tus enemigos no fallan', tono: 'malo', luchador: null });
        break;
      case 'ataque': {
        const esTuyo = suceso.atacante === ID_JUGADOR;
        const deTuBando = colorDe(suceso.atacante) !== 'rojo';
        if (!suceso.tirada.acierta) {
          const pifia = esTuyo && suceso.tirada.dados.length > 1;
          const mensaje = pifia ? '¡PIFIA! Has perdido tu ataque' : esTuyo ? '¡Fallo!' : `¡${quien(suceso.atacante)} falla!`;
          anadir({ mensaje, tono: deTuBando ? 'malo' : 'bueno', luchador: suceso.atacante, animacion: 'falla' });
          break;
        }
        vidas[suceso.objetivo] = Math.max(0, (vidas[suceso.objetivo] ?? 0) - suceso.dano);
        const cabeza = esTuyo ? '¡Impactas!' : `¡${quien(suceso.atacante)} impacta!`;
        const detalles: string[] = [];
        if (suceso.dadosExtra?.length) detalles.push(`+${suceso.dadosExtra.reduce((a, b) => a + b, 0)} pistola`);
        if (suceso.tirada.bonificador) detalles.push(`${suceso.tirada.bonificador > 0 ? '+' : '−'}${Math.abs(suceso.tirada.bonificador)} bonificador`);
        if (suceso.tirada.castigoHambre) detalles.push(`−${suceso.tirada.castigoHambre} por hambre`);
        if (suceso.pielDePiedra) detalles.push(`−${suceso.pielDePiedra} piel de piedra`);
        const dano = suceso.dano > 0 ? `${suceso.dano} de daño` : 'pero no hace daño';
        anadir({
          mensaje: `${cabeza} ${dano}${detalles.length ? ` (${detalles.join(', ')})` : ''}`,
          tono: deTuBando ? 'bueno' : 'malo',
          luchador: suceso.objetivo,
          atacante: suceso.atacante,
          animacion: suceso.dano > 0 ? 'golpeado' : undefined,
        });
        break;
      }
      case 'golpe_de_gracia':
        vidas[ID_JUGADOR] = 1;
        anadir({ mensaje: '¡Golpe de gracia! Ibas a caer, pero te quedas con 1 PV', tono: 'aviso', luchador: ID_JUGADOR });
        break;
      case 'afortunado':
        vidas[ID_JUGADOR] = 1;
        anadir({ mensaje: '¡Qué suerte! Ibas a caer, pero te quedas con 1 PV', tono: 'aviso', luchador: ID_JUGADOR });
        break;
      case 'derrota_no_mortal':
        vidas[ID_JUGADOR] = 1;
        anadir({ mensaje: 'Caes, pero no era a muerte: te quedas con 1 PV', tono: 'malo', luchador: ID_JUGADOR });
        break;
      case 'herido':
        // Las barras ya han bajado golpe a golpe; aquí solo se asegura el número exacto (sin mensaje).
        vidas[suceso.luchador] = suceso.despues;
        break;
      case 'muerte':
        vidas[suceso.luchador] = 0;
        anadir({
          mensaje: suceso.luchador === ID_JUGADOR ? 'Caes...' : `¡${suceso.nombre} cae!`,
          tono: colorDe(suceso.luchador) === 'rojo' ? 'bueno' : 'malo',
          luchador: suceso.luchador,
          animacion: 'muere',
        });
        break;
      case 'revive':
        vidas[suceso.luchador] = suceso.resistencia;
        maximos[suceso.luchador] = suceso.resistencia; // al revivir vuelve entero (el debilitado, con un máximo menor)
        anadir({ mensaje: `¡${quien(suceso.luchador)} se levanta otra vez!`, tono: 'malo', luchador: suceso.luchador, animacion: 'revive' });
        break;
      case 'no_revive':
        anadir({ mensaje: `${quien(suceso.luchador)} intenta levantarse... y no puede`, tono: 'bueno', luchador: suceso.luchador });
        break;
      case 'se_cura':
        vidas[suceso.luchador] = suceso.despues;
        anadir({ mensaje: `${quien(suceso.luchador)} se cura: +${suceso.despues - suceso.antes}`, tono: 'malo', luchador: suceso.luchador, animacion: 'se_cura' });
        break;
      case 'huida':
        anadir(
          suceso.exito
            ? { mensaje: '¡Huyes!', tono: 'bueno', luchador: null }
            : { mensaje: '¡No logras huir! Tus enemigos acertarán el siguiente ataque', tono: 'malo', luchador: null },
        );
        break;
      case 'objeto_usado':
        anadir({ mensaje: `Usas: ${nombreDeObjeto(suceso.objeto)}`, tono: 'neutro', luchador: ID_JUGADOR });
        break;
      case 'fin':
        // Antes del final, la maldición (si la hay): que se lea después de los golpes.
        anadirMaldiciones();
        anadir(
          suceso.resultado === 'victoria'
            ? { mensaje: '¡VICTORIA!', tono: 'bueno', luchador: null }
            : suceso.resultado === 'huida'
              ? { mensaje: 'Os ponéis a salvo', tono: 'neutro', luchador: null }
              : { mensaje: 'DERROTA', tono: 'malo', luchador: null },
        );
        break;
      case 'maldicion_pendiente':
      case 'nuevo_objetivo':
        // La maldición se enseña al final; los cambios de rival se ven en las líneas de quién ataca a quién.
        break;
    }
  }
  anadirMaldiciones();

  return { dados, pasos, vidasIniciales, maximosIniciales, enPausa: resultado.sucesos.some(s => s.tipo === 'seis') };

  function anadirMaldiciones(): void {
    for (const m of maldiciones.splice(0)) {
      if (m.tipo !== 'maldicion_pendiente') continue;
      anadir({ mensaje: `¡${quien(m.luchador)} saca un 6: TE MALDICEN!`, tono: 'malo', luchador: ID_JUGADOR });
    }
  }
}

/**
 * Los dados que caen al pulsar el botón, en el orden en que se tiraron.
 *   - Ronda normal: los de todos los ataques (y los de la pistola).
 *   - Ronda que se queda en pausa por un 6: los sucesos solo dicen "seis"; los dados de todos están en
 *     la ronda guardada en la partida.
 *   - Si ya estaba en pausa (has vuelto a tirar o te has quedado así): los demás dados ya cayeron;
 *     solo caen los tuyos nuevos (ninguno si te quedas así).
 * Un intento de huida: tu dado.
 */
function dadosQueCaen(antes: Estado, resultado: ResultadoRonda): DadoDeCombate[] {
  const pausaAnterior = antes.mundo.combate?.rondaEnPausa;
  const enPausa = resultado.sucesos.some(s => s.tipo === 'seis');
  const todos = enPausa ? dadosDeLaPausa(resultado.estado) : dadosDeLosSucesos(resultado.sucesos);
  if (!pausaAnterior) return todos;
  const vistos = pausaAnterior.ataques.find(a => a.atacante === ID_JUGADOR)?.tirada.dados.length ?? 0;
  const tuyos = enPausa
    ? resultado.estado.mundo.combate?.rondaEnPausa?.ataques.find(a => a.atacante === ID_JUGADOR)?.tirada.dados
    : tuAtaque(resultado.sucesos)?.tirada.dados;
  return (tuyos ?? []).slice(vistos).map((valor: number) => ({ luchador: ID_JUGADOR, color: 'dorado' as const, valor }));
}

function tuAtaque(sucesos: readonly SucesoDeCombate[]): Extract<SucesoDeCombate, { tipo: 'ataque' }> | undefined {
  for (const s of sucesos) {
    if (s.tipo === 'ataque' && s.atacante === ID_JUGADOR) return s;
  }
  return undefined;
}

function dadosDeLosSucesos(sucesos: readonly SucesoDeCombate[]): DadoDeCombate[] {
  const dados: DadoDeCombate[] = [];
  for (const s of sucesos) {
    if (s.tipo === 'ataque') {
      for (const valor of [...s.tirada.dados, ...(s.dadosExtra ?? [])]) dados.push({ luchador: s.atacante, color: colorDe(s.atacante), valor });
    } else if (s.tipo === 'huida') {
      dados.push({ luchador: ID_JUGADOR, color: 'dorado', valor: s.dado });
    }
  }
  return dados;
}

/**
 * Los dados de una ronda en pausa (todos los que han caído al pulsar Atacar), para enseñarlos si se
 * recarga la página a mitad: la ventana los pinta quietos sobre la mesa.
 */
export function dadosDeLaPausa(estado: Estado): DadoDeCombate[] {
  const pausa = estado.mundo.combate?.rondaEnPausa;
  if (!pausa) return [];
  return pausa.ataques.flatMap(a =>
    [...a.tirada.dados, ...(a.dadosExtra ?? [])].map(valor => ({ luchador: a.atacante, color: colorDe(a.atacante), valor })),
  );
}
