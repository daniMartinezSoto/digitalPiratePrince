import { Component, computed, inject, input } from '@angular/core';
import { accionesDisponibles } from '../../../core/acciones/acciones-disponibles';
import type { IdAccion, ResultadoAccion, Sitio } from '../../../core/acciones/accion';
import { buscarInformacion } from '../../../core/acciones/buscar-informacion';
import { cazar } from '../../../core/acciones/cazar';
import { enterrarTesoro } from '../../../core/acciones/enterrar-tesoro';
import { investigarNaufragio, registrarRuinas } from '../../../core/acciones/explorar';
import { mendigar } from '../../../core/acciones/mendigar';
import { pescar } from '../../../core/acciones/pescar';
import { reposar } from '../../../core/acciones/reposar';
import { solicitarAudiencia } from '../../../core/acciones/audiencia';
import { darDiscurso } from '../../../core/contratar/contratar';
import type { Dados } from '../../../core/dados/dados';
import type { Estado } from '../../../core/estado/estado';
import { descansarEnMonasterio, rezar } from '../../../core/monasterio/monasterio';
import { comer, opcionesDeComida, type EleccionDeComida } from '../../../core/turno/comer';
import { descansar, opcionesDeDescanso, type EleccionDeDescanso } from '../../../core/turno/descansar';
import { iniciarTurno } from '../../../core/turno/iniciar-turno';
import { JuegoStore } from '../../../store/juego.store';
import { Registro } from '../../servicios/registro';
import {
  lineasDeAccion,
  lineasDeAmanecer,
  lineasDeComida,
  lineasDeDescanso,
  nombresDeSeguidores,
} from '../../textos/lineas-del-registro';
import { NOMBRE_DE_ACCION, NOMBRE_DE_COMIDA, NOMBRE_DE_DESCANSO, textoDeMotivo } from '../../textos/textos';
import { sitioDe, type Ubicacion } from '../../ubicacion';

type AccionDeUnClic = (estado: Estado, sitio: Sitio, dados: Dados) => ResultadoAccion;

// Las acciones que se hacen con un solo clic (las de varios pasos llegan en el paso 3).
const ACCIONES_DE_UN_CLIC: Partial<Record<IdAccion, AccionDeUnClic>> = {
  pescar,
  cazar,
  reposar,
  dar_discurso: darDiscurso,
  buscar_informacion: (estado, sitio, dados) => buscarInformacion(estado, sitio, 0, dados), // sin sobornos, de momento
  solicitar_audiencia: solicitarAudiencia,
  rezar,
  descansar_en_monasterio: descansarEnMonasterio,
  enterrar_tesoro: enterrarTesoro,
  investigar_naufragio: investigarNaufragio,
  registrar_ruinas: registrarRuinas,
  mendigar,
};

// EL PANEL DEL DÍA (pantalla de pruebas): los botones de la fase en que está la partida.
// Las opciones y los motivos salen de las consultas de core/; todo lo que cambia la partida
// se pide al store (ejecutar). Lo que pasa se apunta en el registro.
@Component({
  selector: 'app-panel-del-dia',
  templateUrl: './panel-del-dia.html',
  styleUrl: './panel-del-dia.css',
})
export class PanelDelDia {
  readonly ubicacion = input.required<Ubicacion>();

  private readonly store = inject(JuegoStore);
  private readonly registro = inject(Registro);

  protected readonly estado = this.store.estado;
  private readonly sitio = computed(() => sitioDe(this.ubicacion()));

  protected readonly acciones = computed(() => {
    const estado = this.estado();
    if (!estado) {
      return [];
    }
    return accionesDisponibles(estado, this.sitio()).map(a => {
      const programada = a.accion in ACCIONES_DE_UN_CLIC;
      return {
        id: a.accion,
        nombre: NOMBRE_DE_ACCION[a.accion],
        sePuede: a.disponible && programada,
        nota: !a.disponible ? textoDeMotivo(a) : programada ? '' : 'llega en el paso 3',
      };
    });
  });

  protected readonly comida = computed(() => {
    const estado = this.estado();
    const { lugar, terreno } = this.ubicacion();
    return estado ? opcionesDeComida(estado, lugar, undefined, terreno) : null;
  });

  protected readonly descanso = computed(() => {
    const estado = this.estado();
    if (!estado) {
      return [];
    }
    return opcionesDeDescanso(estado, this.ubicacion().lugar, this.sitio().hex).map(o => ({
      ...o,
      nombre: NOMBRE_DE_DESCANSO[o.eleccion],
    }));
  });

  protected readonly nombreDeComida = NOMBRE_DE_COMIDA;

  protected empezarElDia(): void {
    this.hacer((estado, dados) => iniciarTurno(estado, dados), lineasDeAmanecer);
  }

  protected accion(id: IdAccion): void {
    const funcion = ACCIONES_DE_UN_CLIC[id];
    if (!funcion) {
      return;
    }
    const sitio = this.sitio();
    this.hacer((estado, dados) => funcion(estado, sitio, dados), (r, nombres) =>
      lineasDeAccion(NOMBRE_DE_ACCION[id], r, nombres),
    );
  }

  protected comer(eleccion: EleccionDeComida): void {
    const { lugar, terreno } = this.ubicacion();
    this.hacer((estado, dados) => comer(estado, eleccion, lugar, dados, undefined, terreno), (r, nombres) =>
      lineasDeComida(NOMBRE_DE_COMIDA[eleccion], r, nombres),
    );
  }

  protected dormir(eleccion: EleccionDeDescanso): void {
    const { lugar, terreno } = this.ubicacion();
    const hex = this.sitio().hex;
    this.hacer((estado, dados) => descansar(estado, eleccion, lugar, dados, undefined, hex, terreno), (r, nombres) =>
      lineasDeDescanso(NOMBRE_DE_DESCANSO[eleccion], r, nombres),
    );
  }

  /** Pide al store que ejecute la regla y apunta en el registro lo que ha pasado. */
  private hacer<R extends { estado: Estado }>(
    regla: (estado: Estado, dados: Dados) => R,
    lineas: (r: R, nombres: Record<string, string>) => string[],
  ): void {
    const antes = this.estado();
    const dia = antes?.mundo.dia ?? 0;
    try {
      const resultado = this.store.ejecutar(regla);
      this.registro.apuntar(dia, lineas(resultado, nombresDeSeguidores(antes, resultado.estado)));
    } catch (error) {
      this.registro.apuntar(dia, [`ERROR: ${error instanceof Error ? error.message : String(error)}`]);
    }
  }
}
