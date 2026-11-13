
import { Generador } from './generador';
import { ResultadoTirada } from './resultado-tirada';

interface Expresion {
  cantidad: number;
  caras: number;
  multiplicador: number;
  suma: number;
}

// Lee una expresión como "2d6", "1d6x5", "1d6+1" o "1d6x10+5". Lanza un error si no es válida.
// Orden: primero se multiplica y después se suma ("1d6x10+5" = dado × 10 + 5).
function leerExpresion(expresion: string): Expresion {
  const coincidencia = expresion.match(/^(\d+)d(\d+)(?:x(\d+))?(?:\+(\d+))?$/);

  if (!coincidencia) {
    throw new Error('Expresión de dados no válida');
  }

  const cantidad = Number(coincidencia[1]);
  const caras = Number(coincidencia[2]);
  const multiplicador = coincidencia[3] ? Number(coincidencia[3]) : 1;
  const suma = coincidencia[4] ? Number(coincidencia[4]) : 0;

  if (cantidad < 1 || caras < 1 || multiplicador < 1) {
    throw new Error('La cantidad, las caras y el multiplicador deben ser mayores que cero');
  }

  return { cantidad, caras, multiplicador, suma };
}

export function tirar(
  expresion: string,
  generador: Generador
): ResultadoTirada {

  const { cantidad, caras, multiplicador, suma: extra } = leerExpresion(expresion);

  const dados: number[] = [];

  for (let i = 0; i < cantidad; i++) {
    const resultado = Math.floor(generador.siguiente() * caras) + 1;
    dados.push(resultado);
  }

  const suma = dados.reduce((total, dado) => total + dado, 0);
  const total = suma * multiplicador + extra;

  return { dados, total };
}

/** Lo mínimo y lo máximo que puede sacar una expresión, sin tirar: "3d6" → { min: 3, max: 18 }. */
export function rangoDeTirada(expresion: string): { min: number; max: number } {
  const { cantidad, caras, multiplicador, suma } = leerExpresion(expresion);
  return { min: cantidad * multiplicador + suma, max: cantidad * caras * multiplicador + suma };
}
