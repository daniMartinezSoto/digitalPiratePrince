import { CLAVES_DE_GUARDADO } from './almacen';
import { AlmacenEnMemoria } from './almacen-en-memoria';

describe('AlmacenEnMemoria (el almacén de mentira de los tests)', () => {
  it('leer algo que no existe da null', () => {
    expect(new AlmacenEnMemoria().leer('nada')).toBeNull();
  });

  it('lo que se escribe se puede leer', () => {
    const almacen = new AlmacenEnMemoria();
    expect(almacen.escribir('partida', 'hola')).toBe(true);
    expect(almacen.leer('partida')).toBe('hola');
  });

  it('escribir otra vez sustituye lo anterior', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir('partida', 'día 1');
    almacen.escribir('partida', 'día 2');
    expect(almacen.leer('partida')).toBe('día 2');
  });

  it('cada nombre es un cajón distinto', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir(CLAVES_DE_GUARDADO.partida, 'la partida');
    almacen.escribir(CLAVES_DE_GUARDADO.cronica, 'la crónica');
    expect(almacen.leer(CLAVES_DE_GUARDADO.partida)).toBe('la partida');
    expect(almacen.leer(CLAVES_DE_GUARDADO.cronica)).toBe('la crónica');
  });

  it('borrar tira solo ese texto', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir('partida', 'hola');
    almacen.escribir('cronica', 'adiós');
    almacen.borrar('partida');
    expect(almacen.leer('partida')).toBeNull();
    expect(almacen.leer('cronica')).toBe('adiós');
  });

  it('borrar algo que no existe no rompe', () => {
    expect(() => new AlmacenEnMemoria().borrar('nada')).not.toThrow();
  });

  it('fingiendo que el navegador se niega a escribir: devuelve false y no guarda', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir('partida', 'lo de antes');
    almacen.fallarAlEscribir = true;
    expect(almacen.escribir('partida', 'lo nuevo')).toBe(false);
    almacen.fallarAlEscribir = false;
    expect(almacen.leer('partida')).toBe('lo de antes');
  });

  it('fingiendo que el navegador se niega a leer: devuelve null', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir('partida', 'hola');
    almacen.fallarAlLeer = true;
    expect(almacen.leer('partida')).toBeNull();
  });

  it('las claves del juego llevan el prefijo del juego', () => {
    expect(CLAVES_DE_GUARDADO.partida).toBe('pirate-prince.partida');
    expect(CLAVES_DE_GUARDADO.cronica).toBe('pirate-prince.cronica');
  });
});
