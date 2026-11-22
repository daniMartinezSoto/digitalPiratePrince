import type { Evento } from './evento';
import { eventosALosQueSalta, eventosQueFaltan, validarEvento, validarEventos } from './validar-evento';

// Tests del revisor de eventos (Sprint 10, paso 1).

// Escribimos los eventos de prueba como objetos sueltos (en el JSON puede venir cualquier cosa).
function evento(pasos: Record<string, unknown>, extra: Record<string, unknown> = {}): Evento {
  return { id: 'prueba', titulo: 'Prueba', pasos, ...extra } as unknown as Evento;
}

function erroresDe(e: Evento): string {
  return validarEvento(e).join('\n');
}

const TIRADA_1D6 = {
  dado: '1d6',
  filas: [
    { min: 1, max: 3, texto: 'Mal' },
    { min: 4, max: 6, texto: 'Bien' },
  ],
};

describe('validarEvento', () => {
  describe('el evento', () => {
    it('vale con lo mínimo: id, título y un paso "inicio" con texto', () => {
      expect(erroresDe(evento({ inicio: { texto: 'Hola' } }))).toBe('');
    });

    it('avisa del id mal escrito, del título que falta y de los campos que sobran', () => {
      const errores = erroresDe({ id: 'Mal Id', pasos: { inicio: { texto: 'x' } }, color: 'rojo' } as unknown as Evento);

      expect(errores).toContain('el id debe ir en minúsculas');
      expect(errores).toContain('le falta el título');
      expect(errores).toContain('el campo "color" no existe');
    });

    it('tiene que tener pasos y uno llamado "inicio"', () => {
      expect(erroresDe(evento({}))).toContain('le faltan los pasos');
      expect(erroresDe(evento({ empezar: { texto: 'x' } }))).toContain('no tiene el paso "inicio"');
    });

    it('revisa "unaVez" y "libro"', () => {
      expect(erroresDe(evento({ inicio: { texto: 'x' } }, { unaVez: true, libro: 'E041' }))).toBe('');
      expect(erroresDe(evento({ inicio: { texto: 'x' } }, { unaVez: 'si' }))).toContain('"unaVez" debe ser true o false');
      expect(erroresDe(evento({ inicio: { texto: 'x' } }, { libro: '41' }))).toContain('"libro" debe ser el código');
    });

    it('avisa de ids repetidos en la lista', () => {
      const a = evento({ inicio: { texto: 'x' } });
      expect(validarEventos([a, a]).join('\n')).toContain('El evento "prueba" está repetido');
    });
  });

  describe('los pasos', () => {
    it('un paso vacío es un error', () => {
      expect(erroresDe(evento({ inicio: {} }))).toContain('paso "inicio": está vacío');
    });

    it('los saltos a pasos tienen que existir', () => {
      expect(erroresDe(evento({ inicio: { texto: 'x', paso: 'final' }, final: { texto: 'y' } }))).toBe('');
      expect(erroresDe(evento({ inicio: { texto: 'x', paso: 'finall' } }))).toContain('el paso "finall" no existe en este evento');
    });

    it('avisa de los pasos a los que no se llega nunca', () => {
      expect(erroresDe(evento({ inicio: { texto: 'x' }, perdido: { texto: 'y' } }))).toContain('paso "perdido": no se llega a él');
    });

    it('se llega a los pasos de dentro de opciones, filas y combates', () => {
      const e = evento({
        inicio: { opciones: [{ texto: 'A', paso: 'tirar' }, { texto: 'B', paso: 'luchar' }] },
        tirar: { tirada: { dado: '1d6', filas: [{ min: 1, max: 6, texto: 'x', paso: 'final' }] } },
        luchar: { combate: { enemigos: [{ enemigo: 'jaguar' }], victoria: { paso: 'final' } } },
        final: { texto: 'Fin' },
      });
      expect(erroresDe(e)).toBe('');
    });

    it('un paso solo puede pedir una cosa (opciones, tirada, chequeo o combate)', () => {
      const errores = erroresDe(evento({ inicio: { opciones: [{ texto: 'A' }], tirada: TIRADA_1D6 } }));
      expect(errores).toContain('un paso solo puede tener una de ellas');
    });

    it('si el paso pide algo, no puede llevar además "paso", "evento" o "llamar"', () => {
      const e = evento({ inicio: { tirada: TIRADA_1D6, paso: 'final' }, final: { texto: 'x' } });
      expect(erroresDe(e)).toContain('ya dice por dónde se sigue, así que sobra "paso"');
    });

    it('evento y llamar: con el formato bien, sin mezclarlos y sin saltar a sí mismo', () => {
      expect(erroresDe(evento({ inicio: { texto: 'x', llamar: 'dano_en_la_bodega', paso: 'nada' }, nada: { texto: 'y' } }))).toBe('');
      expect(erroresDe(evento({ inicio: { texto: 'x', evento: 'Tesoro' } }))).toContain('debe ir en minúsculas');
      expect(erroresDe(evento({ inicio: { evento: 'a', llamar: 'b' } }))).toContain('elige uno');
      expect(erroresDe(evento({ inicio: { evento: 'prueba' } }))).toContain('salta a su propio evento');
    });

    it('"evento" no vuelve, así que no puede llevar "paso"', () => {
      const e = evento({ inicio: { evento: 'tesoro', paso: 'final' }, final: { texto: 'x' } });
      expect(erroresDe(e)).toContain('¿querías "llamar"?');
    });

    it('los efectos se revisan con el revisor de siempre', () => {
      expect(erroresDe(evento({ inicio: { efectos: [{ tipo: 'oro', cantidad: '1d6x10' }] } }))).toBe('');
      expect(erroresDe(evento({ inicio: { efectos: [{ tipo: 'ganar_objeto', objeto: 'mano_de_mona' }] } }))).toContain('"mano_de_mona" no existe');
      expect(erroresDe(evento({ inicio: { efectos: [] } }))).toContain('"efectos" debe ser una lista');
    });
  });

  describe('opciones', () => {
    it('cada opción necesita el texto de su botón', () => {
      expect(erroresDe(evento({ inicio: { opciones: [{ efectos: [{ tipo: 'oro', cantidad: 1 }] }] } }))).toContain('le falta el texto del botón');
      expect(erroresDe(evento({ inicio: { opciones: [] } }))).toContain('al menos una opción');
    });

    it('una opción sin nada más vale: es "no hacer nada" y termina', () => {
      expect(erroresDe(evento({ inicio: { opciones: [{ texto: 'Seguir navegando' }] } }))).toBe('');
    });

    it('requisitos: solo los que existen, con objetos del catálogo', () => {
      const conRequisito = (requiere: unknown) => evento({ inicio: { opciones: [{ texto: 'A', requiere }] } });

      expect(erroresDe(conRequisito({ sinObjeto: 'idolo_antediluviano' }))).toBe('');
      expect(erroresDe(conRequisito({ sinObjeto: 'idolo_de_plastico' }))).toContain('"idolo_de_plastico" de "sinObjeto" no existe');
      expect(erroresDe(conRequisito({ conBarba: true }))).toContain('el requisito "conBarba" no existe');
      expect(erroresDe(conRequisito({}))).toContain('al menos un requisito');
      expect(erroresDe(conRequisito({ puedeGanarSeguidor: true }))).toBe('');
      expect(erroresDe(conRequisito({ puedeGanarSeguidor: false }))).toContain('"puedeGanarSeguidor" solo puede ser true');
    });
  });

  describe('tiradas', () => {
    it('vale una tirada bien hecha', () => {
      expect(erroresDe(evento({ inicio: { tirada: TIRADA_1D6 } }))).toBe('');
    });

    it('como las tablas: sin huecos, sin solapes y cubriendo lo que saca el dado', () => {
      const conFilas = (filas: unknown[], dado = '1d6') => evento({ inicio: { tirada: { dado, filas } } });

      expect(erroresDe(conFilas([{ min: 1, max: 2, texto: 'a' }, { min: 4, max: 6, texto: 'b' }]))).toContain('hay un hueco entre 2 y 4');
      expect(erroresDe(conFilas([{ min: 1, max: 4, texto: 'a' }, { min: 4, max: 6, texto: 'b' }]))).toContain('se pisan');
      expect(erroresDe(conFilas([{ min: 1, max: 6, texto: 'a' }], '2d6'))).toContain('saca como mínimo 2');
      expect(erroresDe(conFilas([{ min: 1, max: 6, texto: 'a' }], '1d6x'))).toContain('el dado "1d6x" no es válido');
    });

    it('una fila vacía es un error', () => {
      const e = evento({ inicio: { tirada: { dado: '1d6', filas: [{ min: 1, max: 6 }] } } });
      expect(erroresDe(e)).toContain('fila 1-6: está vacía');
    });

    it('"volverATirar": solo true y sin saltar a otro sitio', () => {
      const conFila = (fila: Record<string, unknown>) =>
        evento({ inicio: { tirada: { dado: '1d6', filas: [{ min: 1, max: 1, ...fila }, { min: 2, max: 6, texto: 'x' }] } } });

      expect(erroresDe(conFila({ texto: 'Un tentáculo...', volverATirar: true }))).toBe('');
      expect(erroresDe(conFila({ volverATirar: false }))).toContain('"volverATirar" solo puede ser true');
      expect(erroresDe(conFila({ volverATirar: true, evento: 'tesoro' }))).toContain('si se vuelve a tirar, no puede saltar');
    });
  });

  describe('chequeos', () => {
    it('necesita la característica, el éxito y el fallo (que pueden ser {})', () => {
      const bien = evento({ inicio: { chequeo: { caracteristica: 'fuerza', modificador: -1, exito: {}, fallo: { efectos: [{ tipo: 'vida', cantidad: -2 }] } } } });
      expect(erroresDe(bien)).toBe('');

      const mal = erroresDe(evento({ inicio: { chequeo: { caracteristica: 'carisma', exito: {} } } }));
      expect(mal).toContain('"fuerza" o "ingenio"');
      expect(mal).toContain('chequeo, fallo: falta');
    });
  });

  describe('combates', () => {
    it('vale un combate con enemigos del bestiario y sus salidas', () => {
      const e = evento({
        inicio: { combate: { enemigos: [{ enemigo: 'jaguar', ataque: 3 }], sorpresa: 'suya', victoria: { efectos: [{ tipo: 'comida', cantidad: 4 }] }, huida: {} } },
      });
      expect(erroresDe(e)).toBe('');
    });

    it('los enemigos tienen que existir y estar bien escritos', () => {
      const errores = erroresDe(evento({ inicio: { combate: { enemigos: [{ enemigo: 'dragon' }, { enemigo: 'jaguar', cantidad: 0 }] } } }));
      expect(errores).toContain('enemigo 1: el enemigo "dragon" no existe en el bestiario');
      expect(errores).toContain('enemigo 2: la cantidad debe ser');
      expect(erroresDe(evento({ inicio: { combate: { enemigos: [] } } }))).toContain('le faltan los enemigos');
    });

    it('"derrota" solo en combates no mortales; "huida" no si no se puede huir', () => {
      const conCombate = (extra: Record<string, unknown>) => evento({ inicio: { combate: { enemigos: [{ enemigo: 'guardia' }], ...extra } } });

      expect(erroresDe(conCombate({ noMortal: true, derrota: { evento: 'arrestado' } }))).toBe('');
      expect(erroresDe(conCombate({ derrota: { evento: 'arrestado' } }))).toContain('solo vale con "noMortal": true');
      expect(erroresDe(conCombate({ puedeHuir: false, huida: {} }))).toContain('de este combate no se puede huir');
      expect(erroresDe(conCombate({ sorpresa: 'mia' }))).toContain('la sorpresa debe ser');
    });

    it('combate naval: el barco tiene que existir y no hay "derrota"', () => {
      expect(erroresDe(evento({ inicio: { combateNaval: { barco: 'galeon_del_tesoro', victoria: {} } } }))).toBe('');
      expect(erroresDe(evento({ inicio: { combateNaval: { barco: 'balsa' } } }))).toContain('el barco "balsa" no existe');
      expect(erroresDe(evento({ inicio: { combateNaval: { barco: 'galeon_del_tesoro', derrota: {} } } }))).toContain('el campo "derrota" no existe');
    });
  });
});

describe('eventos a los que se salta', () => {
  const islote = evento({
    inicio: { opciones: [{ texto: 'Explorar', paso: 'explorar' }, { texto: 'No' }] },
    explorar: {
      tirada: {
        dado: '1d6',
        filas: [
          { min: 1, max: 2, evento: 'monstruo' },
          { min: 3, max: 4, llamar: 'dano_en_la_bodega', paso: 'nada' },
          { min: 5, max: 6, texto: 'Fruta', efectos: [{ tipo: 'comida', cantidad: 3 }] },
        ],
      },
    },
    nada: { texto: 'No había nada.' },
  });

  it('eventosALosQueSalta los encuentra en cualquier rincón', () => {
    expect(eventosALosQueSalta(islote).sort()).toEqual(['dano_en_la_bodega', 'monstruo']);
  });

  it('eventosQueFaltan da los que aún no están escritos', () => {
    const monstruo = { id: 'monstruo', titulo: 'Monstruo', pasos: { inicio: { texto: 'x' } } } as Evento;
    expect(eventosQueFaltan([islote, monstruo])).toEqual(['dano_en_la_bodega']);
  });
});
