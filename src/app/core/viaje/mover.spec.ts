import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Marca } from '../estado/mundo';
import { obtenerMapa } from '../mapa/cargar-mapas';
import { avanzar, sonVecinas, vecinas } from '../mapa/hexagonos';
import { casillaEn, type Coordenada } from '../mapa/mapa';
import { aldeaOfendida, casillaBloqueada, sitioActual } from '../mapa/sitio-actual';
import { crearPartida } from '../partida/crear-partida';
import { descansar, opcionesDeDescanso } from '../turno/descansar';
import { esAgua } from '../turno/lugar';
import { desviar, echarAVecinaAlAzar, moverA } from './mover';
import { destinosDeViaje } from './viajar';

// Casillas del primer mapa: 6,0 inicio (jungla profunda) · 6,1 jungla · 6,2 La Habana (playa) ·
// 6,3 costa · 7,2 el barco (costa) · 18,7 aldea · 14,11 Cala Ventura.
const c = (col: number, fila: number) => ({ col, fila });
const mapa = obtenerMapa('primer-mapa-prueba');
const terreno = (x: Coordenada) => casillaEn(mapa, x.col, x.fila)!.terreno;
const ALDEA = c(18, 7);

function partida(posicion: Coordenada = c(6, 0), cambios: { marcas?: Marca[]; fase?: Estado['mundo']['fase'] } = {}, jugador: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(123, 'Marta');
  return {
    ...estado,
    jugador: { ...estado.jugador, condiciones: [], ...jugador },
    mundo: { ...estado.mundo, posicion, fase: 'accion', ...cambios },
  };
}

describe('aldeas ofendidas', () => {
  it('una aldea de la que te echaron, o donde ofendiste al jefe, queda bloqueada', () => {
    for (const tipo of ['echado_de_la_aldea', 'audiencia_vetada'] as const) {
      const e = partida(c(6, 0), { marcas: [{ ...ALDEA, tipo }] });
      expect(aldeaOfendida(e, ALDEA)).toBe(true);
      expect(casillaBloqueada(e, ALDEA)).toBe(true);
    }
  });

  it('una audiencia vetada en un PUERTO no bloquea el puerto (solo las aldeas)', () => {
    const e = partida(c(6, 0), { marcas: [{ col: 6, fila: 2, tipo: 'audiencia_vetada' }] });
    expect(casillaBloqueada(e, c(6, 2))).toBe(false);
  });

  it('no se puede viajar a una aldea ofendida', () => {
    const vecina = vecinas(mapa, ALDEA).find(v => !esAgua(terreno(v)))!;
    const e = partida(vecina, { marcas: [{ ...ALDEA, tipo: 'echado_de_la_aldea' }] });
    expect(destinosDeViaje(e)).not.toContainEqual(ALDEA);
  });

  it('si estás dentro de una aldea ofendida, tienes que irte: todas las acciones desactivadas (viajar sí se puede)', () => {
    const e = partida(ALDEA, { marcas: [{ ...ALDEA, tipo: 'audiencia_vetada' }] });
    const acciones = accionesDisponibles(e, sitioActual(e));
    expect(acciones.every(a => !a.disponible && a.motivo === 'debes_salir')).toBe(true);
    expect(destinosDeViaje(e).length).toBeGreaterThan(0);
  });

  it('en una aldea donde ofendiste al jefe ya no se ofrece dormir allí', () => {
    const e = partida(ALDEA, { marcas: [{ ...ALDEA, tipo: 'audiencia_vetada' }], fase: 'descanso' });
    expect(opcionesDeDescanso(e, 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['intemperie']);
  });

  it('si fallas al convencer a los nativos, te echan a una casilla de tierra vecina y duermes allí al raso', () => {
    // Semilla 1: el chequeo de Ingenio saca un 4 (falla con ingenio 3)
    const e = partida(ALDEA, { fase: 'descanso' }, { ingenio: 3 });
    const noche = descansar(e, 'convencer_nativos', 'aldea', new Dados(1), undefined, ALDEA);

    expect(noche.echado).toBe(true);
    expect(noche.estado.mundo.marcas).toContainEqual({ ...ALDEA, tipo: 'echado_de_la_aldea' });
    expect(noche.expulsadoA).toBeDefined();
    expect(sonVecinas(noche.expulsadoA!, ALDEA)).toBe(true);
    expect(esAgua(terreno(noche.expulsadoA!))).toBe(false);
    expect(noche.estado.mundo.posicion).toEqual(noche.expulsadoA);
  });
});

describe('movimientos forzados', () => {
  it('moverA: te lleva a la casilla sin gastar la acción, y llegar a un puerto cuenta', () => {
    const { estado, puertoNuevo, destino } = moverA(partida(), c(6, 2), new Dados(1));
    expect(estado.mundo.posicion).toEqual(c(6, 2));
    expect(destino).toEqual(c(6, 2));
    expect(estado.mundo.fase).toBe('accion');
    expect(puertoNuevo).toBe(true);
    expect(estado.mundo.puertosVisitados).toEqual(['la_habana']);
  });

  it('moverA: a bordo, el barco va contigo', () => {
    const aBordo = partida(c(7, 2));
    const { estado } = moverA(aBordo, c(6, 3), new Dados(1));
    expect(estado.mundo.posicionBarco).toEqual(c(6, 3));
  });

  it('moverA: error si la casilla está fuera del mapa o bloqueada', () => {
    expect(() => moverA(partida(), c(40, 0), new Dados(1))).toThrow(/fuera del mapa/);
    const bloqueada = partida(c(6, 0), { marcas: [{ col: 6, fila: 1, tipo: 'casilla_bloqueada' }] });
    expect(() => moverA(bloqueada, c(6, 1), new Dados(1))).toThrow(/bloqueada/);
  });

  it('echarAVecinaAlAzar: solo a tierra y nunca a una casilla bloqueada', () => {
    // Desde 6,0 las vecinas de tierra son 7,0 · 6,1 · 5,0 (en ese orden); el 1 elige la segunda
    const { destino } = echarAVecinaAlAzar(partida(), dadosTrucados([1]));
    expect(destino).toEqual(c(6, 1));

    const con61Bloqueada = partida(c(6, 0), { marcas: [{ col: 6, fila: 1, tipo: 'casilla_bloqueada' }] });
    for (let semilla = 1; semilla <= 30; semilla++) {
      expect(echarAVecinaAlAzar(con61Bloqueada, new Dados(semilla)).destino).not.toEqual(c(6, 1));
    }
  });

  it('echarAVecinaAlAzar: a bordo no se mueve nada', () => {
    const { destino, estado } = echarAVecinaAlAzar(partida(c(7, 2)), new Dados(1));
    expect(destino).toBeNull();
    expect(estado.mundo.posicion).toEqual(c(7, 2));
  });

  it('desviar a pie: se para antes del agua (de 6,0 hacia el S, 5 casillas → La Habana, 6,2)', () => {
    const { destino, estado } = desviar(partida(), 'S', 5, new Dados(1));
    expect(destino).toEqual(c(6, 2));
    expect(estado.mundo.puertosVisitados).toEqual(['la_habana']);
  });

  it('desviar a bordo: solo por agua; si la primera casilla es tierra, no se mueve', () => {
    const aBordo = partida(c(7, 2));
    expect(desviar(aBordo, 'NO', 3, new Dados(1)).destino).toBeNull(); // al NO está La Habana (tierra)
    const { destino } = desviar(aBordo, 'S', 2, new Dados(1));
    expect(destino).not.toBeNull();
    expect(esAgua(terreno(destino!))).toBe(true);
  });

  it('desviar: si se sale del mapa, se queda en la última casilla válida antes del borde', () => {
    expect(desviar(partida(c(6, 1)), 'N', 9, new Dados(1)).destino).toEqual(c(6, 0));
  });

  it('avanzar con condición: se para antes de la primera casilla que no la cumple', () => {
    const soloTierra = (x: { terreno: string }) => x.terreno !== 'costa' && x.terreno !== 'alta_mar';
    expect(avanzar(mapa, c(6, 0), 'S', 5, soloTierra)).toEqual(c(6, 2));
    expect(avanzar(mapa, c(6, 0), 'S', 5)).toEqual(c(6, 5));
  });
});
