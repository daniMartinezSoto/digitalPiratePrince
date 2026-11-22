import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import { cerrarCombateDelEvento, continuarEvento, empezarCombateDelEvento, lanzarEventos, tirarDadosDelEvento, vistaDelEvento } from './motor';

// Piratas hostiles (E003) con el encuentro de verdad (Sprint 10, paso 7): el primer evento con un
// combate. "Tirar dados" → sale contra quién → "Luchar" → combate → oro por cada pirata derrotado.

function estadoInicial(): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', oro: 50, inventario: [], seguidores: [], condiciones: [] },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

const lanzado = () => lanzarEventos(estadoInicial(), ['piratas_hostiles'], new Dados(1)).estado;

/** Termina el combate en curso como si se hubiera ganado, con todos los enemigos caídos. */
function ganarElCombate(estado: Estado): Estado {
  const combate = estado.mundo.combate!;
  return {
    ...estado,
    mundo: { ...estado.mundo, combate: { ...combate, resultado: 'victoria', enemigos: combate.enemigos.map(e => ({ ...e, resistencia: 0 })) } },
  };
}

describe('piratas hostiles (E003) con su encuentro', () => {
  it('primero hay que tirar para ver contra quién se lucha', () => {
    const vista = vistaDelEvento(lanzado())!;
    expect(vista.modo).toBe('tirada');
    expect(vista.tirada).toMatchObject({ dado: '1d6', paraEncuentro: true });
    expect(vista.texto).toContain('piratas hostiles');
  });

  it('con un 6, el pirata anciano y loco de la cuchara; se ve el dado y su texto, y toca "Luchar"', () => {
    const r = tirarDadosDelEvento(lanzado(), dadosTrucados([6]));
    const vista = vistaDelEvento(r.estado)!;

    expect(vista.modo).toBe('combate');
    expect(vista.texto).toContain('cuchara');
    expect(vista.combate!.enemigos).toEqual([{ enemigo: 'pirata_anciano_loco' }]);
    expect(vista.lectura!.tirada).toEqual({ dados: [6], modificador: 0, total: 6 });
  });

  it('con un 1, dos piratas con cuchillos', () => {
    const r = tirarDadosDelEvento(lanzado(), dadosTrucados([1]));
    expect(vistaDelEvento(r.estado)!.combate!.enemigos).toEqual([{ enemigo: 'pirata', cantidad: 2 }]);
  });

  it('cada vez puede salir un combate distinto (de verdad es al azar)', () => {
    const salidos = new Set<string>();
    for (let semilla = 1; semilla <= 40; semilla++) {
      const r = tirarDadosDelEvento(lanzado(), new Dados(semilla));
      salidos.add(vistaDelEvento(r.estado)!.combate!.enemigos[0].enemigo);
    }
    expect([...salidos].sort()).toEqual(['pirata', 'pirata_anciano_loco', 'pirata_desarmado', 'pirata_fornido']);
  });

  it('no se puede luchar sin haber tirado', () => {
    expect(() => empezarCombateDelEvento(lanzado(), new Dados(1))).toThrow(/primero hay que tirar/);
  });

  it('"Luchar" empieza el combate contra los que salieron, cada uno con su recompensa de oro', () => {
    const tirado = tirarDadosDelEvento(lanzado(), dadosTrucados([1])).estado;
    const r = empezarCombateDelEvento(tirado, new Dados(1));
    const enemigos = r.estado.mundo.combate!.enemigos;

    expect(enemigos.map(e => e.tipo)).toEqual(['pirata', 'pirata']);
    expect(enemigos.every(e => JSON.stringify(e.recompensa) === JSON.stringify([{ tipo: 'oro', cantidad: '1d6x2' }]))).toBe(true);
    expect(vistaDelEvento(r.estado)!.modo).toBe('en_combate');
  });

  it('al ganar: se cobra el oro de cada pirata, se lee cómo acabó y el evento termina', () => {
    const tirado = tirarDadosDelEvento(lanzado(), dadosTrucados([1])).estado;
    const enCombate = empezarCombateDelEvento(tirado, new Dados(1)).estado;
    // Los dos piratas dan 1d6×2 cada uno: entre 2 y 12 por pirata, de 4 a 24 en total.
    const r = cerrarCombateDelEvento(ganarElCombate(enCombate), new Dados(9));
    const ganado = r.estado.jugador.oro - 50;

    expect(ganado).toBeGreaterThanOrEqual(4);
    expect(ganado).toBeLessThanOrEqual(24);
    expect(ganado % 2).toBe(0);
    expect(vistaDelEvento(r.estado)).toMatchObject({ modo: 'continuar' });
    expect(vistaDelEvento(r.estado)!.lectura!.combate).toBe('victoria');

    expect(continuarEvento(r.estado, new Dados(1)).terminado).toBe(true);
  });
});
