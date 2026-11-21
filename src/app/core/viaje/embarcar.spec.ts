import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { vasABordo } from '../mapa/donde-estas';
import { obtenerMapa } from '../mapa/cargar-mapas';
import { vecinas } from '../mapa/hexagonos';
import { casillaEn, type Coordenada } from '../mapa/mapa';
import { esAgua } from '../turno/lugar';
import { crearPartida } from '../partida/crear-partida';
import { casillasDeEmbarque, desembarcar, embarcar, opcionesDeEmbarque, sePuedeAtracar } from './embarcar';

// En el primer mapa: La Habana (6,2, puerto sobre playa) y el barco al empezar en 7,2 (su vecina SE).
const c = (col: number, fila: number) => ({ col, fila });
const LA_HABANA = c(6, 2);
const BARCO = c(7, 2);

function partida(posicion: Coordenada, jugador: Partial<Jugador> = {}, fase: Estado['mundo']['fase'] = 'accion'): Estado {
  const { estado } = crearPartida(123, 'Marta');
  return {
    ...estado,
    jugador: { ...estado.jugador, condiciones: [], ...jugador },
    mundo: { ...estado.mundo, posicion, posicionBarco: BARCO, fase },
  };
}

describe('desembarcar y embarcar', () => {
  // Cambiado por el autor el 21-nov: hay islas sin playa, así que también vale la jungla normal.
  it('se atraca en cualquier tierra menos la jungla profunda (un puerto, siempre); nunca en el agua', () => {
    const e = partida(LA_HABANA);
    expect(sePuedeAtracar(e, LA_HABANA)).toBe(true); // playa con puerto
    expect(sePuedeAtracar(e, c(14, 11))).toBe(true); // Cala Ventura: puerto sobre jungla
    expect(sePuedeAtracar(e, c(6, 1))).toBe(true); // jungla
    expect(sePuedeAtracar(e, c(5, 0))).toBe(false); // jungla profunda
    expect(sePuedeAtracar(e, BARCO)).toBe(false); // agua
  });

  it('desde La Habana, junto al barco, se puede embarcar', () => {
    expect(opcionesDeEmbarque(partida(LA_HABANA))).toEqual({ desembarcar: [], embarcar: true });
  });

  it('embarcar: subes al barco, sin gastar la acción', () => {
    const { estado } = embarcar(partida(LA_HABANA));
    expect(vasABordo(estado)).toBe(true);
    expect(estado.mundo.posicion).toEqual(BARCO);
    expect(estado.mundo.fase).toBe('accion');
  });

  it('a bordo, se puede bajar solo a playas o puertos vecinos del barco', () => {
    const mapa = obtenerMapa('primer-mapa-prueba');
    const { desembarcar: casillas } = opcionesDeEmbarque(partida(BARCO));
    expect(casillas).toContainEqual(LA_HABANA);
    for (const x of casillas) {
      const casilla = casillaEn(mapa, x.col, x.fila)!;
      expect(esAgua(casilla.terreno)).toBe(false);
      expect(casilla.terreno !== 'jungla_profunda' || casilla.rasgo === 'puerto').toBe(true);
    }
  });

  it('desembarcar en un puerto cuenta como llegar: La Habana queda visitada (y no gasta la acción)', () => {
    const { estado, puertoNuevo } = desembarcar(partida(BARCO), LA_HABANA, new Dados(1));
    expect(estado.mundo.posicion).toEqual(LA_HABANA);
    expect(estado.mundo.posicionBarco).toEqual(BARCO); // el barco se queda
    expect(estado.mundo.puertosVisitados).toEqual(['la_habana']);
    expect(puertoNuevo).toBe(true);
    expect(estado.mundo.fase).toBe('accion');
  });

  it('al bajar a tierra se cura el escorbuto', () => {
    const { estado, cambios } = desembarcar(partida(BARCO, { condiciones: [{ id: 'escorbuto' }] }), LA_HABANA, new Dados(1));
    expect(estado.jugador.condiciones).toEqual([]);
    expect(cambios).toContainEqual({ tipo: 'condicion_quitada', condicion: 'escorbuto' });
  });

  it('una sola vez por turno: tras bajar no se puede volver a subir ese día', () => {
    const { estado } = desembarcar(partida(BARCO), LA_HABANA, new Dados(1));
    expect(opcionesDeEmbarque(estado)).toEqual({ desembarcar: [], embarcar: false, motivo: 'ya_usado_hoy' });
    expect(() => embarcar(estado)).toThrow(/ya_usado_hoy/);
    // Al día siguiente, sí
    const manana: Estado = { ...estado, mundo: { ...estado.mundo, dia: estado.mundo.dia + 1 } };
    expect(opcionesDeEmbarque(manana).embarcar).toBe(true);
  });

  it('solo antes de elegir la acción (fase de acción, sin acción a medias)', () => {
    expect(opcionesDeEmbarque(partida(LA_HABANA, {}, 'inicio')).motivo).toBe('no_es_momento');
    expect(opcionesDeEmbarque(partida(LA_HABANA, {}, 'comida')).motivo).toBe('no_es_momento');
    const enElMercado = partida(LA_HABANA);
    const aMedias: Estado = { ...enElMercado, mundo: { ...enElMercado.mundo, accionEnCurso: { tipo: 'mercado', rastrillo: null } } };
    expect(opcionesDeEmbarque(aMedias).motivo).toBe('no_es_momento');
  });

  it('lejos del barco, o en una casilla donde no se atraca (jungla profunda), no se puede embarcar', () => {
    expect(opcionesDeEmbarque(partida(c(6, 0))).motivo).toBe('lejos_del_barco');
    // Una casilla de jungla profunda con agua al lado, y el barco en esa agua
    const mapa = obtenerMapa('primer-mapa-prueba');
    const jungla = mapa.casillas.find(x => x.terreno === 'jungla_profunda' && !x.rasgo && vecinas(mapa, x).some(v => esAgua(casillaEn(mapa, v.col, v.fila)!.terreno)))!;
    const agua = vecinas(mapa, jungla).find(v => esAgua(casillaEn(mapa, v.col, v.fila)!.terreno))!;
    const e = partida(c(jungla.col, jungla.fila));
    const barcoAlLado: Estado = { ...e, mundo: { ...e.mundo, posicionBarco: agua } };
    expect(opcionesDeEmbarque(barcoAlLado).motivo).toBe('aqui_no_se_atraca');
  });

  it('no se puede bajar a una casilla que no está en la lista', () => {
    expect(() => desembarcar(partida(BARCO), c(6, 1), new Dados(1))).toThrow(/no se puede bajar a 6,1/);
  });

  it('las casillas para marcar en amarillo: las de bajar si vas a bordo, la del barco si puedes subir', () => {
    expect(casillasDeEmbarque(partida(LA_HABANA))).toEqual([BARCO]);
    expect(casillasDeEmbarque(partida(BARCO))).toEqual(opcionesDeEmbarque(partida(BARCO)).desembarcar);
    expect(casillasDeEmbarque(partida(c(6, 0)))).toEqual([]); // lejos del barco
    expect(casillasDeEmbarque(partida(LA_HABANA, {}, 'comida'))).toEqual([]); // ya no es el momento
  });

  it('desembarcar en una guarida sin explorar lanza su evento (E038), como al llegar viajando', () => {
    // La guarida de 21,19 está sobre jungla normal: se busca una casilla de agua a su lado para el barco
    const mapa = obtenerMapa('primer-mapa-prueba');
    const guarida = c(21, 19);
    const agua = vecinas(mapa, guarida).find(v => esAgua(casillaEn(mapa, v.col, v.fila)!.terreno));
    if (!agua) return; // en este mapa no tiene agua al lado: no se puede probar aquí
    const e = partida(agua);
    const aBordo: Estado = { ...e, mundo: { ...e.mundo, posicionBarco: agua } };
    expect(desembarcar(aBordo, guarida, new Dados(1)).eventos).toContain('guarida_pirata');
  });
});
