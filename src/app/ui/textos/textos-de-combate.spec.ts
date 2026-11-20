import { describirSuceso, lineasDeResumenNaval } from './textos-de-combate';

const NOMBRES = { jugador: 'Tú', forzudo_1: 'Rufus', enemigo_1: 'Jaguar' };

describe('textos del combate', () => {
  it('un ataque que acierta, con todo lo que suma y resta', () => {
    const texto = describirSuceso(
      {
        tipo: 'ataque',
        atacante: 'jugador',
        objetivo: 'enemigo_1',
        tirada: { dados: [6, 3], acierta: true, danoSinCastigo: 9, bonificador: 2, castigoHambre: 1, dano: 9 },
        pielDePiedra: 1,
        dano: 9,
      },
      NOMBRES,
    );
    expect(texto).toBe('Tú ataca a Jaguar: dados 6 + 3 + 2 bonificador − 1 por hambre − 1 piel de piedra → 9 de daño');
  });

  it('un ataque que falla', () => {
    const texto = describirSuceso(
      {
        tipo: 'ataque',
        atacante: 'enemigo_1',
        objetivo: 'forzudo_1',
        tirada: { dados: [2], acierta: false, danoSinCastigo: 0, bonificador: 0, castigoHambre: 0, dano: 0 },
        pielDePiedra: 0,
        dano: 0,
      },
      NOMBRES,
    );
    expect(texto).toBe('Jaguar ataca a Rufus: dados 2 → falla');
  });

  it('muertes, huidas y el chamán', () => {
    expect(describirSuceso({ tipo: 'muerte', luchador: 'enemigo_1', nombre: 'Jaguar' }, NOMBRES)).toContain('Jaguar cae');
    expect(describirSuceso({ tipo: 'huida', dado: 5, exito: true }, NOMBRES)).toContain('lo consigues');
    expect(describirSuceso({ tipo: 'maldicion_pendiente', luchador: 'enemigo_1' }, NOMBRES)).toContain('¡MALDITO!');
    expect(describirSuceso({ tipo: 'emboscada', quien: 'suya' }, NOMBRES)).toContain('EMBOSCADA');
  });

  it('el resumen del combate naval', () => {
    const lineas = lineasDeResumenNaval({
      barco: 'fragata_de_la_marina',
      nombre: 'Fragata de la marina',
      resultado: 'victoria',
      forma: 'abordado',
      tripulacionPerdida: 8,
      vidaPerdida: 5,
      seguidoresCaidos: [{ id: 'forzudo_1', nombre: 'Rufus' }],
      oroGanado: 70,
      famaGanada: 1,
      comidaGanada: 0,
      eventos: ['cofre'],
    });
    expect(lineas.join('\n')).toContain('VICTORIA, abordándolo');
    expect(lineas.join('\n')).toContain('Rufus cayó en el abordaje');
    expect(lineas.join('\n')).toContain('Evento pendiente: cofre');
  });
});
