
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

  obtenerEstado(): number {
    return this.generador.obtenerEstado();
  }
}
