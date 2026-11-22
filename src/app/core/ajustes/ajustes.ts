import ajustesJson from '../../data/ajustes.json';
import type { IdTirada } from '../modificadores/id-tirada';

// Números del juego que se pueden equilibrar sin tocar código. Se editan en data/ajustes.json.
export interface Ajustes {
  /** Porcentaje (0-100) de que pase un evento al viajar. En papel: 1d6 par = 50. */
  probabilidadEventoAlViajar: number;

  /** Reservas de comida que se pueden tener como máximo. Provisional: se ajusta jugando. */
  comidaMaxima: number;

  /**
   * Oro que cuesta comer pagando (la taberna de un puerto, o los nativos de una aldea si aceptan tu oro)
   * por cada reserva de comida que se necesite ese día.
   */
  precioTaberna: number;

  /** Oro que cuesta dormir en la posada de un puerto, por personaje (el jugador y cada seguidor). */
  precioPosada: number;

  /** Oro que cuesta dormir en un monasterio, por personaje. */
  precioMonasterio: number;

  /**
   * Oro que cuesta la ACCIÓN "Descansar en el monasterio" (todo el grupo recupera toda la vida y
   * duerme allí esa noche): este precio + precioDescansarMonasterioPorSeguidor por cada seguidor.
   */
  precioDescansarMonasterio: number;

  /** Oro de más por cada seguidor al "Descansar en el monasterio". */
  precioDescansarMonasterioPorSeguidor: number;

  /** Oro que se entierra con la acción "Enterrar tesoro" (a cambio de 1 punto de fama). */
  oroAlEnterrarTesoro: number;

  /** Oro que cuesta cada soborno al buscar información en un puerto (cada uno da +1 a la tirada). */
  precioSoborno: number;

  /** Sobornos que se pueden pagar como mucho en una búsqueda (3 = hasta +3). */
  maximoSobornos: number;

  /** Días que hay que esperar entre una búsqueda de información y la siguiente (2 = un día sí y otro no). */
  diasEntreBusquedas: number;

  /** Botones de apuesta en la guarida (jugar a los dados, echar un pulso). Además siempre está "todo". */
  apuestas: number[];

  /**
   * Porcentaje (0-100) de que pase un evento nocturno al dormir al raso, según el terreno
   * (claves: playa, jungla, jungla_profunda; ver TERRENOS_AL_RASO en core/turno/lugar.ts).
   * Decidido por el autor (18-nov, tras las simulaciones de combate): 25 en jungla y playa, 35 en jungla profunda.
   */
  probabilidadEventoNocturno: Record<string, number>;

  /** Puntos que resta la tienda de campaña a la probabilidad de evento nocturno (25 → 15, 35 → 25). */
  reduccionEventoNocturnoTienda: number;

  /**
   * Porcentaje (0-100) de "dormir genial" en la fase de descanso cuando se duerme a bordo o bajo techo.
   * Solo si se duerme genial se recupera 1 PV esa noche (una tirada para todo el grupo).
   */
  probabilidadDormirGenial: number;

  /** PV que recuperan el jugador y sus seguidores con la ACCIÓN "Reposar" (pasar el día recuperándose). */
  curaAlReposar: number;

  /**
   * Porcentaje (0-100) de que pase algo mientras se usa la acción "Reposar" en el barco o a la intemperie
   * (dejas el mando de lado...). En puertos, aldeas y monasterios no hay riesgo.
   */
  probabilidadEventoAlReposar: number;

  /** Oro que cuesta comprar UNA reserva de comida en el mercado de un puerto. */
  precioComprarComida: number;

  /** Oro que te dan por vender UNA reserva de comida en el mercado de un puerto. */
  precioVenderComida: number;

  /** Marineros que hay disponibles al ir a contratarlos (expresión de dados, p. ej. "1d6x3+4"). */
  marinerosDisponibles: string;

  /** Oro que cuesta cada marinero contratado (+1 de tripulación). */
  precioMarinero: number;

  /** Seguidores que pueden acompañar al jugador a la vez (sin contar condiciones como el carisma: ver maximoSeguidoresActual). */
  maximoSeguidores: number;

  /**
   * Tiradas que dan +1 por cada X puntos de fama. { "audiencia_guarida": 2 } = +1 por cada 2 de fama
   * al pedir audiencia al capitán pirata (con 5 de fama, +2).
   */
  bonificadorPorFama: Partial<Record<IdTirada, number>>;

  /**
   * Castigo máximo al daño en combate por pasar hambre (Sprint 7): −1 por cada día sin comer,
   * hasta este tope. Afecta al jugador y a sus seguidores.
   */
  castigoHambreMaximo: number;
  // Máximo de fuerza e ingenio (decidido por el autor el 22-nov: 5), también con lo que den las
  // condiciones (el amuleto): así un chequeo siempre se puede fallar. Ver también chequeo.ts (un 6 falla).
  caracteristicaMaxima: number;
}

export const AJUSTES: Ajustes = ajustesJson;
