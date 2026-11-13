import { Dados } from '../../dados/dados';
import { resolverTabla } from './resolver-tabla';
import type { Tabla } from './tabla';

// ---------------------------------------------------------------------------
// Tablas de prueba (inventadas para los tests, no son las del juego)
// ---------------------------------------------------------------------------

// "Tabla espejo": cada resultado tiene su propia fila y su texto es el propio número.
// Así, si sale un 4, el texto debe ser "4": comprobamos que se elige la fila correcta
// sin necesidad de saber qué va a sacar el dado.
function tablaEspejo(dado: string, min: number, max: number): Tabla {
  const filas = [];
  for (let n = min; n <= max; n++) {
    filas.push({ min: n, max: n, texto: String(n) });
  }
  return { id: 'espejo', dado, filas };
}

// Igual que la de pesca del juego, con una fila que salta a un evento.
const pesca: Tabla = {
  id: 'pesca',
  dado: '1d6',
  filas: [
    { min: 1, max: 1, texto: 'No pescas nada' },
    { min: 2, max: 3, efectos: [{ tipo: 'comida', cantidad: 8 }] },
    { min: 4, max: 5, efectos: [{ tipo: 'comida', cantidad: 12 }] },
    {
      min: 6,
      max: 6,
      texto: 'Un banco enorme',
      efectos: [{ tipo: 'comida', cantidad: 15 }],
      evento: 'pesca_abundante',
    },
  ],
};

// Tabla de una sola fila: salga lo que salga, cae en ella. Sirve para probar efectos.
function tablaUnaFila(efectos: Tabla['filas'][number]['efectos']): Tabla {
  return { id: 'una_fila', dado: '1d6', filas: [{ min: 1, max: 6, efectos }] };
}

describe('resolverTabla', () => {
  // -------------------------------------------------------------------------
  // 1. La tirada: dados, modificador y total
  // -------------------------------------------------------------------------
  describe('tirada', () => {
    it('devuelve los dados sacados, el modificador y el total (dados + modificador)', () => {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const r = resolverTabla(tablaEspejo('3d6', 3, 18), 0, new Dados(semilla));

        expect(r.dados).toHaveLength(3);
        expect(r.modificador).toBe(0);
        expect(r.total).toBe(r.dados[0] + r.dados[1] + r.dados[2]);
      }
    });

    it('suma el modificador al total', () => {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const r = resolverTabla(tablaEspejo('1d6', 3, 8), 2, new Dados(semilla));

        expect(r.modificador).toBe(2);
        expect(r.total).toBe(r.dados[0] + 2);
      }
    });

    it('tira exactamente el dado de la tabla (mismos dados que una tirada normal con la misma semilla)', () => {
      const dados = new Dados(777);
      const gemelo = new Dados(777); // misma semilla = misma secuencia

      const r = resolverTabla(tablaEspejo('3d6', 3, 18), 0, dados);

      expect(r.dados).toEqual(gemelo.tirar('3d6').dados);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Elegir la fila
  // -------------------------------------------------------------------------
  describe('elegir fila', () => {
    it('elige la fila cuyo rango contiene el total', () => {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const r = resolverTabla(tablaEspejo('3d6', 3, 18), 0, new Dados(semilla));
        expect(r.texto).toBe(String(r.total));
      }
    });

    it('busca la fila con el total YA modificado, no con el dado a secas', () => {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const r = resolverTabla(tablaEspejo('1d6', 3, 8), 2, new Dados(semilla));
        expect(r.texto).toBe(String(r.dados[0] + 2));
      }
    });

    it('funciona con filas que cubren varios valores (2-3, 4-5...)', () => {
      for (let semilla = 1; semilla <= 50; semilla++) {
        const r = resolverTabla(pesca, 0, new Dados(semilla));
        const t = r.total;

        if (t === 1) expect(r.efectos).toEqual([]);
        if (t === 2 || t === 3) expect(r.efectos).toEqual([{ tipo: 'comida', cantidad: 8 }]);
        if (t === 4 || t === 5) expect(r.efectos).toEqual([{ tipo: 'comida', cantidad: 12 }]);
        if (t === 6) expect(r.efectos).toEqual([{ tipo: 'comida', cantidad: 15 }]);
      }
    });

    it('si el total se pasa por arriba, usa la última fila (y el total no se recorta)', () => {
      const r = resolverTabla(pesca, 100, new Dados(1));

      expect(r.texto).toBe('Un banco enorme');
      expect(r.total).toBe(r.dados[0] + 100); // se muestra el total real
    });

    it('si el total se queda corto por abajo, usa la primera fila', () => {
      const r = resolverTabla(pesca, -100, new Dados(1));

      expect(r.texto).toBe('No pescas nada');
      expect(r.total).toBe(r.dados[0] - 100);
    });

    it('lanza un error si el total cae en un hueco dentro de la tabla', () => {
      // Falta el 3 y el 4: es un error de la tabla, no algo que deba pasar en silencio.
      const conHueco: Tabla = {
        id: 'con_hueco',
        dado: '1d6',
        filas: [
          { min: 1, max: 2, texto: 'bajo' },
          { min: 5, max: 6, texto: 'alto' },
        ],
      };
      // No sabemos qué sacará el dado, así que buscamos una semilla cuyo
      // primer 1d6 sea un 3 o un 4 y usamos esa.
      let probado = false;
      for (let semilla = 1; semilla <= 100 && !probado; semilla++) {
        const dado = new Dados(semilla).tirar('1d6').total;
        if (dado === 3 || dado === 4) {
          expect(() => resolverTabla(conHueco, 0, new Dados(semilla))).toThrow(/hueco/i);
          probado = true;
        }
      }
      expect(probado).toBe(true);
    });

    it('lanza un error si la tabla no tiene filas', () => {
      const vacia: Tabla = { id: 'vacia', dado: '1d6', filas: [] };
      expect(() => resolverTabla(vacia, 0, new Dados(1))).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Lo que se copia de la fila: texto, evento, efectos
  // -------------------------------------------------------------------------
  describe('contenido de la fila', () => {
    it('una fila sin efectos devuelve una lista vacía, nunca undefined', () => {
      const r = resolverTabla(pesca, -100, new Dados(1)); // fila "No pescas nada"

      expect(r.efectos).toEqual([]);
      expect(r.evento).toBeUndefined();
    });

    it('una fila sin texto no devuelve texto', () => {
      const r = resolverTabla(tablaUnaFila([{ tipo: 'oro', cantidad: 5 }]), 0, new Dados(1));
      expect(r.texto).toBeUndefined();
    });

    it('una fila puede tener texto, efectos y evento a la vez', () => {
      const r = resolverTabla(pesca, 100, new Dados(1)); // última fila

      expect(r.texto).toBe('Un banco enorme');
      expect(r.efectos).toEqual([{ tipo: 'comida', cantidad: 15 }]);
      expect(r.evento).toBe('pesca_abundante');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Resolver las cantidades de los efectos
  // -------------------------------------------------------------------------
  describe('cantidades de los efectos', () => {
    it('las cantidades fijas pasan tal cual, también las negativas', () => {
      const tabla = tablaUnaFila([
        { tipo: 'comida', cantidad: 10 },
        { tipo: 'vida', cantidad: -1 },
      ]);

      const r = resolverTabla(tabla, 0, new Dados(1));

      expect(r.efectos).toEqual([
        { tipo: 'comida', cantidad: 10 },
        { tipo: 'vida', cantidad: -1 },
      ]);
    });

    it('una cantidad con dados ("2d6") sale ya convertida en un número', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: '2d6' }]);

      for (let semilla = 1; semilla <= 50; semilla++) {
        const [efecto] = resolverTabla(tabla, 0, new Dados(semilla)).efectos;
        const cantidad = (efecto as { cantidad: number }).cantidad;

        expect(typeof cantidad).toBe('number');
        expect(cantidad).toBeGreaterThanOrEqual(2);
        expect(cantidad).toBeLessThanOrEqual(12);
      }
    });

    it('acepta el multiplicador ("1d6x10")', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: '1d6x10' }]);

      for (let semilla = 1; semilla <= 50; semilla++) {
        const [efecto] = resolverTabla(tabla, 0, new Dados(semilla)).efectos;
        const cantidad = (efecto as { cantidad: number }).cantidad;

        expect(cantidad % 10).toBe(0);
        expect(cantidad).toBeGreaterThanOrEqual(10);
        expect(cantidad).toBeLessThanOrEqual(60);
      }
    });

    it('acepta cantidades con dados negativas ("-1d6" = perder entre 1 y 6)', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: '-1d6' }]);

      for (let semilla = 1; semilla <= 50; semilla++) {
        const [efecto] = resolverTabla(tabla, 0, new Dados(semilla)).efectos;
        const cantidad = (efecto as { cantidad: number }).cantidad;

        expect(cantidad).toBeGreaterThanOrEqual(-6);
        expect(cantidad).toBeLessThanOrEqual(-1);
      }
    });

    it('lanza un error si la cantidad es un texto que no es una expresión de dados', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: 'mucho' }]);
      expect(() => resolverTabla(tabla, 0, new Dados(1))).toThrow();
    });

    it('perder_mitad_oro se devuelve tal cual (lo resolverá aplicarEfectos)', () => {
      const tabla = tablaUnaFila([{ tipo: 'perder_mitad_oro' }]);

      const r = resolverTabla(tabla, 0, new Dados(1));

      expect(r.efectos).toEqual([{ tipo: 'perder_mitad_oro' }]);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Reproducibilidad y no modificar nada
  // -------------------------------------------------------------------------
  describe('reproducibilidad', () => {
    it('con la misma semilla da siempre el mismo resultado', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: '2d6' }]);

      expect(resolverTabla(tabla, 1, new Dados(42))).toEqual(resolverTabla(tabla, 1, new Dados(42)));
    });

    it('consume el generador en orden fijo: primero el dado de la tabla, luego cada efecto con dados', () => {
      const tabla: Tabla = {
        id: 'orden',
        dado: '1d6',
        filas: [
          {
            min: 1,
            max: 6,
            efectos: [
              { tipo: 'oro', cantidad: '2d6' },
              { tipo: 'comida', cantidad: 3 }, // fija: no gasta números
              { tipo: 'tripulacion', cantidad: '1d6' },
            ],
          },
        ],
      };
      const dados = new Dados(2024);
      const gemelo = new Dados(2024);

      const r = resolverTabla(tabla, 0, dados);

      const dadoTabla = gemelo.tirar('1d6');
      const oro = gemelo.tirar('2d6').total;
      const tripulacion = gemelo.tirar('1d6').total;

      expect(r.dados).toEqual(dadoTabla.dados);
      expect(r.efectos).toEqual([
        { tipo: 'oro', cantidad: oro },
        { tipo: 'comida', cantidad: 3 },
        { tipo: 'tripulacion', cantidad: tripulacion },
      ]);
      // Y no ha gastado ni un número más que el gemelo.
      expect(dados.obtenerEstado()).toBe(gemelo.obtenerEstado());
    });

    it('no modifica la tabla que recibe', () => {
      const tabla = tablaUnaFila([{ tipo: 'oro', cantidad: '2d6' }]);
      const copia = structuredClone(tabla);

      resolverTabla(tabla, 3, new Dados(1));

      expect(tabla).toEqual(copia);
    });
  });
});
