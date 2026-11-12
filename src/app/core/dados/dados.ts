import { Generador } from './generador';
import { tirar as tirarExpresion } from './tirada';
import { ResultadoTirada } from './resultado-tirada';

export class Dados {
  private generador: Generador;

  constructor(semilla: number) {
    this.generador = new Generador(semilla);
  }

  tirar(expresion: string): ResultadoTirada {
    return tirarExpresion(expresion, this.generador);
  }

  /** Entero aleatorio entre min y max, ambos incluidos. Consume 1 número del generador. */
  entero(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`entero: rango no válido (${min}, ${max})`);
    }
    return min + Math.floor(this.generador.siguiente() * (max - min + 1));
  }

  /** true con probabilidad p (entre 0 y 1; 0.2 = 20 %). Consume 1 número del generador. */
  probabilidad(p: number): boolean {
    if (!(p >= 0 && p <= 1)) {
      throw new Error(`probabilidad: p debe estar entre 0 y 1 (recibido ${p})`);
    }
    return this.generador.siguiente() < p;
  }

  /** Elige un elemento según su peso. Consume 1 número del generador. */
  elegirPonderado<T extends { peso: number }>(lista: readonly T[]): T {
    if (lista.length === 0) {
      throw new Error('elegirPonderado: la lista está vacía');
    }
    if (lista.some(e => !(e.peso > 0))) {
      throw new Error('elegirPonderado: todos los pesos deben ser mayores que 0');
    }
    const total = lista.reduce((suma, e) => suma + e.peso, 0);
    let punto = this.generador.siguiente() * total;
    for (const elemento of lista) {
      if (punto < elemento.peso) return elemento;
      punto -= elemento.peso;
    }
    return lista[lista.length - 1]; // por si el redondeo se pasa del último
  }

  obtenerEstado(): number {
    return this.generador.obtenerEstado();
  }
}