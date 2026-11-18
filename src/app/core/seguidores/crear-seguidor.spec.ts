import type { TipoSeguidor } from '../catalogos/tipo-seguidor';
import { Dados } from '../dados/dados';
import type { Seguidor } from '../estado/seguidor';
import { crearSeguidor, type FuentesSeguidor } from './crear-seguidor';
import { LISTAS_DE_NOMBRES, LISTAS_NORMALES, nombresDe } from './nombres';

// Catálogo de prueba: pocas fichas y pocos nombres, para saber qué esperar.
const TIPOS: TipoSeguidor[] = [
  { id: 'grumete', nombre: 'Grumete', descripcion: 'x', ataque: 2, resistencia: 10, habilidades: [] },
  { id: 'mono', nombre: 'Mono', descripcion: 'x', ataque: 0, resistencia: 3, habilidades: ['manos_largas'], precio: 40 },
  { id: 'chaman', nombre: 'Chamán', descripcion: 'x', ataque: 2, resistencia: 10, habilidades: [], nombres: ['nativos'] },
];
const NOMBRES = ['Ana', 'Blas', 'Cleo'];
const FUENTES: FuentesSeguidor = { tipos: TIPOS, nombres: { hombres: ['Ana', 'Blas'], mujeres: ['Cleo'], nativos: ['Yara'] } };

function yaEnElGrupo(id: string, nombre: string): Seguidor {
  return { id, tipo: 'grumete', nombre, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
}

describe('crearSeguidor', () => {
  it('sin números en la ficha, nace con ataque 2 y resistencia 10 de 10', () => {
    const grumete = crearSeguidor('grumete', [], new Dados(1), {}, FUENTES);

    expect(grumete.tipo).toBe('grumete');
    expect(grumete.ataque).toBe(2);
    expect(grumete.resistencia).toBe(10);
    expect(grumete.resistenciaMaxima).toBe(10);
    expect(grumete.habilidades).toEqual([]);
  });

  it('copia de la ficha el ataque, la resistencia y las habilidades (el mono no ataca)', () => {
    const mono = crearSeguidor('mono', [], new Dados(1), {}, FUENTES);

    expect(mono.ataque).toBe(0);
    expect(mono.resistencia).toBe(3);
    expect(mono.resistenciaMaxima).toBe(3);
    expect(mono.habilidades).toEqual(['manos_largas']);
  });

  it('las habilidades son una copia: cambiar las del seguidor no toca la ficha', () => {
    const mono = crearSeguidor('mono', [], new Dados(1), {}, FUENTES);
    mono.habilidades.push('otra');

    expect(TIPOS[1].habilidades).toEqual(['manos_largas']);
  });

  it('le pone un nombre de la lista', () => {
    const grumete = crearSeguidor('grumete', [], new Dados(1), {}, FUENTES);

    expect(NOMBRES).toContain(grumete.nombre);
  });

  it('si la ficha pide otra lista de nombres, el nombre sale de esa lista', () => {
    const chaman = crearSeguidor('chaman', [], new Dados(1), {}, FUENTES);

    expect(chaman.nombre).toBe('Yara');
  });

  it('avisa si la ficha pide una lista de nombres que no existe', () => {
    const fuentes: FuentesSeguidor = { tipos: TIPOS, nombres: { hombres: ['Ana'], mujeres: [] } };

    expect(() => crearSeguidor('chaman', [], new Dados(1), {}, fuentes)).toThrow(/No existe la lista de nombres "nativos"/);
  });

  it('con el catálogo del juego: el nativo recibe un nombre de nativo y la bruja vudú, uno de mujer', () => {
    for (let semilla = 1; semilla <= 30; semilla++) {
      expect(LISTAS_DE_NOMBRES['nativos']).toContain(crearSeguidor('nativo', [], new Dados(semilla)).nombre);
      expect(LISTAS_DE_NOMBRES['mujeres']).toContain(crearSeguidor('bruja_vudu', [], new Dados(semilla)).nombre);
    }
  });

  // Estos dos usan el catálogo y la lista de nombres del juego (por eso piden un forzudo, que sí existe).
  it('con la misma semilla sale el mismo nombre', () => {
    const uno = crearSeguidor('forzudo', [], new Dados(42));
    const otro = crearSeguidor('forzudo', [], new Dados(42));

    expect(uno.nombre).toBe(otro.nombre);
  });

  it('con semillas distintas acaban saliendo nombres distintos', () => {
    const nombres = new Set<string>();
    for (let semilla = 1; semilla <= 20; semilla++) {
      nombres.add(crearSeguidor('forzudo', [], new Dados(semilla)).nombre);
    }

    expect(nombres.size).toBeGreaterThan(1);
  });

  it('no repite un nombre que ya lleva alguien del grupo: coge el siguiente de la lista', () => {
    // Con esta semilla, y sin nadie en el grupo, sale un nombre concreto...
    const primero = crearSeguidor('grumete', [], new Dados(7), {}, FUENTES);
    // ...así que, si ya lo lleva alguien, tiene que salir otro.
    const grupo = [yaEnElGrupo('grumete_1', primero.nombre)];
    const segundo = crearSeguidor('grumete', grupo, new Dados(7), {}, FUENTES);

    const posicion = NOMBRES.indexOf(primero.nombre);
    expect(segundo.nombre).toBe(NOMBRES[(posicion + 1) % NOMBRES.length]);
  });

  it('si todos los nombres están cogidos, repite uno en vez de fallar', () => {
    const grupo = [yaEnElGrupo('a', 'Ana'), yaEnElGrupo('b', 'Blas'), yaEnElGrupo('c', 'Cleo')];

    const nuevo = crearSeguidor('grumete', grupo, new Dados(1), {}, FUENTES);

    expect(NOMBRES).toContain(nuevo.nombre);
  });

  it('gasta exactamente un número del generador', () => {
    const dados = new Dados(5);
    const testigo = new Dados(5);

    crearSeguidor('grumete', [], dados, {}, FUENTES);
    testigo.entero(0, 1); // un número cualquiera

    expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
  });

  it('gasta un solo número aunque tenga que saltar nombres repetidos', () => {
    const dados = new Dados(7);
    const testigo = new Dados(7);
    const primero = crearSeguidor('grumete', [], new Dados(7), {}, FUENTES);

    crearSeguidor('grumete', [yaEnElGrupo('grumete_1', primero.nombre)], dados, {}, FUENTES);
    testigo.entero(0, 1);

    expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
  });

  it('el id es el tipo y un número: el primero es "grumete_1"', () => {
    expect(crearSeguidor('grumete', [], new Dados(1), {}, FUENTES).id).toBe('grumete_1');
  });

  it('si ya hay un "grumete_1" en el grupo, el siguiente es "grumete_2"', () => {
    const grupo = [yaEnElGrupo('grumete_1', 'Ana')];

    expect(crearSeguidor('grumete', grupo, new Dados(1), {}, FUENTES).id).toBe('grumete_2');
  });

  it('aprovecha el número que quedó libre (si se fue el 1 y queda el 2, vuelve a ser el 1)', () => {
    const grupo = [yaEnElGrupo('grumete_2', 'Ana')];

    expect(crearSeguidor('grumete', grupo, new Dados(1), {}, FUENTES).id).toBe('grumete_1');
  });

  it('un seguidor normal no lleva el campo "inseparable"', () => {
    const grumete = crearSeguidor('grumete', [], new Dados(1), {}, FUENTES);

    expect('inseparable' in grumete).toBe(false);
  });

  it('se puede crear inseparable (el seguidor del hermano)', () => {
    const grumete = crearSeguidor('grumete', [], new Dados(1), { inseparable: true }, FUENTES);

    expect(grumete.inseparable).toBe(true);
  });

  it('no toca la lista de seguidores que recibe', () => {
    const grupo = [yaEnElGrupo('grumete_1', 'Ana')];

    crearSeguidor('grumete', grupo, new Dados(1), {}, FUENTES);

    expect(grupo).toHaveLength(1);
  });

  it('avisa si el tipo no existe, diciendo cuáles hay', () => {
    expect(() => crearSeguidor('grumeta', [], new Dados(1), {}, FUENTES)).toThrow(
      /no existe el tipo de seguidor "grumeta".*grumete, mono, chaman/,
    );
  });

  it('avisa si no hay ningún nombre entre los que elegir', () => {
    const fuentes: FuentesSeguidor = { tipos: TIPOS, nombres: { hombres: [], mujeres: [] } };

    expect(() => crearSeguidor('grumete', [], new Dados(1), {}, fuentes)).toThrow(/no hay ningún nombre/);
  });

  it('con el catálogo del juego: el forzudo pega 3 y el pirata anciano aguanta 6', () => {
    expect(crearSeguidor('forzudo', [], new Dados(1)).ataque).toBe(3);
    expect(crearSeguidor('pirata_anciano', [], new Dados(1)).resistenciaMaxima).toBe(6);
  });
});

describe('listas de nombres de seguidores', () => {
  it('existen las listas normales (hombres y mujeres) y la de nativos', () => {
    expect(Object.keys(LISTAS_DE_NOMBRES)).toEqual(expect.arrayContaining(['hombres', 'mujeres', 'nativos']));
  });

  it('ninguna lista está vacía', () => {
    for (const [id, lista] of Object.entries(LISTAS_DE_NOMBRES)) {
      expect(lista.length, `la lista "${id}" está vacía`).toBeGreaterThan(0);
    }
  });

  it('todos los nombres son textos con contenido', () => {
    const malos = Object.values(LISTAS_DE_NOMBRES).flat().filter(n => typeof n !== 'string' || n.trim() === '');

    expect(malos).toEqual([]);
  });

  it('dentro de una lista no hay ningún nombre repetido', () => {
    for (const [id, lista] of Object.entries(LISTAS_DE_NOMBRES)) {
      const repetidos = lista.filter((n, i) => lista.indexOf(n) !== i);

      expect(repetidos, `nombres repetidos en la lista "${id}"`).toEqual([]);
    }
  });

  it('sin decir nada, nombresDe junta las listas normales: hombres y mujeres', () => {
    const esperados = LISTAS_NORMALES.flatMap(id => LISTAS_DE_NOMBRES[id]);

    expect(nombresDe()).toEqual(esperados);
  });

  it('nombresDe junta las listas que se le piden, en ese orden', () => {
    const listas = { a: ['Ana'], b: ['Blas', 'Cleo'] };

    expect(nombresDe(['b', 'a'], listas)).toEqual(['Blas', 'Cleo', 'Ana']);
  });
});
