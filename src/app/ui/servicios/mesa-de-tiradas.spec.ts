import { TestBed } from '@angular/core/testing';
import { ladoDelDado, tamanoDelDado } from '../componentes/dados-en-el-mapa/dados-en-el-mapa';
import { MesaDeTiradas } from './mesa-de-tiradas';

describe('la mesa de tiradas', () => {
  it('sin opciones, como siempre: solo los dados, el bonificador y el total', () => {
    const mesa = TestBed.inject(MesaDeTiradas);
    mesa.ensenar({ dados: [4], modificador: 1, total: 5 });
    expect(mesa.tirada()).toEqual({ numero: 1, dados: [4], modificador: 1, total: 5 });
  });

  it('en combate: un color por dado, sin cartel de total, pequeños, y se pueden quedar o añadirse', () => {
    const mesa = TestBed.inject(MesaDeTiradas);
    mesa.ensenar(
      { dados: [6, 3, 5], modificador: 0, total: 14 },
      { colores: ['dorado', 'verde', 'rojo'], sinTotal: true, pequenos: true, seQueda: true },
    );
    expect(mesa.tirada()).toMatchObject({ dados: [6, 3, 5], colores: ['dorado', 'verde', 'rojo'], sinTotal: true, pequenos: true, seQueda: true });

    mesa.ensenar({ dados: [2], modificador: 0, total: 2 }, { colores: ['dorado'], anadir: true });
    expect(mesa.tirada()).toMatchObject({ numero: 2, dados: [2], anadir: true });
  });

  it('hace falta un color por dado', () => {
    const mesa = TestBed.inject(MesaDeTiradas);
    expect(() => mesa.ensenar({ dados: [1, 2], modificador: 0, total: 3 }, { colores: ['rojo'] })).toThrow(/un color por dado/);
  });

  it('recoger avisa a los dados que se habían quedado en la mesa', () => {
    const mesa = TestBed.inject(MesaDeTiradas);
    const antes = mesa.recogida();
    mesa.recoger();
    expect(mesa.recogida()).toBe(antes + 1);
  });
});

describe('tamaño de los dados', () => {
  it('uno solo en un mapa grande: 100 px (los de combate, 70)', () => {
    expect(tamanoDelDado(1, 1400, 900)).toBe(100);
    expect(tamanoDelDado(1, 1400, 900, true)).toBe(70);
  });

  it('cuantos más dados, más pequeños, pero nunca menos del mínimo', () => {
    const seis = tamanoDelDado(6, 1400, 900, true);
    const doce = tamanoDelDado(12, 1400, 900, true);
    expect(seis).toBeLessThanOrEqual(70);
    expect(doce).toBeLessThan(seis);
    expect(tamanoDelDado(100, 1400, 900, true)).toBe(40);
    expect(tamanoDelDado(100, 1400, 900)).toBe(48);
  });
});

describe('lado de la mesa donde cae cada dado', () => {
  it('en combate, los tuyos y los de tus seguidores a la izquierda y los enemigos a la derecha', () => {
    expect(ladoDelDado('dorado')).toBe('izquierda');
    expect(ladoDelDado('verde')).toBe('izquierda');
    expect(ladoDelDado('rojo')).toBe('derecha');
    expect(ladoDelDado('hueso')).toBe('toda');
  });
});
