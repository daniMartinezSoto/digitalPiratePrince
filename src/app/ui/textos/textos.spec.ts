import { describirCambio, describirTirada, nombreDeEvento, textoDeMotivo, textoDeMuerte } from './textos';

describe('textos de la pantalla', () => {
  it('un recurso que sube o baja, con su "de... a..."', () => {
    expect(describirCambio({ tipo: 'recurso', recurso: 'comida', antes: 2, despues: 7 })).toBe('+5 comida (de 2 a 7)');
    expect(describirCambio({ tipo: 'recurso', recurso: 'vida', antes: 18, despues: 17 })).toBe('-1 vida (de 18 a 17)');
    expect(describirCambio({ tipo: 'recurso', recurso: 'oro', antes: 50, despues: 54, motivo: 'contable' })).toBe('+4 oro (de 50 a 54) (el contable)');
  });

  it('objetos y condiciones con su nombre del catálogo', () => {
    expect(describirCambio({ tipo: 'objeto_ganado', objeto: 'unguento' })).toBe('Ganas: Ungüento curativo');
    expect(describirCambio({ tipo: 'condicion_puesta', condicion: 'tormenta', turnos: 3 })).toContain('Tormenta (3 turnos)');
    expect(describirCambio({ tipo: 'condicion_quitada', condicion: 'hambre' })).toContain('Ya no tienes:');
  });

  it('los seguidores con su nombre propio si se conoce', () => {
    expect(describirCambio({ tipo: 'seguidor_muerto', seguidor: 'forzudo_1' }, { antes: { forzudo_1: 'Rufus' }, despues: {} })).toBe('Rufus ha muerto');
    expect(describirCambio({ tipo: 'seguidor_muerto', seguidor: 'forzudo_1' })).toBe('forzudo_1 ha muerto');
  });

  it('un id reutilizado: quien se va con el nombre de antes, quien llega con el de después', () => {
    const nombres = { antes: { forzudo_1: 'Beatriz' }, despues: { forzudo_1: 'Rufus' } };
    expect(describirCambio({ tipo: 'seguidor_despedido', seguidor: 'forzudo_1' }, nombres)).toBe('Despides a Beatriz');
    expect(describirCambio({ tipo: 'seguidor_se_une', seguidor: 'forzudo_1' }, nombres)).toBe('Rufus se une al grupo');
  });

  it('el motivo de una acción desactivada', () => {
    expect(textoDeMotivo({ accion: 'enterrar_tesoro', disponible: false, motivo: 'tesoro_ya_enterrado' })).toBe('Ya has enterrado un tesoro aquí');
    expect(textoDeMotivo({ accion: 'buscar_seguidor', disponible: false, motivo: 'prohibido', condiciones: ['hedor_nauseabundo'] })).toBe(
      'No puedes: Hedor nauseabundo',
    );
    expect(textoDeMotivo({ accion: 'buscar_informacion', disponible: false, motivo: 'espera', faltanDias: 1 })).toBe('Tienes que esperar (falta 1 día)');
    expect(textoDeMotivo({ accion: 'pescar', disponible: true })).toBe('');
  });

  it('una tirada', () => {
    expect(describirTirada({ dados: [3, 4], modificador: 1, total: 8, texto: 'Buena pesca.' })).toBe('dados 3 + 4 (+1) = 8 · Buena pesca.');
    expect(describirTirada({ dados: [2], modificador: 0, total: 2 })).toBe('dados 2 = 2');
  });

  it('el nombre de un evento pendiente', () => {
    expect(nombreDeEvento('taberna_clandestina')).toBe('taberna clandestina');
  });
});

describe('textoDeMuerte (por qué has muerto, 22-nov)', () => {
  const vida = { resultado: 'derrota', motivo: 'vida' } as const;
  const tripulacion = { resultado: 'derrota', motivo: 'tripulacion' } as const;

  it('sin causa, nada (la pantalla dice solo el motivo)', () => {
    expect(textoDeMuerte(vida)).toBeNull();
  });

  it('un evento con su mensaje escrito lo usa tal cual; sin mensaje, nombra el evento', () => {
    expect(textoDeMuerte({ ...vida, causa: { tipo: 'evento', evento: 'borracho', texto: 'Te abres la cabeza.' } })).toBe('Te abres la cabeza.');
    expect(textoDeMuerte({ ...vida, causa: { tipo: 'evento', evento: 'guardia' } })).toBe('Tu aventura termina durante «Guardia».');
  });

  it('en combate nombra a los enemigos; con el hambre, la condición o una acción, lo dice', () => {
    expect(textoDeMuerte({ ...vida, causa: { tipo: 'combate', enemigos: ['jaguar', 'guardia'] } })).toBe('Caes en combate contra jaguar y guardia. Tu aventura termina aquí.');
    expect(textoDeMuerte({ ...vida, causa: { tipo: 'hambre' } })).toBe('El hambre puede contigo: mueres de inanición.');
    expect(textoDeMuerte({ ...tripulacion, causa: { tipo: 'condicion', condicion: 'escorbuto' } })).toBe('«Escorbuto» acaba con tu tripulación: no queda nadie a bordo.');
    expect(textoDeMuerte({ ...vida, causa: { tipo: 'accion', accion: 'cazar' } })).toBe('Mueres al cazar.');
  });
});
