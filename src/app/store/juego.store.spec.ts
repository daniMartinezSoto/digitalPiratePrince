import { TestBed } from '@angular/core/testing';
import { pescar } from '../core/acciones/pescar';
import { aplicarEfectos } from '../core/efectos/aplicar-efectos';
import { CLAVES_DE_GUARDADO } from '../core/guardado/almacen';
import { AlmacenEnMemoria } from '../core/guardado/almacen-en-memoria';
import { guardarCronica, leerCronica } from '../core/guardado/cronica';
import { guardarPartida, } from '../core/guardado/guardar-partida';
import { leerPartida } from '../core/guardado/leer-partida';
import { crearPartida } from '../core/partida/crear-partida';
import { SEMILLA_MAXIMA } from '../core/partida/semilla';
import { comer } from '../core/turno/comer';
import { iniciarTurno } from '../core/turno/iniciar-turno';
import { ALMACEN, GENERAR_SEMILLA, JuegoStore, RELOJ, semillaAlAzar } from './juego.store';

const FECHA = '2026-11-19T12:30:00.000Z';
const SEMILLA_FIJA = 123456;

/** Abre el juego con este almacén (como si el jugador abriera la página). */
function abrirJuego(almacen: AlmacenEnMemoria): JuegoStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ALMACEN, useValue: almacen },
      { provide: RELOJ, useValue: () => FECHA },
      { provide: GENERAR_SEMILLA, useValue: () => SEMILLA_FIJA },
    ],
  });
  return TestBed.inject(JuegoStore);
}

/** Un día: amanecer y pescar a bordo (deja la partida en la fase de comida). */
function amanecerYPescar(store: JuegoStore): void {
  store.ejecutar((estado, dados) => iniciarTurno(estado, dados));
  store.ejecutar((estado, dados) => pescar(estado, { lugar: 'barco' }, dados));
}

describe('JuegoStore: abrir el juego', () => {
  it('sin nada guardado: no hay partida, la crónica está vacía y no hay avisos', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    expect(store.estado()).toBeNull();
    expect(store.hayPartidaEnCurso()).toBe(false);
    expect(store.cronica()).toEqual([]);
    expect(store.avisos()).toEqual([]);
  });

  it('con una partida guardada, la recupera tal cual', () => {
    const almacen = new AlmacenEnMemoria();
    const { estado } = crearPartida(777, 'Marta');
    almacen.escribir(CLAVES_DE_GUARDADO.partida, guardarPartida(estado));
    const store = abrirJuego(almacen);
    expect(store.estado()).toEqual(estado);
    expect(store.hayPartidaEnCurso()).toBe(true);
  });

  it('con una partida estropeada: aviso, copia de seguridad y no la carga', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir(CLAVES_DE_GUARDADO.partida, '{"version": 1, roto');
    const store = abrirJuego(almacen);
    expect(store.estado()).toBeNull();
    expect(store.avisos()).toEqual(['partida_no_recuperada']);
    expect(almacen.leer(CLAVES_DE_GUARDADO.partidaEstropeada)).toBe('{"version": 1, roto');
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBeNull();
  });

  it('con una partida de una versión futura: igual (aviso y copia de seguridad)', () => {
    const almacen = new AlmacenEnMemoria();
    const datos = JSON.parse(guardarPartida(crearPartida(1, 'Marta').estado));
    datos.version = 99;
    almacen.escribir(CLAVES_DE_GUARDADO.partida, JSON.stringify(datos));
    const store = abrirJuego(almacen);
    expect(store.estado()).toBeNull();
    expect(store.avisos()).toEqual(['partida_no_recuperada']);
    expect(almacen.leer(CLAVES_DE_GUARDADO.partidaEstropeada)).not.toBeNull();
  });

  it('recupera la crónica guardada', () => {
    const almacen = new AlmacenEnMemoria();
    const ficha = {
      semilla: 1, nombre: 'Marta', sobrenombre: 'el_fuerte', retrato: 'mujer' as const, dias: 9,
      fama: 4, oro: 60, resultado: 'derrota' as const, motivo: 'vida' as const, fecha: FECHA,
    };
    almacen.escribir(CLAVES_DE_GUARDADO.cronica, guardarCronica([ficha]));
    expect(abrirJuego(almacen).cronica()).toEqual([ficha]);
  });

  it('con la crónica estropeada: aviso, copia de seguridad y crónica nueva (sin perder la vieja)', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir(CLAVES_DE_GUARDADO.cronica, 'esto no es una crónica');
    const store = abrirJuego(almacen);
    expect(store.cronica()).toEqual([]);
    expect(store.avisos()).toEqual(['cronica_estropeada']);
    expect(almacen.leer(CLAVES_DE_GUARDADO.cronicaEstropeada)).toBe('esto no es una crónica');
  });
});

describe('JuegoStore: partida nueva', () => {
  it('sin semilla, usa una al azar y la guarda en el acto', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    store.nuevaPartida('Marta', 'mujer');
    expect(store.estado()?.mundo.semilla).toBe(SEMILLA_FIJA);
    expect(store.estado()?.jugador.retrato).toBe('mujer');
    expect(store.hayPartidaEnCurso()).toBe(true);
    const guardada = leerPartida(almacen.leer(CLAVES_DE_GUARDADO.partida)!);
    expect(guardada.ok && guardada.estado).toEqual(store.estado());
  });

  it('con semilla elegida, la misma partida que crearPartida', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Marta', 'hombre', 482913);
    expect(store.estado()).toEqual(crearPartida(482913, 'Marta', 'hombre').estado);
  });

  it('los eventos del principio entran en la pila ("el maldito" de la semilla 7 tiene el deseo)', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    expect(crearPartida(7, 'Marta').eventos).toEqual(['deseo']);
    // El deseo está programado: no sale como pendiente, sino en la pila del motor (Sprint 10).
    expect(store.nuevaPartida('Marta', 'hombre', 7)).toEqual([]);
    expect(store.estado()!.mundo.pilaEventos.map(m => m.evento)).toEqual(['deseo']);
  });

  it.each([-1, SEMILLA_MAXIMA + 1, 1.5])('la semilla %s no vale', semilla => {
    const store = abrirJuego(new AlmacenEnMemoria());
    expect(() => store.nuevaPartida('Marta', 'hombre', semilla)).toThrow();
    expect(store.estado()).toBeNull();
  });

  it('con una partida en curso no se puede empezar otra (hay que abandonar)', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Marta');
    expect(() => store.nuevaPartida('Otra')).toThrow();
  });
});

describe('JuegoStore: jugar, cerrar y volver', () => {
  it('cada acción se guarda sola, en el acto', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    store.nuevaPartida('Marta', 'hombre', 555);
    amanecerYPescar(store);
    expect(store.estado()?.mundo.fase).toBe('comida');
    const guardada = leerPartida(almacen.leer(CLAVES_DE_GUARDADO.partida)!);
    expect(guardada.ok && guardada.estado).toEqual(store.estado());
  });

  it('ejecutar devuelve el resultado completo de la regla (para enseñarlo)', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Marta', 'hombre', 555);
    store.ejecutar((estado, dados) => iniciarTurno(estado, dados));
    const resultado = store.ejecutar((estado, dados) => pescar(estado, { lugar: 'barco' }, dados));
    expect(resultado.estado).toEqual(store.estado());
    expect(resultado.cambios).toBeDefined();
  });

  it('al cerrar y volver a abrir, sigue la misma partida y los dados sacan lo mismo', () => {
    // Partida A: se juega sin cerrar.
    const sinCerrar = abrirJuego(new AlmacenEnMemoria());
    sinCerrar.nuevaPartida('Marta', 'hombre', 555);
    amanecerYPescar(sinCerrar);
    sinCerrar.ejecutar((estado, dados) => comer(estado, 'reservas', 'barco', dados));

    // Partida B: la misma, pero cerrando el juego tras pescar.
    const almacen = new AlmacenEnMemoria();
    const antes = abrirJuego(almacen);
    antes.nuevaPartida('Marta', 'hombre', 555);
    amanecerYPescar(antes);
    const despues = abrirJuego(almacen); // "vuelve a abrir el juego"
    expect(despues.estado()).toEqual(antes.estado());
    despues.ejecutar((estado, dados) => comer(estado, 'reservas', 'barco', dados));

    expect(despues.estado()).toEqual(sinCerrar.estado());
  });

  it('si una regla da error, la partida y los dados se quedan como estaban', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Marta', 'hombre', 555);
    const antes = store.estado();
    expect(() =>
      store.ejecutar((estado, dados) => {
        dados.tirar('3d6'); // gasta dados...
        throw new Error('...y falla');
      }),
    ).toThrow('...y falla');
    expect(store.estado()).toBe(antes);

    // Los dados siguen donde estaban: la próxima acción sale igual que sin el error.
    const otra = abrirJuego(new AlmacenEnMemoria());
    otra.nuevaPartida('Marta', 'hombre', 555);
    store.ejecutar((estado, dados) => iniciarTurno(estado, dados));
    otra.ejecutar((estado, dados) => iniciarTurno(estado, dados));
    expect(store.estado()).toEqual(otra.estado());
  });

  it('sin partida en curso no se puede ejecutar nada', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    expect(() => store.ejecutar((estado, dados) => iniciarTurno(estado, dados))).toThrow();
  });

  it('si el navegador se niega a guardar: aviso (una vez) y el juego sigue', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    almacen.fallarAlEscribir = true;
    store.nuevaPartida('Marta', 'hombre', 555);
    amanecerYPescar(store);
    expect(store.estado()?.mundo.fase).toBe('comida');
    expect(store.avisos()).toEqual(['no_se_pudo_guardar']);
    store.descartarAvisos();
    expect(store.avisos()).toEqual([]);
  });
});

describe('JuegoStore: final de la partida', () => {
  it('al morir: ficha en la crónica, partida fuera del almacén y la hoja final a la vista', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    store.nuevaPartida('Marta', 'mujer', 482913);
    store.ejecutar((estado, dados) => aplicarEfectos(estado, [{ tipo: 'vida', operacion: 'todo' }], dados));

    expect(store.hayPartidaEnCurso()).toBe(false);
    expect(store.estado()?.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'vida' });
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBeNull();
    expect(store.cronica()).toHaveLength(1);
    expect(store.cronica()[0]).toMatchObject({ semilla: 482913, nombre: 'Marta', resultado: 'derrota', motivo: 'vida', fecha: FECHA });
    const cronicaGuardada = leerCronica(almacen.leer(CLAVES_DE_GUARDADO.cronica)!);
    expect(cronicaGuardada.ok && cronicaGuardada.entradas).toEqual(store.cronica());
  });

  it('después de morir, al volver a abrir no hay partida pero sí la crónica', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    store.nuevaPartida('Marta', 'mujer', 482913);
    store.ejecutar((estado, dados) => aplicarEfectos(estado, [{ tipo: 'vida', operacion: 'todo' }], dados));
    const otraVez = abrirJuego(almacen);
    expect(otraVez.estado()).toBeNull();
    expect(otraVez.cronica()).toHaveLength(1);
  });

  it('después de terminar ya no se puede ejecutar, pero sí empezar otra partida', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Marta', 'mujer', 1);
    store.ejecutar((estado, dados) => aplicarEfectos(estado, [{ tipo: 'ganar_partida' }], dados));
    expect(() => store.ejecutar((estado, dados) => iniciarTurno(estado, dados))).toThrow();
    store.nuevaPartida('Marta II', 'mujer', 2);
    expect(store.hayPartidaEnCurso()).toBe(true);
    expect(store.cronica()[0].resultado).toBe('victoria');
  });

  it('abandonar: derrota por abandono en la crónica y se puede empezar otra', () => {
    const almacen = new AlmacenEnMemoria();
    const store = abrirJuego(almacen);
    store.nuevaPartida('Marta', 'mujer', 10);
    store.abandonar();
    expect(store.hayPartidaEnCurso()).toBe(false);
    expect(store.cronica()[0]).toMatchObject({ resultado: 'derrota', motivo: 'abandono' });
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBeNull();
    store.nuevaPartida('Marta II', 'mujer', 11);
    expect(store.hayPartidaEnCurso()).toBe(true);
  });

  it('sin partida en curso no se puede abandonar', () => {
    expect(() => abrirJuego(new AlmacenEnMemoria()).abandonar()).toThrow();
  });

  it('las partidas se van sumando a la crónica, ordenadas por fama', () => {
    const store = abrirJuego(new AlmacenEnMemoria());
    store.nuevaPartida('Pobre', 'hombre', 1);
    store.abandonar();
    store.nuevaPartida('Famosa', 'mujer', 2);
    store.ejecutar((estado, dados) => aplicarEfectos(estado, [{ tipo: 'fama', cantidad: 5 }], dados));
    store.abandonar();
    expect(store.cronica().map(e => e.nombre)).toEqual(['Famosa', 'Pobre']);
  });

  it('con la crónica estropeada y sin poder hacer la copia, no se escribe encima', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir(CLAVES_DE_GUARDADO.cronica, 'crónica rota');
    almacen.fallarAlEscribir = true; // ni la copia de seguridad se puede hacer
    const store = abrirJuego(almacen);
    almacen.fallarAlEscribir = false;
    store.nuevaPartida('Marta', 'mujer', 1);
    store.abandonar();
    expect(almacen.leer(CLAVES_DE_GUARDADO.cronica)).toBe('crónica rota');
    expect(store.avisos()).toContain('no_se_pudo_guardar');
  });
});

describe('semillaAlAzar', () => {
  it('siempre da un entero de 0 a 999.999', () => {
    for (let i = 0; i < 200; i++) {
      const semilla = semillaAlAzar();
      expect(Number.isInteger(semilla)).toBe(true);
      expect(semilla).toBeGreaterThanOrEqual(0);
      expect(semilla).toBeLessThanOrEqual(SEMILLA_MAXIMA);
    }
  });
});
