import { inject, Injectable } from '@angular/core';
import type { Dados } from '../../core/dados/dados';
import type { Estado } from '../../core/estado/estado';
import { JuegoStore } from '../../store/juego.store';
import { nombresDeSeguidores } from '../textos/lineas-del-registro';
import type { NombresDeSeguidores } from '../textos/textos';
import { Registro } from './registro';

// JUGAR (pantalla de pruebas): lo que hace cada botón que cambia la partida. Pide la regla al store
// (store.ejecutar) y apunta en el registro lo que ha pasado. Si la regla da error, lo apunta como
// ERROR y la partida se queda como estaba. Así ningún componente repite esta parte.
@Injectable({ providedIn: 'root' })
export class Jugar {
  private readonly store = inject(JuegoStore);
  private readonly registro = inject(Registro);

  hacer<R extends { estado: Estado }>(
    regla: (estado: Estado, dados: Dados) => R,
    lineas: (resultado: R, nombres: NombresDeSeguidores) => string[],
  ): R | null {
    const antes = this.store.estado();
    const dia = antes?.mundo.dia ?? 0;
    try {
      const resultado = this.store.ejecutar(regla);
      this.registro.apuntar(dia, lineas(resultado, nombresDeSeguidores(antes, resultado.estado)));
      return resultado;
    } catch (error) {
      this.registro.apuntar(dia, [`ERROR: ${error instanceof Error ? error.message : String(error)}`]);
      return null;
    }
  }
}
