import { Dados } from './dados';
import type { ResultadoTirada } from './resultado-tirada';

// DADOS TRUCADOS: SOLO PARA LOS TESTS. Nada del juego debe usarlos.
//
// Le dices qué números tienen que salir y los da en ese orden: dadosTrucados([6, 6, 1]) saca un 6,
// otro 6 y un 1. Así un test de combate dice exactamente qué pasa ("sale un 6 y luego un 1") en vez
// de buscar una semilla que, por casualidad, lo produzca.
//
// Solo saben tirar UN dado ("1d6", "1d11"...), también multiplicado o con suma ("1d6x5", "1d6+1": el
// número de la lista es lo que saca el dado, y luego se multiplica y se suma), y entero(min, max): cada
// llamada gasta un número de la lista. Si el número no cabe en el dado o se acaba la lista, lanzan un error (el test está mal escrito).
// restantes() dice cuántos números quedan sin usar: sirve para comprobar que se gastaron los justos.

class DadosTrucados extends Dados {
  private readonly numeros: number[];

  constructor(numeros: number[]) {
    super(1);
    this.numeros = [...numeros];
  }

  override tirar(expresion: string): ResultadoTirada {
    const coincidencia = /^1d(\d+)(?:x(\d+))?(?:\+(\d+))?$/.exec(expresion);
    if (!coincidencia) {
      throw new Error(`Dados trucados: solo saben tirar un dado ("1d6", "1d6x5"), no "${expresion}"`);
    }
    const valor = this.siguienteNumero(1, Number(coincidencia[1]));
    const multiplicador = coincidencia[2] ? Number(coincidencia[2]) : 1;
    const suma = coincidencia[3] ? Number(coincidencia[3]) : 0;
    return { dados: [valor], total: valor * multiplicador + suma };
  }

  override entero(min: number, max: number): number {
    return this.siguienteNumero(min, max);
  }

  override probabilidad(): boolean {
    throw new Error('Dados trucados: probabilidad() no está trucada');
  }

  override elegirPonderado<T extends { peso: number }>(): T {
    throw new Error('Dados trucados: elegirPonderado() no está trucado');
  }

  restantes(): number {
    return this.numeros.length;
  }

  private siguienteNumero(min: number, max: number): number {
    const valor = this.numeros.shift();
    if (valor === undefined) {
      throw new Error('Dados trucados: se han acabado los números');
    }
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      throw new Error(`Dados trucados: el ${valor} no puede salir (tenía que estar entre ${min} y ${max})`);
    }
    return valor;
  }
}

/** Dados que sacan exactamente estos números, en este orden. SOLO PARA TESTS. */
export function dadosTrucados(numeros: number[]): Dados & { restantes(): number } {
  return new DadosTrucados(numeros);
}
