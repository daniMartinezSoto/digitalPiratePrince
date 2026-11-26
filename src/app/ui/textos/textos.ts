import type { AccionDisponible, MotivoNoDisponible } from '../../core/acciones/acciones-disponibles';
import type { IdAccion, TiradaDeAccion } from '../../core/acciones/accion';
import { CONDICIONES } from '../../core/catalogos/cargar-condiciones';
import { HABILIDADES } from '../../core/catalogos/cargar-habilidades';
import { OBJETOS } from '../../core/catalogos/cargar-objetos';
import type { MotivoMercado } from '../../core/mercado/mercado';
import type { RivalDePulso } from '../../core/guarida/pulso';
import type { Apuesta } from '../../core/guarida/apuestas';
import { TIPOS_SEGUIDOR } from '../../core/catalogos/cargar-seguidores';
import type { Cambio } from '../../core/efectos/cambio';
import type { Fase } from '../../core/estado/fase';
import type { Retrato } from '../../core/personaje/retrato';
import { nombreDeSobrenombre } from '../../core/personaje/hoja-de-personaje';
import type { TipoRecurso } from '../../core/tablas/efecto';
import type { EleccionDeComida } from '../../core/turno/comer';
import type { EleccionDeDescanso } from '../../core/turno/descansar';
import type { Lugar, Rasgo, Terreno } from '../../core/turno/lugar';
import type { FinPartida, MotivoDeFin } from '../../core/estado/fin-partida';
import { ENEMIGOS } from '../../core/catalogos/cargar-enemigos';
import { BARCOS } from '../../core/catalogos/cargar-barcos';
import { EVENTOS } from '../../core/eventos/cargar-eventos';

// TEXTOS DE LA PANTALLA (pantalla de pruebas): traducen los datos que devuelven las reglas
// (cambios, motivos, ids...) a frases para el jugador. Son textos de pantalla, por eso van en ui/
// y no en core/ (las reglas devuelven datos, no mensajes). Servirán también para la interfaz bonita.

export const NOMBRE_DE_ACCION: Record<IdAccion, string> = {
  pescar: 'Pescar',
  cazar: 'Cazar',
  reposar: 'Reposar',
  ir_al_mercado: 'Ir al mercado',
  dar_discurso: 'Dar un discurso',
  contratar_marineros: 'Contratar marineros',
  buscar_seguidor: 'Buscar seguidor',
  rezar: 'Rezar',
  descansar_en_monasterio: 'Descansar en el monasterio',
  enterrar_tesoro: 'Enterrar tesoro',
  buscar_informacion: 'Buscar información',
  solicitar_audiencia: 'Solicitar audiencia',
  jugar_a_los_dados: 'Jugar a los dados',
  echar_un_pulso: 'Echar un pulso',
  investigar_naufragio: 'Investigar naufragio',
  registrar_ruinas: 'Registrar ruinas',
  mendigar: 'Mendigar',
  reparar: 'Reparar el barco',
};

export const NOMBRE_DE_LUGAR: Record<Lugar, string> = {
  barco: 'A bordo (mar)',
  puerto: 'Puerto',
  guarida: 'Guarida pirata (neutral)',
  aldea: 'Aldea',
  monasterio: 'Monasterio',
  intemperie: 'Al raso (tierra salvaje)',
};

export const NOMBRE_DE_FASE: Record<Fase, string> = {
  inicio: 'inicio del día',
  accion: 'acción',
  comida: 'comida',
  descanso: 'descanso',
};

export const NOMBRE_DE_TERRENO: Record<Terreno, string> = {
  alta_mar: 'Alta mar',
  costa: 'Costa',
  playa: 'Playa',
  jungla: 'Jungla',
  jungla_profunda: 'Jungla profunda',
};

const TEXTO_DE_FIN: Record<MotivoDeFin, string> = {
  vida: 'te has quedado sin vida',
  tripulacion: 'te has quedado sin tripulación',
  seguidor: 'ha muerto tu seguidor vital',
  evento: 'por un evento',
  abandono: 'has abandonado',
  fama_y_puertos: '¡fama y los cuatro puertos: eres una leyenda pirata!',
};

/** "VICTORIA: ¡fama y los cuatro puertos...!", "DERROTA: te has quedado sin vida". */
export function textoDeFin(fin: FinPartida): string {
  return `${fin.resultado === 'victoria' ? 'VICTORIA' : 'DERROTA'}: ${TEXTO_DE_FIN[fin.motivo]}`;
}

/**
 * POR QUÉ has muerto (22-nov, pedido por el autor), o null si no se sabe. Los eventos pueden traer su
 * propio mensaje escrito; si no, se escribe aquí según la causa.
 */
export function textoDeMuerte(fin: FinPartida): string | null {
  const causa = fin.causa;
  if (!causa) return null;
  const sinTripulacion = fin.motivo === 'tripulacion';
  switch (causa.tipo) {
    case 'evento': {
      if (causa.texto) return causa.texto;
      const titulo = EVENTOS.find(e => e.id === causa.evento)?.titulo ?? causa.evento;
      return sinTripulacion ? `Pierdes a tu última tripulación durante «${titulo}».` : `Tu aventura termina durante «${titulo}».`;
    }
    case 'combate': {
      const nombres = causa.enemigos.map(id => ENEMIGOS.find(e => e.id === id)?.nombre ?? id);
      return `Caes en combate contra ${unirConY(nombres.map(n => n.toLowerCase()))}. Tu aventura termina aquí.`;
    }
    case 'combate_naval': {
      const barco = BARCOS.find(b => b.id === causa.barco)?.nombre ?? causa.barco;
      return `Los cañones de ${barco.toLowerCase()} barren tu cubierta hasta que no queda nadie en pie.`;
    }
    case 'hambre':
      return sinTripulacion ? 'Tu tripulación muere de hambre.' : 'El hambre puede contigo: mueres de inanición.';
    case 'condicion': {
      const nombre = CONDICIONES.find(c => c.id === causa.condicion)?.nombre ?? causa.condicion;
      return sinTripulacion ? `«${nombre}» acaba con tu tripulación: no queda nadie a bordo.` : `«${nombre}» acaba contigo.`;
    }
    case 'accion': {
      const accion = (NOMBRE_DE_ACCION as Record<string, string>)[causa.accion] ?? causa.accion;
      return `Mueres al ${accion.charAt(0).toLowerCase()}${accion.slice(1)}.`;
    }
  }
}

function unirConY(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export const NOMBRE_DE_RASGO: Record<Rasgo, string> = {
  naufragio: 'Naufragio',
  ruinas: 'Ruinas',
};

export const NOMBRE_DE_COMIDA: Record<EleccionDeComida, string> = {
  reservas: 'Comer de las reservas',
  pagar: 'Pagar la comida con oro',
  invitado: 'Comer invitado',
  superviviente: 'Conseguir comida (Superviviente)',
};

export const NOMBRE_DE_DESCANSO: Record<EleccionDeDescanso, string> = {
  a_bordo: 'Dormir a bordo',
  techo_solo: 'Dormir bajo techo (solo tú)',
  techo_todos: 'Dormir bajo techo (todo el grupo)',
  intemperie: 'Dormir al raso',
  tienda: 'Dormir en la tienda de campaña',
  convencer_nativos: 'Convencer a los nativos para dormir en la aldea',
};

export const NOMBRE_DE_RECURSO: Record<TipoRecurso, string> = {
  oro: 'oro',
  comida: 'comida',
  tripulacion: 'tripulación',
  vida: 'vida',
  fama: 'fama',
  fuerza: 'fuerza',
  ingenio: 'ingenio',
  vidaMax: 'vida máxima',
};

const TEXTO_DE_MOTIVO: Record<MotivoNoDisponible, string> = {
  sin_agua: 'Hay que estar a bordo o junto al agua',
  solo_salvaje: 'Solo en tierra salvaje',
  solo_puerto: 'Solo en puertos y guaridas',
  prohibido: 'No puedes',
  tripulacion_al_maximo: 'Ya tienes toda la tripulación',
  sin_oro: 'No te llega el oro',
  grupo_lleno: 'El grupo está lleno',
  solo_monasterio: 'Solo en un monasterio',
  sin_maldiciones: 'No tienes ninguna maldición',
  nadie_herido: 'Nadie necesita descansar',
  tesoro_ya_enterrado: 'Ya has enterrado un tesoro aquí',
  solo_puerto_o_aldea: 'Solo en puertos, guaridas y aldeas',
  espera: 'Tienes que esperar',
  solo_puerto_aldea_o_guarida: 'Solo en puertos, aldeas y guaridas',
  audiencia_ya_concedida: 'Ya te concedieron audiencia aquí',
  audiencia_vetada: 'Aquí no quieren volver a verte',
  solo_guarida: 'Solo en guaridas piratas',
  sin_naufragio: 'Aquí no hay ningún naufragio',
  sin_ruinas: 'Aquí no hay ruinas',
  ya_explorado: 'Ya lo has explorado',
  sin_artista: 'Necesitas un artista en el grupo',
  sin_kit: 'Necesitas el kit de cabos, tablones y herramientas',
  solo_a_bordo: 'Solo a bordo de tu barco',
  no_es_momento: 'No es el momento',
  combate_en_curso: 'Hay un combate en curso',
  evento_en_curso: 'Hay un evento en curso',
  accion_a_medias: 'Termina antes lo que has empezado',
  debes_salir: 'Aquí no te quieren: tienes que irte (viaja a otra casilla)',
};

/** "el_afortunado" con retrato de mujer → "La afortunada" (para la crónica). */
export function textoDeSobrenombre(id: string, retrato: Retrato): string {
  return nombreDeSobrenombre(id, retrato);
}

export const TEXTO_DE_MOTIVO_DEL_MERCADO: Record<MotivoMercado, string> = {
  sin_oro: 'No te llega el oro',
  comida_al_maximo: 'Ya tienes toda la comida que cabe',
  sin_comida: 'No tienes comida',
  ya_comprado: 'Ya lo has comprado',
};

export const NOMBRE_DEL_RIVAL: Record<RivalDePulso, string> = {
  borracho: 'un borracho (−1 al dado)',
  parroquiano: 'un parroquiano',
  campeon: 'el campeón de pulsos (+1 al dado)',
};

/** "10", "25"... o "Todo (73)". */
export function textoDeApuesta(apuesta: Apuesta, cantidad: number): string {
  return apuesta === 'todo' ? `Todo (${cantidad})` : `${cantidad}`;
}

export function nombreDeTipoDeSeguidor(id: string): string {
  return TIPOS_SEGUIDOR.find(t => t.id === id)?.nombre ?? id;
}

export function nombreDeHabilidad(id: string): string {
  return HABILIDADES.find(h => h.id === id)?.nombre ?? id;
}

export function nombreDeObjeto(id: string): string {
  return OBJETOS.find(o => o.id === id)?.nombre ?? id;
}

/** Lo que hace un objeto (su descripción del catálogo): sale al pasar el ratón por encima. */
export function descripcionDeObjeto(id: string): string {
  return OBJETOS.find(o => o.id === id)?.descripcion ?? '';
}

export function nombreDeCondicion(id: string): string {
  return CONDICIONES.find(c => c.id === id)?.nombre ?? id;
}

/** "taberna_clandestina" → "taberna clandestina" (los eventos aún no tienen ficha con nombre). */
export function nombreDeEvento(id: string): string {
  return id.replaceAll('_', ' ');
}

/** Por qué no se puede: "No puedes: Hedor nauseabundo", "Tienes que esperar (falta 1 día)". */
export function textoDeMotivo(accion: AccionDisponible): string {
  if (!accion.motivo) {
    return '';
  }
  const base = TEXTO_DE_MOTIVO[accion.motivo];
  if (accion.motivo === 'prohibido' && accion.condiciones?.length) {
    return `${base}: ${accion.condiciones.map(nombreDeCondicion).join(', ')}`;
  }
  if (accion.motivo === 'espera' && accion.faltanDias !== undefined) {
    return `${base} (falta${accion.faltanDias === 1 ? '' : 'n'} ${accion.faltanDias} día${accion.faltanDias === 1 ? '' : 's'})`;
  }
  return base;
}

/** "dados 3 + 4 (+1) = 8 · Buena pesca." */
export function describirTirada(tirada: Pick<TiradaDeAccion, 'dados' | 'modificador' | 'total' | 'texto'>): string {
  const modificador = tirada.modificador === 0 ? '' : ` (${tirada.modificador > 0 ? '+' : ''}${tirada.modificador})`;
  const texto = tirada.texto ? ` · ${tirada.texto}` : '';
  return `dados ${tirada.dados.join(' + ')}${modificador} = ${tirada.total}${texto}`;
}

function conSigno(numero: number): string {
  return numero > 0 ? `+${numero}` : `${numero}`;
}

/**
 * Los nombres de los seguidores por su id ("forzudo_1" → "Rufus"), ANTES y DESPUÉS del cambio.
 * Hace falta separarlos porque un id se puede reutilizar: si despides a forzudo_1 y entra otro
 * forzudo, el nuevo vuelve a ser forzudo_1. Quien se va se nombra con lo de antes; quien llega, con lo de después.
 */
export interface NombresDeSeguidores {
  antes: Record<string, string>;
  despues: Record<string, string>;
}

/** Un cambio en una frase: "+5 comida (de 2 a 7)", "Ganas: Ungüento", "Ahora tienes: Tormenta (3 turnos)". */
export function describirCambio(cambio: Cambio, nombres: NombresDeSeguidores = { antes: {}, despues: {} }): string {
  const deAntes = (id: string) => nombres.antes[id] ?? nombres.despues[id] ?? id;
  const deDespues = (id: string) => nombres.despues[id] ?? nombres.antes[id] ?? id;
  switch (cambio.tipo) {
    case 'recurso': {
      const motivo = cambio.motivo === 'contable' ? ' (el contable)' : cambio.motivo === 'objeto_magico' ? ' (objeto mágico)' : cambio.motivo === 'objeto_famoso' ? ' (objeto)' : '';
      return `${conSigno(cambio.despues - cambio.antes)} ${NOMBRE_DE_RECURSO[cambio.recurso]} (de ${cambio.antes} a ${cambio.despues})${motivo}`;
    }
    case 'resistencia_seguidor':
      return `${deDespues(cambio.seguidor)}: ${conSigno(cambio.despues - cambio.antes)} resistencia (de ${cambio.antes} a ${cambio.despues})`;
    case 'seguidor_muerto':
      return `${deAntes(cambio.seguidor)} ha muerto`;
    case 'seguidor_se_marcha':
      return `${deAntes(cambio.seguidor)} se marcha`;
    case 'seguidor_se_une':
      return `${deDespues(cambio.seguidor)} se une al grupo`;
    case 'seguidor_no_se_une': {
      const tipo = TIPOS_SEGUIDOR.find(t => t.id === cambio.tipoSeguidor)?.nombre ?? cambio.tipoSeguidor;
      return `${tipo} no se une (${cambio.motivo === 'grupo_lleno' ? 'el grupo está lleno' : 'no puedes tener seguidores nuevos'})`;
    }
    case 'seguidor_despedido':
      return `Despides a ${deAntes(cambio.seguidor)}`;
    case 'objeto_ganado':
      return `Ganas: ${nombreDeObjeto(cambio.objeto)}`;
    case 'objeto_no_cabe':
      return `No te cabe: ${nombreDeObjeto(cambio.objeto)}`;
    case 'objeto_perdido':
      return `Pierdes: ${nombreDeObjeto(cambio.objeto)}`;
    case 'objeto_tirado':
      return `Tiras: ${nombreDeObjeto(cambio.objeto)}`;
    case 'objeto_usado':
      return `Usas: ${nombreDeObjeto(cambio.objeto)} (quedan ${cambio.usosRestantes} usos)`;
    case 'objeto_agotado':
      return OBJETOS.find(o => o.id === cambio.objeto)?.textoAlAgotarse ?? `Se agota: ${nombreDeObjeto(cambio.objeto)}`;
    case 'objeto_vendido':
      return `Vendes: ${nombreDeObjeto(cambio.objeto)}`;
    case 'condicion_puesta': {
      const turnos = cambio.turnos === undefined ? '' : ` (${cambio.turnos} turnos)`;
      // Las partes (el amuleto maldito), con lo que hace cada una: "Carisma (Puedes llevar 1 seguidor más.)".
      const partes = cambio.partes?.length
        ? ` [${cambio.partes.map(p => `${nombreDeCondicion(p)} (${CONDICIONES.find(c => c.id === p)?.descripcion ?? ''})`).join(' + ')}]`
        : '';
      return `Ahora tienes: ${nombreDeCondicion(cambio.condicion)}${turnos}${partes}`;
    }
    case 'condicion_quitada':
      return `Ya no tienes: ${nombreDeCondicion(cambio.condicion)}`;
    case 'condicion_no_puesta':
      return `No puedes recibir otro: ${nombreDeCondicion(cambio.condicion)} (ya lo llevas)`;
    case 'turnos_perdidos':
      return `Pierdes ${cambio.cantidad} fase${cambio.cantidad === 1 ? '' : 's'} de acción`;
    case 'bandera':
      return `(se apunta: ${cambio.bandera})`;
    case 'fin_partida':
      return `FIN DE LA PARTIDA · ${textoDeFin(cambio.fin)}`;
  }
}
