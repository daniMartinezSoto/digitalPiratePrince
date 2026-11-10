
import { Generador } from './generador';
import { ResultadoTirada } from './resultado-tirada';

export function tirar(
  expresion: string,
  generador: Generador
): ResultadoTirada {

  const coincidencia = expresion.match(/^(\d+)d(\d+)(?:x(\d+))?$/);

  if (!coincidencia) {
    throw new Error('Expresión de dados no válida');
  }

  const cantidad = Number(coincidencia[1]);
  const caras = Number(coincidencia[2]);
  const multiplicador = coincidencia[3] ? Number(coincidencia[3]) : 1;

  if (cantidad < 1 || caras < 1 || multiplicador < 1) {
    throw new Error('La cantidad, las caras y el multiplicador deben ser mayores que cero');
  }

  const dados: number[] = [];

  for (let i = 0; i < cantidad; i++) {
    const resultado = Math.floor(generador.siguiente() * caras) + 1;
    dados.push(resultado);
  }

  const suma = dados.reduce((total, dado) => total + dado, 0);
  const total = suma * multiplicador;

  return { dados, total };
}
