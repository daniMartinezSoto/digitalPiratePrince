import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import type { ResultadoMotor } from './motor';
import { cerrarCombateDelEvento, continuarEvento, empezarCombateDelEvento, hacerChequeo, lanzarEventos, tirarDadosDelEvento, vistaDelEvento } from './motor';

// Borracho (E077), paso 7b. Decidido por el autor el 22-nov: todo POCO A POCO, para dar tensión (cada
// chequeo con su dado y su mensaje; después, para que no frene, sin "Continuar": el resultado se queda
// arriba y debajo sale el paso siguiente); la pelea sale con 1-2 y no es mortal; después de
// la pelea manda DÓNDE estás (paso "segun"): a bordo y ganando, −1 de tripulación; en un puerto, 1d6 y
// con un 1 te arrestan; en otro sitio, solo la pelea. No se puede evitar con el diplomático.

// La partida de prueba empieza en 6,0 (jungla); 6,2 es La Habana (puerto).
type Donde = 'barco' | 'puerto' | 'otro';

function estadoEn(donde: Donde, oro = 50, vida = 10): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  const posicion = donde === 'barco' ? { ...estado.mundo.posicionBarco } : donde === 'puerto' ? { col: 6, fila: 2 } : estado.mundo.posicion;
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', oro, vida, tripulacion: 20, inventario: [], seguidores: [], condiciones: [] },
    mundo: { ...estado.mundo, fase: 'accion', posicion },
  };
}

const dados = () => new Dados(1);
const continuar = (r: ResultadoMotor) => continuarEvento(r.estado, dados());
const chequeo = (r: ResultadoMotor, dado: number) => hacerChequeo(r.estado, dados(), { dadoTrucado: dado });
const vista = (r: ResultadoMotor) => vistaDelEvento(r.estado)!;

/** Los tres chequeos superados (con un 1) hasta la tirada de la pelea. */
function hastaElJaleo(donde: Donde): ResultadoMotor {
  let r = lanzarEventos(estadoEn(donde), ['borracho'], dados());
  for (let i = 0; i < 3; i++) r = chequeo(r, 1);
  return r;
}

/** Hasta el final de la pelea (sale con un 1 en el jaleo y un 6 en el encuentro: el pirata de la cuchara). */
function pelea(donde: Donde, resultado: 'victoria' | 'derrota'): ResultadoMotor {
  let r = tirarDadosDelEvento(hastaElJaleo(donde).estado, dadosTrucados([1]));
  r = tirarDadosDelEvento(r.estado, dadosTrucados([6]));
  const enCombate = empezarCombateDelEvento(r.estado, dados()).estado;
  const combate = enCombate.mundo.combate!;
  const acabado: Estado = {
    ...enCombate,
    jugador: resultado === 'derrota' ? { ...enCombate.jugador, vida: 1 } : enCombate.jugador,
    mundo: {
      ...enCombate.mundo,
      combate: { ...combate, resultado, enemigos: resultado === 'victoria' ? combate.enemigos.map(e => ({ ...e, resistencia: 0 })) : combate.enemigos },
    },
  };
  return cerrarCombateDelEvento(acabado, new Dados(3));
}

describe('borracho (E077)', () => {
  it('empieza con el primer chequeo de Fuerza (y su dibujo)', () => {
    const r = lanzarEventos(estadoEn('otro'), ['borracho'], dados());

    expect(vista(r)).toMatchObject({ modo: 'chequeo', chequeo: { caracteristica: 'fuerza' }, imagen: 'eventos/borracho.png' });
    expect(vista(r).texto).toContain('ron');
  });

  it('va chequeo a chequeo: el resultado se queda arriba y el siguiente sale debajo, sin "Continuar"', () => {
    let r = lanzarEventos(estadoEn('otro'), ['borracho'], dados());

    // 1.º de Fuerza, fallado: −1 de vida, y en la misma pantalla el 2.º chequeo.
    r = chequeo(r, 6);
    expect(vista(r)).toMatchObject({ modo: 'chequeo', chequeo: { caracteristica: 'fuerza' } });
    expect(vista(r).anteriores.map(l => l.texto)).toEqual(['Pierdes 1 punto de vida por tropiezos y caídas.']);
    expect(vista(r).anteriores[0].chequeo!.superado).toBe(false);
    expect(vista(r).texto).toContain('Otro traspié');
    expect(r.estado.jugador.vida).toBe(9);

    // 2.º de Fuerza, superado: lo anterior se borra y sale este resultado con el de Ingenio debajo.
    r = chequeo(r, 1);
    expect(vista(r)).toMatchObject({ modo: 'chequeo', chequeo: { caracteristica: 'ingenio' } });
    expect(vista(r).anteriores.map(l => l.texto)).toEqual(['Consigues mantener el equilibrio y no te partes la crisma.']);
    expect(r.estado.jugador.vida).toBe(9);

    // El de Ingenio, y debajo la tirada de la pelea con su botón.
    r = chequeo(r, 1);
    expect(vista(r)).toMatchObject({ modo: 'tirada', tirada: { dado: '1d6', boton: '¿Aquel mentecato te está mirando mal?' } });
    expect(vista(r).anteriores[0].texto).toContain('tu bolsa sigue en su sitio');
  });

  it('morir de una caída: la ventana se queda, con lo que ha pasado y su mensaje de muerte', () => {
    const r = chequeo(lanzarEventos(estadoEn('otro', 50, 1), ['borracho'], dados()), 6);

    expect(r.estado.mundo.finPartida).toEqual({
      resultado: 'derrota',
      motivo: 'vida',
      causa: { tipo: 'evento', evento: 'borracho', texto: expect.stringContaining('te abres la cabeza contra un barril') },
    });
    expect(vista(r)).toMatchObject({ modo: 'muerte', texto: 'Pierdes 1 punto de vida por tropiezos y caídas.' });
    expect(vista(r).lectura!.chequeo!.superado).toBe(false);
  });

  it('fallar los dos de Fuerza quita 2 de vida', () => {
    let r = lanzarEventos(estadoEn('otro'), ['borracho'], dados());
    r = chequeo(r, 6);
    r = chequeo(r, 6);
    expect(r.estado.jugador.vida).toBe(8);
  });

  it('fallar el de Ingenio quita 10 de oro (o todo, si llevas menos)', () => {
    const conOro = (oro: number) => {
      let r = lanzarEventos(estadoEn('otro', oro), ['borracho'], dados());
      r = chequeo(r, 1);
      r = chequeo(r, 1);
      return chequeo(r, 6).estado.jugador.oro;
    };
    expect(conOro(50)).toBe(40);
    expect(conOro(4)).toBe(0);
  });

  it('del 3 al 6 no hay pelea: la noche termina sin más', () => {
    const r = tirarDadosDelEvento(hastaElJaleo('puerto').estado, dadosTrucados([3]));
    expect(vista(r).lectura!.texto).toContain('sin más incidentes');
    expect(continuar(r).terminado).toBe(true);
  });

  it('con 1-2 te metes en una pelea con piratas hostiles (el encuentro) y no es mortal', () => {
    for (const dado of [1, 2]) {
      const r = tirarDadosDelEvento(hastaElJaleo('otro').estado, dadosTrucados([dado]));
      expect(vista(r).tirada).toMatchObject({ paraEncuentro: true, boton: '¿Con quién te has metido?' });
      expect(vista(r).anteriores[0].texto).toContain('Te metes en una pelea');
      const conEnemigos = tirarDadosDelEvento(r.estado, dadosTrucados([6]));
      expect(empezarCombateDelEvento(conEnemigos.estado, dados()).estado.mundo.combate!.noMortal).toBe(true);
    }
  });

  describe('después de la pelea, según dónde estés', () => {
    it('a bordo y ganando: −1 de tripulación', () => {
      const r = pelea('barco', 'victoria');
      expect(vista(r).anteriores[0].texto).toBe('Ganas la pelea.');
      expect(vista(r).lectura!.texto).toContain('uno de tus tripulantes');
      expect(r.estado.jugador.tripulacion).toBe(19);
      expect(continuar(r).terminado).toBe(true);
    });

    it('a bordo y perdiendo: no pierdes tripulación', () => {
      const r = continuar(pelea('barco', 'derrota'));
      expect(r.terminado).toBe(true);
      expect(r.estado.mundo.finPartida).toBeNull();
      expect(r.estado.jugador.tripulacion).toBe(20);
      expect(r.estado.jugador.vida).toBe(1);
    });

    it('en un puerto (ganes o pierdas) se tira por los guardias: con un 1 te arrestan', () => {
      for (const resultado of ['victoria', 'derrota'] as const) {
        const r = pelea('puerto', resultado);
        expect(vista(r)).toMatchObject({ modo: 'tirada', texto: expect.stringContaining('guardias'), tirada: { boton: '¿Te ha visto la guardia?' } });

        const arrestado = tirarDadosDelEvento(r.estado, dadosTrucados([1]));
        expect(vista(arrestado).lectura!.texto).toContain('Te arrestan');
        expect(continuar(arrestado)).toMatchObject({ terminado: true, pendientes: ['arrestado'] });
      }
    });

    it('en un puerto, del 2 al 6 te escabulles', () => {
      const r = tirarDadosDelEvento(pelea('puerto', 'victoria').estado, dadosTrucados([2]));
      expect(vista(r).lectura!.texto).toContain('Te escabulles');
      expect(continuar(r)).toMatchObject({ terminado: true, pendientes: [] });
    });

    it('en otro sitio, solo la pelea', () => {
      const r = continuar(pelea('otro', 'victoria'));
      expect(r.terminado).toBe(true);
      expect(r.estado.jugador.tripulacion).toBe(20);
    });
  });
});
