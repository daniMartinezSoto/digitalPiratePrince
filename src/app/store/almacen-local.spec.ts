import { CLAVES_DE_GUARDADO } from '../core/guardado/almacen';
import { AlmacenLocal, pedirGuardadoPersistente } from './almacen-local';

describe('AlmacenLocal (el almacén del navegador)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('leer algo que no existe da null', () => {
    expect(new AlmacenLocal().leer('nada')).toBeNull();
  });

  it('lo que se escribe queda en el localStorage y se puede leer', () => {
    const almacen = new AlmacenLocal();
    expect(almacen.escribir(CLAVES_DE_GUARDADO.partida, 'hola')).toBe(true);
    expect(localStorage.getItem(CLAVES_DE_GUARDADO.partida)).toBe('hola');
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBe('hola');
  });

  it('lo guardado sigue ahí con otro almacén (como al volver a abrir el juego)', () => {
    new AlmacenLocal().escribir(CLAVES_DE_GUARDADO.partida, 'día 7');
    expect(new AlmacenLocal().leer(CLAVES_DE_GUARDADO.partida)).toBe('día 7');
  });

  it('escribir otra vez sustituye lo anterior', () => {
    const almacen = new AlmacenLocal();
    almacen.escribir('x', 'día 1');
    almacen.escribir('x', 'día 2');
    expect(almacen.leer('x')).toBe('día 2');
  });

  it('borrar tira solo ese texto', () => {
    const almacen = new AlmacenLocal();
    almacen.escribir(CLAVES_DE_GUARDADO.partida, 'la partida');
    almacen.escribir(CLAVES_DE_GUARDADO.cronica, 'la crónica');
    almacen.borrar(CLAVES_DE_GUARDADO.partida);
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBeNull();
    expect(almacen.leer(CLAVES_DE_GUARDADO.cronica)).toBe('la crónica');
  });

  it('si el navegador se niega a escribir (lleno, incógnito...), devuelve false sin romper', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(new AlmacenLocal().escribir('x', 'hola')).toBe(false);
  });

  it('si el navegador se niega a leer, devuelve null sin romper', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(new AlmacenLocal().leer('x')).toBeNull();
  });

  it('si el navegador se niega a borrar, no rompe', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => new AlmacenLocal().borrar('x')).not.toThrow();
  });
});

describe('pedirGuardadoPersistente', () => {
  afterEach(() => {
    delete (navigator as any).storage;
  });

  function navegadorCon(storage: unknown): void {
    Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
  }

  it('devuelve true si el navegador acepta', async () => {
    navegadorCon({ persist: async () => true });
    expect(await pedirGuardadoPersistente()).toBe(true);
  });

  it('devuelve false si el navegador dice que no', async () => {
    navegadorCon({ persist: async () => false });
    expect(await pedirGuardadoPersistente()).toBe(false);
  });

  it('devuelve false, sin romper, si el navegador no lo admite', async () => {
    navegadorCon(undefined);
    expect(await pedirGuardadoPersistente()).toBe(false);
  });

  it('devuelve false, sin romper, si el navegador falla al pedirlo', async () => {
    navegadorCon({ persist: async () => { throw new Error('fallo'); } });
    expect(await pedirGuardadoPersistente()).toBe(false);
  });
});
