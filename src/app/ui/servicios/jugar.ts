import { inject, Injectable } from '@angular/core';
import type { Dados } from '../../core/dados/dados';
import type { Estado } from '../../core/estado/estado';
import { conSusEventos } from '../../core/eventos/con-sus-eventos';
import { hayEventoEnCurso, vistaDelEvento } from '../../core/eventos/motor';
import { JuegoStore } from '../../store/juego.store';
import { nombresDeSeguidores } from '../textos/lineas-del-registro';
import { describirCambio, type NombresDeSeguidores } from '../textos/textos';
import { Registro } from './registro';

// JUGAR (pantalla de pruebas): lo que hace cada botón que cambia la partida. Pide la regla al store
// (store.ejecutar) y apunta en el registro lo que ha pasado. Si la regla da error, lo apunta como
// ERROR y la partida se queda como estaba. Así ningún componente repite esta parte.
//
// Sprint 10: es también LA PUERTA DE LOS EVENTOS de la pantalla. Si la regla devuelve "eventos",
// en el mismo paso se meten en la pila del motor (conSusEventos): los programados abren la ventana
// de eventos y los que aún no existen se apuntan como "pendiente", como antes.
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
    const habiaEvento = !!antes && hayEventoEnCurso(antes);
    try {
      const resultado = this.store.ejecutar((estado, dados) => {
        const r = regla(estado, dados);
        return tieneEventos(r) ? conSusEventos(r, dados) : r;
      });
      const nombres = nombresDeSeguidores(antes, resultado.estado);
      // En el registro, como "pendiente" solo salen los eventos que de verdad no están programados.
      const paraLineas = tieneEventos(resultado) && 'pendientes' in resultado ? { ...resultado, eventos: resultado.pendientes } : resultado;
      this.registro.apuntar(dia, [...lineas(paraLineas as R, nombres), ...lineasDelEventoNuevo(resultado, habiaEvento, nombres)]);
      return resultado;
    } catch (error) {
      this.registro.apuntar(dia, [`ERROR: ${error instanceof Error ? error.message : String(error)}`]);
      return null;
    }
  }
}

function tieneEventos<R extends { estado: Estado }>(r: R): r is R & { eventos: string[] } {
  return Array.isArray((r as { eventos?: unknown }).eventos);
}

/** Si con este botón ha empezado un evento: "Evento: Deseo" y lo que ya ha cambiado al empezar. */
function lineasDelEventoNuevo(resultado: { estado: Estado }, habiaEvento: boolean, nombres: NombresDeSeguidores): string[] {
  if (habiaEvento || !hayEventoEnCurso(resultado.estado)) return [];
  const vista = vistaDelEvento(resultado.estado);
  const cambios = (resultado as { cambiosDeEventos?: Parameters<typeof describirCambio>[0][] }).cambiosDeEventos ?? [];
  return [`  Evento: ${vista?.titulo ?? '?'}`, ...cambios.map(c => '    ' + describirCambio(c, nombres))];
}
