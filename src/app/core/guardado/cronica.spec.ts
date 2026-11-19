import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Efecto } from '../tablas/efecto';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import {
  anadirACronica,
  crearEntradaCronica,
  guardarCronica,
  leerCronica,
  ordenarCronica,
  VERSION_CRONICA,
  type EntradaCronica,
} from './cronica';

const FECHA = '2026-11-19T12:30:00.000Z';

/** Una partida de prueba terminada con los efectos indicados. */
function partidaTerminada(efectos: Efecto[], semilla = 482913): Estado {
  const { estado, dados } = crearPartida(semilla, 'Marta', 'mujer');
  return aplicarEfectos(estado, efectos, dados).estado;
}

/** Una ficha de prueba; solo hay que decir lo que cambia. */
function ficha(cambios: Partial<EntradaCronica>): EntradaCronica {
  return {
    semilla: 1, nombre: 'Marta', sobrenombre: 'el_afortunado', retrato: 'mujer', dias: 10,
    fama: 0, oro: 0, resultado: 'derrota', motivo: 'vida', fecha: FECHA, ...cambios,
  };
}

describe('crearEntradaCronica', () => {
  it('saca la ficha de una partida perdida (vida a 0)', () => {
    const estado = partidaTerminada([{ tipo: 'vida', operacion: 'todo' }]);
    const entrada = crearEntradaCronica(estado, FECHA);
    expect(entrada).toEqual({
      semilla: 482913,
      nombre: 'Marta',
      sobrenombre: estado.jugador.sobrenombre,
      retrato: 'mujer',
      dias: 1,
      fama: estado.jugador.fama,
      oro: estado.jugador.oro,
      resultado: 'derrota',
      motivo: 'vida',
      fecha: FECHA,
    });
  });

  it('saca la ficha de una partida ganada por un evento', () => {
    const estado = partidaTerminada([{ tipo: 'ganar_partida' }]);
    const entrada = crearEntradaCronica(estado, FECHA);
    expect(entrada.resultado).toBe('victoria');
    expect(entrada.motivo).toBe('evento');
  });

  it('da error si la partida no ha terminado', () => {
    const { estado } = crearPartida(1, 'Marta');
    expect(() => crearEntradaCronica(estado, FECHA)).toThrow();
  });
});

describe('ordenar y añadir a la crónica', () => {
  it('más fama arriba', () => {
    const lista = ordenarCronica([ficha({ nombre: 'A', fama: 3 }), ficha({ nombre: 'B', fama: 8 })]);
    expect(lista.map(e => e.nombre)).toEqual(['B', 'A']);
  });

  it('a igual fama, más oro arriba', () => {
    const lista = ordenarCronica([ficha({ nombre: 'A', fama: 6, oro: 140 }), ficha({ nombre: 'B', fama: 6, oro: 200 })]);
    expect(lista.map(e => e.nombre)).toEqual(['B', 'A']);
  });

  it('a igual fama y oro, la más antigua arriba (como un récord)', () => {
    const nueva = ficha({ nombre: 'Nueva', fama: 6, oro: 100, fecha: '2026-11-20T10:00:00.000Z' });
    const antigua = ficha({ nombre: 'Antigua', fama: 6, oro: 100, fecha: '2026-11-01T10:00:00.000Z' });
    expect(ordenarCronica([nueva, antigua]).map(e => e.nombre)).toEqual(['Antigua', 'Nueva']);
  });

  it('añadir deja la lista ordenada y no toca la original', () => {
    const original = [ficha({ nombre: 'A', fama: 5 }), ficha({ nombre: 'B', fama: 2 })];
    const copia = structuredClone(original);
    const nueva = anadirACronica(original, ficha({ nombre: 'C', fama: 4 }));
    expect(nueva.map(e => e.nombre)).toEqual(['A', 'C', 'B']);
    expect(original).toEqual(copia);
  });
});

describe('guardar y leer la crónica', () => {
  it('ida y vuelta idéntica', () => {
    const cronica = [ficha({ nombre: 'A', fama: 9, resultado: 'victoria', motivo: 'evento' }), ficha({ nombre: 'B', fama: 2, motivo: 'tripulacion' })];
    expect(leerCronica(guardarCronica(cronica))).toEqual({ ok: true, entradas: cronica, descartadas: 0 });
  });

  it('una crónica vacía también', () => {
    expect(leerCronica(guardarCronica([]))).toEqual({ ok: true, entradas: [], descartadas: 0 });
  });

  it('guarda la versión de la crónica', () => {
    expect(JSON.parse(guardarCronica([])).version).toBe(VERSION_CRONICA);
  });

  it('con una ficha real sacada de una partida', () => {
    const entrada = crearEntradaCronica(partidaTerminada([{ tipo: 'vida', operacion: 'todo' }]), FECHA);
    const resultado = leerCronica(guardarCronica([entrada]));
    expect(resultado.ok && resultado.entradas).toEqual([entrada]);
  });

  it.each(['', 'hola', '{'])('"%s" → no_se_puede_leer', texto => {
    expect(leerCronica(texto)).toEqual({ ok: false, motivo: 'no_se_puede_leer' });
  });

  it.each(['null', '[]', '42', '{}', '{"version": 1}', '{"version": 1, "entradas": {}}', '{"version": 0, "entradas": []}'])(
    '%s → no_es_una_partida',
    texto => {
      expect(leerCronica(texto)).toEqual({ ok: false, motivo: 'no_es_una_partida' });
    },
  );

  it('una crónica de una versión futura no se lee', () => {
    expect(leerCronica(`{"version": ${VERSION_CRONICA + 1}, "entradas": []}`)).toEqual({ ok: false, motivo: 'version_futura' });
  });

  it('una ficha estropeada no tira toda la crónica: se quita esa y se quedan las buenas', () => {
    const buena1 = ficha({ nombre: 'A', fama: 7 });
    const buena2 = ficha({ nombre: 'B', fama: 3 });
    const texto = JSON.stringify({
      version: VERSION_CRONICA,
      entradas: [buena2, { ...buena1, fama: 'mucha' }, buena1, null, { ...buena1, motivo: 'aburrimiento' }],
    });
    expect(leerCronica(texto)).toEqual({ ok: true, entradas: [buena1, buena2], descartadas: 3 });
  });

  it('al leer, la deja ordenada aunque el texto venga desordenado', () => {
    const texto = JSON.stringify({ version: VERSION_CRONICA, entradas: [ficha({ nombre: 'B', fama: 1 }), ficha({ nombre: 'A', fama: 5 })] });
    const resultado = leerCronica(texto);
    expect(resultado.ok && resultado.entradas.map(e => e.nombre)).toEqual(['A', 'B']);
  });
});
