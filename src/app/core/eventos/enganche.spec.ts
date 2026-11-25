import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { pescar } from '../acciones/pescar';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Fase } from '../estado/fase';
import type { Jugador } from '../estado/jugador';
import { objetosUsablesAhora } from '../objetos/consultas';
import { tirarObjeto } from '../objetos/tirar-objeto';
import { usarObjeto } from '../objetos/usar-objeto';
import { crearPartida } from '../partida/crear-partida';
import type { ListaEventos } from '../tablas/listas-eventos/lista-eventos';
import { eventoAleatorio } from '../tablas/listas-eventos/elegir-evento';
import { comer } from '../turno/comer';
import { descansar } from '../turno/descansar';
import { iniciarTurno } from '../turno/iniciar-turno';
import { opcionesDeEmbarque } from '../viaje/embarcar';
import { conSusEventos } from './con-sus-eventos';
import type { Evento } from './evento';
import { continuarEvento, elegirOpcion, lanzarEventos, vistaDelEvento } from './motor';
import { hayEventoEnCurso, sinEventosYaOcurridos } from './una-vez';

// El motor enganchado al juego (Sprint 10, paso 4): la puerta conSusEventos, el bloqueo de todo lo
// demás mientras hay un evento y los eventos de una sola vez en las listas de terreno.

function estadoCon(fase: Fase = 'accion', jugador: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', inventario: [], seguidores: [], condiciones: [], ...jugador },
    mundo: { ...estado.mundo, fase },
  };
}

/** El mismo estado, con el deseo abierto (esperando a que elijas). */
function conElDeseoAbierto(estado: Estado): Estado {
  return lanzarEventos(estado, ['deseo'], new Dados(1)).estado;
}

describe('conSusEventos: la puerta de los eventos', () => {
  it('sin eventos, devuelve el resultado tal cual (con pendientes vacío)', () => {
    const resultado = { estado: estadoCon(), cambios: [], eventos: [] as string[] };
    const r = conSusEventos(resultado, new Dados(1));

    expect(r.estado).toBe(resultado.estado);
    expect(r.pendientes).toEqual([]);
    expect(r.cambiosDeEventos).toEqual([]);
  });

  it('los eventos programados entran en la pila y el resto de la respuesta se conserva', () => {
    const r = conSusEventos({ estado: estadoCon(), cambios: [], eventos: ['deseo'], tirada: 'lo que fuera' }, new Dados(1));

    expect(hayEventoEnCurso(r.estado)).toBe(true);
    expect(vistaDelEvento(r.estado)!.titulo).toBe('Deseo');
    expect(r.tirada).toBe('lo que fuera');
  });

  it('los que no existen salen en "pendientes" y no bloquean nada', () => {
    const r = conSusEventos({ estado: estadoCon(), eventos: ['taberna_clandestina'] }, new Dados(1));

    expect(r.pendientes).toEqual(['taberna_clandestina']);
    expect(hayEventoEnCurso(r.estado)).toBe(false);
  });

  it('una mezcla: los programados a la pila y los otros a pendientes, en orden', () => {
    const r = conSusEventos({ estado: estadoCon(), eventos: ['taberna_clandestina', 'deseo'] }, new Dados(1));

    expect(r.pendientes).toEqual(['taberna_clandestina']);
    expect(vistaDelEvento(r.estado)!.titulo).toBe('Deseo');
  });

  it('si la partida ha terminado, no lanza nada', () => {
    const terminada = estadoCon();
    terminada.mundo.finPartida = { resultado: 'derrota', motivo: 'vida' };

    const r = conSusEventos({ estado: terminada, eventos: ['deseo'] }, new Dados(1));

    expect(r.estado.mundo.pilaEventos).toEqual([]);
  });

  it('con una regla de verdad: tras la acción, la fase ya es "comida" y el evento se juega encima', () => {
    // Una acción cualquiera que no lance eventos, a la que le añadimos uno, como haría la pantalla.
    const accion = pescar(estadoCon(), { lugar: 'barco', juntoAlAgua: true }, new Dados(3));
    const r = conSusEventos({ ...accion, eventos: ['deseo'] }, new Dados(3));

    expect(r.estado.mundo.fase).toBe('comida');
    expect(hayEventoEnCurso(r.estado)).toBe(true);
    expect(() => comer(r.estado, 'reservas', 'barco', new Dados(1))).toThrow(/hay un evento en curso/);

    // Al terminar el deseo, ya se puede comer.
    const elegido = elegirOpcion(r.estado, 2, new Dados(1));
    const fin = continuarEvento(elegido.estado, new Dados(1));
    expect(fin.terminado).toBe(true);
    expect(() => comer(fin.estado, 'reservas', 'barco', new Dados(1))).not.toThrow();
  });
});

describe('mientras hay un evento, no se puede hacer nada más', () => {
  it('las acciones salen desactivadas con el motivo "evento_en_curso"', () => {
    const acciones = accionesDisponibles(conElDeseoAbierto(estadoCon('accion')), { lugar: 'barco', juntoAlAgua: true });

    expect(acciones.length).toBeGreaterThan(0);
    expect(acciones.every(a => !a.disponible && a.motivo === 'evento_en_curso')).toBe(true);
  });

  it('y si se intentan igualmente, dan error', () => {
    expect(() => pescar(conElDeseoAbierto(estadoCon('accion')), { lugar: 'barco', juntoAlAgua: true }, new Dados(1))).toThrow(/hay un evento en curso/);
  });

  it('tampoco empezar el día, comer ni dormir', () => {
    expect(() => iniciarTurno(conElDeseoAbierto(estadoCon('inicio')), new Dados(1))).toThrow(/hay un evento en curso/);
    expect(() => comer(conElDeseoAbierto(estadoCon('comida')), 'reservas', 'barco', new Dados(1))).toThrow(/hay un evento en curso/);
    expect(() => descansar(conElDeseoAbierto(estadoCon('descanso')), 'a_bordo', 'barco', new Dados(1))).toThrow(/hay un evento en curso/);
  });

  it('ni usar ni tirar objetos', () => {
    const conUnguento = estadoCon('accion', { vida: 5, inventario: [{ id: 'unguento', usosRestantes: 1 }] });
    expect(objetosUsablesAhora(conUnguento)).toEqual([0]);

    const conEvento = conElDeseoAbierto(conUnguento);
    expect(objetosUsablesAhora(conEvento)).toEqual([]);
    expect(() => usarObjeto(conEvento, 0, new Dados(1))).toThrow(/hay un evento en curso/);
    expect(() => tirarObjeto(conEvento, 0, new Dados(1))).toThrow(/hay un evento en curso/);
  });

  it('ni subir o bajar del barco', () => {
    expect(opcionesDeEmbarque(conElDeseoAbierto(estadoCon('accion'))).motivo).toBe('no_es_momento');
  });
});

describe('eventos de una sola vez en las listas de terreno', () => {
  const UNA_VEZ = [
    { id: 'tesoro_unico', titulo: 'Tesoro único', unaVez: true, pasos: { inicio: { texto: 'x' } } },
    { id: 'normal', titulo: 'Normal', pasos: { inicio: { texto: 'x' } } },
  ] as unknown as Evento[];
  const LISTA: ListaEventos = {
    id: 'prueba',
    eventos: [
      { evento: 'tesoro_unico', peso: 1 },
      { evento: 'normal', peso: 3 },
    ],
  };

  it('mientras no ha salido, sigue en la lista', () => {
    expect(sinEventosYaOcurridos(LISTA, estadoCon(), UNA_VEZ)).toBe(LISTA);
  });

  it('cuando ya salió, desaparece de la lista', () => {
    const yaSalio = estadoCon();
    yaSalio.mundo.banderas = { evento_ocurrido_tesoro_unico: true };

    expect(sinEventosYaOcurridos(LISTA, yaSalio, UNA_VEZ).eventos).toEqual([{ evento: 'normal', peso: 3 }]);
  });

  it('una lista que se queda vacía no rompe nada: simplemente no pasa nada', () => {
    const vacia: ListaEventos = { id: 'vacia', eventos: [] };
    expect(eventoAleatorio(vacia, 100, new Dados(1))).toBeNull();
  });
});
