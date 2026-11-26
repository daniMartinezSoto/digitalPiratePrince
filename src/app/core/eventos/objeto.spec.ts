import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import type { ResultadoMotor } from './motor';
import { continuarEvento, elegirOpcion, lanzarEventos, tirarDadosDelEvento, usarAmuletoDelDestino, vistaDelEvento } from './motor';

// Objeto flotante no identificado (E014), decidido por el autor el 26-nov: primero eliges si investigar;
// el cuerpo (4-6) siempre lleva después la tirada de contagio, que se tira sola (1-2 → pandemia);
// el náufrago (11-12) te deja elegir: seguidor al azar inseparable (si cabe) o +1 de tripulación.
// La tirada de 2d6 se fija con "resultadoTrucado" (la trampa de la pantalla de pruebas).

function estadoCon(seguidores: Seguidor[] = []): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', oro: 50, tripulacion: 20, comida: 2, inventario: [], seguidores, condiciones: [] },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

const seguidor = (id: string): Seguidor => ({ id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] });
const vista = (r: ResultadoMotor) => vistaDelEvento(r.estado)!;
const tirar = (r: ResultadoMotor, resultado: number, dados: Dados = dadosTrucados([])) => tirarDadosDelEvento(r.estado, dados, { resultadoTrucado: resultado });

/** Investiga y fija la tirada de 2d6. */
function investigar(resultado: number, estado = estadoCon(), dados?: Dados): ResultadoMotor {
  const r = elegirOpcion(lanzarEventos(estado, ['objeto'], new Dados(1)).estado, 0, new Dados(1));
  expect(vista(r).modo).toBe('tirada');
  expect(vista(r).tirada!.boton).toBe('¿Qué será?');
  return tirar(r, resultado, dados);
}

/** Pulsa "Continuar" hasta el final y junta los eventos pendientes que vayan saliendo. */
function hastaElFinal(r: ResultadoMotor): { r: ResultadoMotor; pendientes: string[] } {
  const pendientes = [...r.pendientes];
  for (let i = 0; i < 10 && !r.terminado; i++) {
    expect(vista(r).modo).toBe('continuar');
    r = continuarEvento(r.estado, new Dados(1));
    pendientes.push(...r.pendientes);
  }
  expect(r.terminado).toBe(true);
  return { r, pendientes };
}

describe('objeto flotante no identificado (E014)', () => {
  it('al principio eliges: investigar o seguir tu rumbo (y entonces no pasa nada)', () => {
    const lanzado = lanzarEventos(estadoCon(), ['objeto'], new Dados(1));
    expect(vista(lanzado).opciones!.map(o => o.texto)).toEqual(['Acercarse a investigar', 'Seguir tu rumbo']);

    const { r } = hastaElFinal(elegirOpcion(lanzado.estado, 1, new Dados(1)));
    expect(r.estado.jugador).toEqual(estadoCon().jugador);
  });

  it('2-3: el barril de pólvora, −2d6 de tripulación', () => {
    const r = investigar(2, estadoCon(), new Dados(1));
    expect(r.estado.jugador.tripulacion).toBeGreaterThanOrEqual(8);
    expect(r.estado.jugador.tripulacion).toBeLessThanOrEqual(18);
  });

  describe('4-6: el cuerpo', () => {
    it('se registra y después, sola, la tirada de contagio: con 1-2 salta la pandemia', () => {
      const cuerpo = investigar(5);
      expect(vista(cuerpo).tirada!.boton).toBe('Registrar el cuerpo');

      // 2 = la bolsa pequeña (+20); el contagio se tira solo con el dado que viene: un 2.
      const contagio = dadosTrucados([2]);
      const r = tirar(cuerpo, 2, contagio);
      expect(contagio.restantes()).toBe(0);
      expect(r.estado.jugador.oro).toBe(70);
      expect(hastaElFinal(r).pendientes).toEqual(['pandemia']);
    });

    it('con 3-6 en el contagio no pasa nada más', () => {
      const r = tirar(investigar(4), 3, dadosTrucados([3]));
      expect(r.estado.jugador.oro).toBe(90);
      expect(hastaElFinal(r).pendientes).toEqual([]);
    });

    it('también se tira el contagio si el cuerpo no llevaba nada', () => {
      const contagio = dadosTrucados([1]);
      const r = tirar(investigar(6), 1, contagio);
      expect(contagio.restantes()).toBe(0);
      expect(hastaElFinal(r).pendientes).toEqual(['pandemia']);
    });

    it('lo que lleva a otro evento (el mapa, aún pendiente) vuelve y después se tira el contagio', () => {
      const r = tirar(investigar(4), 4, new Dados(1));
      const { pendientes } = hastaElFinal(r);
      expect(pendientes[0]).toBe('mapa_misterioso');
    });
  });

  it('7: el bote de piratas, +1d6 de tripulación', () => {
    const r = investigar(7, estadoCon(), new Dados(1));
    expect(r.estado.jugador.tripulacion).toBeGreaterThanOrEqual(21);
    expect(r.estado.jugador.tripulacion).toBeLessThanOrEqual(26);
  });

  it('8-9: la caja; con un 2 hay otra caja dentro y se vuelve a tirar', () => {
    let r = investigar(8);
    expect(vista(r).tirada!.boton).toBe('Abrir la caja');
    r = tirar(r, 2);
    expect(vista(r).modo).toBe('tirada');
    r = tirar(r, 4);
    expect(r.estado.jugador.oro).toBe(100);
  });

  it('10: el mapa en un frasco (pendiente)', () => {
    expect(hastaElFinal(investigar(10)).pendientes).toEqual(['mapa_misterioso']);
  });

  describe('11-12: el náufrago', () => {
    it('con sitio en el grupo: seguidor al azar, inseparable', () => {
      const r = investigar(12);
      expect(vista(r).opciones).toEqual([
        { texto: 'Que te acompañe como seguidor', disponible: true },
        { texto: 'Que se una a la tripulación', disponible: true },
      ]);
      const elegido = elegirOpcion(r.estado, 0, new Dados(1));
      expect(elegido.estado.jugador.seguidores).toHaveLength(1);
      expect(elegido.estado.jugador.seguidores[0].inseparable).toBe(true);
    });

    it('con el grupo lleno: seguidor desactivado, "hacer sitio" aparece y a la tripulación, +1', () => {
      const lleno = estadoCon([seguidor('uno'), seguidor('dos')]);
      const r = investigar(11, lleno);
      expect(vista(r).opciones).toEqual([
        { texto: 'Que te acompañe como seguidor', disponible: false, motivo: 'grupo_lleno' },
        { texto: 'Hacerle sitio despidiendo a alguien', disponible: true },
        { texto: 'Que se una a la tripulación', disponible: true },
      ]);

      const elegido = elegirOpcion(r.estado, 2, new Dados(1));
      expect(elegido.estado.jugador.tripulacion).toBe(21);
      expect(elegido.estado.jugador.seguidores).toHaveLength(2);
    });

    it('hacer sitio: eliges a quién despides (o "Mejor no", y vuelves a las opciones)', () => {
      // El hermano es inseparable: no sale en la lista.
      const lleno = estadoCon([{ ...seguidor('hermano'), inseparable: true }, seguidor('uno')]);
      const r = elegirOpcion(investigar(11, lleno).estado, 1, new Dados(1));
      expect(vista(r).opciones).toEqual([
        { texto: '', disponible: true, despide: { nombre: 'uno', tipo: 'forzudo' } },
        { texto: '', disponible: true, volver: true },
      ]);

      const atras = elegirOpcion(r.estado, 1, new Dados(1));
      expect(vista(atras).opciones!.map(o => o.texto)).toEqual(['Que te acompañe como seguidor', 'Hacerle sitio despidiendo a alguien', 'Que se una a la tripulación']);

      const despedido = elegirOpcion(r.estado, 0, new Dados(1));
      const seguidores = despedido.estado.jugador.seguidores;
      expect(seguidores).toHaveLength(2);
      expect(seguidores.map(s => s.id)).not.toContain('uno');
      expect(seguidores[0].id).toBe('hermano');
      expect(seguidores[1].inseparable).toBe(true);
    });
  });
});

describe('amuleto maldito (E027) y amuleto del destino', () => {
  it('en la tirada del amuleto maldito no se puede usar el amuleto del destino', () => {
    const conDestino: Estado = { ...estadoCon(), jugador: { ...estadoCon().jugador, inventario: [{ id: 'amuleto_del_destino', usosRestantes: 1 }] } };
    const r = lanzarEventos(conDestino, ['amuleto_maldito'], new Dados(1));

    expect(vista(r).tirada!.puedeElegir).toBe(false);
    expect(() => usarAmuletoDelDestino(r.estado, new Dados(1))).toThrow(/no se puede usar/);
  });
});
