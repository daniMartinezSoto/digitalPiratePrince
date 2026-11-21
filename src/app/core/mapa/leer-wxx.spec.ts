import { ErrorDeWxx, leerWxx } from './leer-wxx';

// Un .wxx de juguete (6 columnas × 4 filas), escrito como lo guarda Worldographer:
// cada <tilerow> es una COLUMNA y los símbolos van en píxeles.
const TERRAINMAP = 'Water Sea Deep\t0\tFlat Beach\t1\tFlat Farmland\t2\tFlat Forest Jungle\t3\tWater Sea\t4';

// Por columnas: las 0-1 y 4-5 son tierra; la 2 costa y la 3 alta mar.
const COLUMNAS_POR_DEFECTO = [
  [1, 1, 2, 3],
  [3, 2, 1, 1],
  [4, 4, 4, 4],
  [0, 0, 0, 0],
  [1, 2, 3, 1],
  [2, 2, 1, 1],
];

function simbolo(tipo: string, col: number, fila: number, rojo = false): string {
  const x = 150 + 225 * col;
  const y = 150 + 300 * fila + (col % 2 === 1 ? 150 : 0);
  const color = rojo ? ' color="1.0,0.0,0.0,1.0"' : ' color="null"';
  return `<feature type="${tipo}" rotate="0.0" uuid="x"${color}>\n<location viewLevel="WORLD" x="${x}" y="${y}"/>\n</feature>`;
}

const PRINCIPALES = [
  simbolo('Symbol Anchor', 0, 0, true),
  simbolo('Symbol Anchor', 5, 0, true),
  simbolo('Symbol Anchor', 0, 3, true),
  simbolo('Symbol Anchor', 5, 3, true),
];

function wxx(simbolos: string[], columnas = COLUMNAS_POR_DEFECTO, orientacion = 'COLUMNS'): string {
  const filas = columnas[0].length;
  const tilerows = columnas.map(c => '<tilerow>\n' + c.map(t => `${t}\t0\t0\tZ`).join('\n') + '\n</tilerow>').join('\n');
  return [
    `<?xml version='1.0' encoding='utf-16'?>`,
    `<map type="WORLD" version="1.74" hexOrientation="${orientacion}">`,
    `<terrainmap>${TERRAINMAP}</terrainmap>`,
    `<tiles viewLevel="WORLD" tilesWide="${columnas.length}" tilesHigh="${filas}">`,
    tilerows,
    `</tiles>`,
    `<features>`,
    ...simbolos,
    `</features>`,
    `<labels><label>Nación inventada</label></labels>`,
    `</map>`,
  ].join('\n');
}

const BASICO = [simbolo('Symbol Crossbones', 1, 0), ...PRINCIPALES];

function problemasDe(xml: string): string[] {
  try {
    leerWxx(xml, 'prueba', 'Prueba');
  } catch (error) {
    return (error as ErrorDeWxx).problemas;
  }
  return [];
}

describe('leer un .wxx de Worldographer', () => {
  it('cada <tilerow> es una columna: el mapa no sale transpuesto', () => {
    const { mapa } = leerWxx(wxx(BASICO), 'prueba', 'Prueba');

    expect(mapa.columnas).toBe(6);
    expect(mapa.filas).toBe(4);
    expect(mapa.casillas).toHaveLength(24);
    // La columna 0 es playa, playa, jungla, jungla profunda (de arriba abajo)
    expect([0, 1, 2, 3].map(fila => mapa.casillas[fila * 6].terreno)).toEqual(['playa', 'playa', 'jungla', 'jungla_profunda']);
    expect(mapa.casillas[2].terreno).toBe('costa');
    expect(mapa.casillas[3].terreno).toBe('alta_mar'); // "Water Sea Deep" contiene "sea", pero es alta mar
  });

  it('las casillas van fila a fila y saben dónde están', () => {
    const { mapa } = leerWxx(wxx(BASICO), 'prueba', 'Prueba');

    expect(mapa.casillas[7]).toMatchObject({ col: 1, fila: 1 });
  });

  it('la calavera con huesos es la casilla de inicio (y no es un lugar)', () => {
    const { mapa } = leerWxx(wxx(BASICO), 'prueba', 'Prueba');

    expect(mapa.inicio).toEqual({ col: 1, fila: 0 });
    expect(mapa.casillas[1].rasgo).toBeUndefined();
  });

  it('los cuatro puertos principales se nombran según su esquina', () => {
    const { mapa } = leerWxx(wxx(BASICO), 'prueba', 'Prueba');

    expect(mapa.puertosPrincipales).toEqual([
      { id: 'la_habana', nombre: 'La Habana', col: 0, fila: 0 },
      { id: 'nassau', nombre: 'Nassau', col: 5, fila: 0 },
      { id: 'tortuga', nombre: 'Tortuga', col: 0, fila: 3 },
      { id: 'port_royal', nombre: 'Port Royal', col: 5, fila: 3 },
    ]);
    expect(mapa.casillas[5 + 3 * 6]).toMatchObject({ rasgo: 'puerto', nombre: 'Port Royal' });
  });

  it('un ancla roja encima de una negra es un solo puerto principal', () => {
    const { mapa } = leerWxx(wxx([...BASICO, simbolo('Symbol Anchor', 0, 0)]), 'prueba', 'Prueba');

    expect(mapa.casillas.filter(c => c.rasgo === 'puerto')).toHaveLength(4);
    expect(mapa.casillas[0].nombre).toBe('La Habana');
  });

  it('los puertos normales llevan nombre de la lista, en el orden del archivo; los demás lugares no llevan nombre', () => {
    const { mapa } = leerWxx(
      wxx([...BASICO, simbolo('Symbol Anchor', 4, 1), simbolo('Symbol Anchor', 1, 2), simbolo('Building Church', 1, 1)]),
      'prueba',
      'Prueba',
    );

    expect(mapa.casillas[4 + 6].nombre).toBe('Cala Ventura');
    expect(mapa.casillas[1 + 12].nombre).toBe('Puerto Viejo');
    expect(mapa.casillas[1 + 6]).toEqual({ col: 1, fila: 1, terreno: 'jungla', rasgo: 'monasterio', variante: 0 });
  });

  it('traduce los símbolos con las convenciones del autor', () => {
    const { mapa } = leerWxx(
      wxx([
        ...BASICO,
        simbolo('Symbol Battle Primitive', 1, 1),
        simbolo('Symbol Construction', 1, 2),
        simbolo('Symbol Cave', 1, 3),
        simbolo('Symbol Shipwreck', 4, 1),
      ]),
      'prueba',
      'Prueba',
    );

    expect([7, 13, 19, 10].map(i => mapa.casillas[i].rasgo)).toEqual(['aldea', 'ruinas', 'guarida_pirata', 'naufragio']);
  });

  it('la variante cuenta por tipo en el orden del archivo, y los puertos cuentan todos juntos', () => {
    const { mapa } = leerWxx(
      wxx([simbolo('Symbol Crossbones', 1, 0), simbolo('Symbol Anchor', 4, 1), ...PRINCIPALES, simbolo('Symbol Battle Primitive', 1, 1)]),
      'prueba',
      'Prueba',
    );

    expect(mapa.casillas[4 + 6].variante).toBe(0);
    expect(mapa.casillas[0].variante).toBe(1);
    expect(mapa.casillas[7].variante).toBe(0); // la primera aldea
  });

  it('los barcos de Worldographer marcan zonas de eventos de barco (solo en el agua)', () => {
    const { mapa, avisos } = leerWxx(wxx([...BASICO, simbolo('Military Sailship', 3, 1), simbolo('Military Sailship', 1, 1)]), 'prueba', 'Prueba');

    expect(mapa.casillas[3 + 6].eventosDeBarco).toBe(true);
    expect(mapa.casillas[3 + 6].rasgo).toBeUndefined();
    expect(mapa.casillas[1 + 6].eventosDeBarco).toBeUndefined();
    expect(avisos).toEqual([expect.stringMatching(/barco en tierra \(1,1\)/)]);
  });

  it('ignora las naciones, etiquetas y demás inventos de Worldographer', () => {
    const { mapa } = leerWxx(wxx(BASICO), 'prueba', 'Prueba');

    expect(JSON.stringify(mapa)).not.toContain('Nación');
  });

  describe('lo que no sabe resolver lo dice (no adivina)', () => {
    it('un terreno que no conoce', () => {
      const xml = wxx(BASICO).replace('Flat Farmland', 'Mountains');

      expect(problemasDe(xml)).toContain('Terreno desconocido "Mountains": pregunta al autor qué es en el juego');
    });

    it('un símbolo que no conoce', () => {
      expect(problemasDe(wxx([...BASICO, simbolo('Symbol Dragon', 1, 1)]))).toContain(
        'Símbolo desconocido "Symbol Dragon": pregunta al autor qué es en el juego',
      );
    });

    it('sin casilla de inicio, con dos, o con el inicio en el agua', () => {
      expect(problemasDe(wxx(PRINCIPALES))).toEqual([expect.stringMatching(/No hay casilla de inicio/)]);
      expect(problemasDe(wxx([...BASICO, simbolo('Symbol Crossbones', 1, 1)]))).toEqual([expect.stringMatching(/2 casillas de inicio/)]);
      expect(problemasDe(wxx([simbolo('Symbol Crossbones', 3, 0), ...PRINCIPALES]))).toEqual([expect.stringMatching(/es agua/)]);
    });

    it('si no hay exactamente 4 puertos principales, uno por esquina', () => {
      expect(problemasDe(wxx(BASICO.slice(0, 4)))).toEqual([expect.stringMatching(/Hay 3 puertos principales/)]);
      const dosArriba = [simbolo('Symbol Crossbones', 1, 0), ...PRINCIPALES, simbolo('Symbol Anchor', 4, 0, true)];
      expect(problemasDe(wxx(dosArriba))).toContainEqual('Hay dos puertos principales en la esquina arriba derecha (5,0 y 4,0)');
    });

    it('un símbolo que no cae justo en una casilla (otra escala)', () => {
      const torcido = '<feature type="Building Church" color="null">\n<location viewLevel="WORLD" x="400" y="455"/>\n</feature>';

      expect(problemasDe(wxx([...BASICO, torcido]))).toEqual([expect.stringMatching(/no cae justo en una casilla/)]);
    });

    it('un mapa que no es de columnas', () => {
      expect(problemasDe(wxx(BASICO, COLUMNAS_POR_DEFECTO, 'ROWS'))).toContainEqual(expect.stringMatching(/hexOrientation="ROWS"/));
    });
  });
});
