import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { accionesDisponibles } from '../../../core/acciones/acciones-disponibles';
import type { IdAccion, ResultadoAccion, Sitio } from '../../../core/acciones/accion';
import { solicitarAudiencia } from '../../../core/acciones/audiencia';
import { buscarInformacion, opcionesDeBuscarInformacion } from '../../../core/acciones/buscar-informacion';
import { cazar } from '../../../core/acciones/cazar';
import { enterrarTesoro } from '../../../core/acciones/enterrar-tesoro';
import { investigarNaufragio, registrarRuinas } from '../../../core/acciones/explorar';
import { mendigar } from '../../../core/acciones/mendigar';
import { pescar } from '../../../core/acciones/pescar';
import { reposar } from '../../../core/acciones/reposar';
import { buscarSeguidor, contratarMarineros, darDiscurso } from '../../../core/contratar/contratar';
import type { Dados } from '../../../core/dados/dados';
import type { Estado } from '../../../core/estado/estado';
import { opcionesDeApuesta, type Apuesta } from '../../../core/guarida/apuestas';
import { sentarseALosDados } from '../../../core/guarida/dados';
import { echarUnPulso } from '../../../core/guarida/pulso';
import { irAlMercado } from '../../../core/mercado/mercado';
import { descansarEnMonasterio, rezar } from '../../../core/monasterio/monasterio';
import { comer, opcionesDeComida, type EleccionDeComida } from '../../../core/turno/comer';
import { descansar, opcionesDeDescanso, type EleccionDeDescanso } from '../../../core/turno/descansar';
import { iniciarTurno } from '../../../core/turno/iniciar-turno';
import { condicionesQueImpidenViajar, destinosDeViaje } from '../../../core/viaje/viajar';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { Navegar } from '../../servicios/navegar';
import {
  lineasDeAccion,
  lineasDeAmanecer,
  lineasDeBuscarInformacion,
  lineasDeComida,
  lineasDeDescanso,
  lineasDePulso,
} from '../../textos/lineas-del-registro';
import {
  NOMBRE_DE_ACCION,
  NOMBRE_DE_COMIDA,
  NOMBRE_DE_DESCANSO,
  NOMBRE_DE_LUGAR,
  NOMBRE_DE_TERRENO,
  nombreDeCondicion,
  nombreDeObjeto,
  nombreDeTipoDeSeguidor,
  textoDeApuesta,
  textoDeMotivo,
} from '../../textos/textos';
import { sitioActual } from '../../../core/mapa/sitio-actual';
import type { Coordenada } from '../../../core/mapa/mapa';
import { Marineros } from '../marineros/marineros';
import { Mercado } from '../mercado/mercado';
import { MesaDeDados } from '../mesa-de-dados/mesa-de-dados';
import { SeguidorEnEspera } from '../seguidor-en-espera/seguidor-en-espera';
import { ACCIONES_CON_DADOS, MesaDeTiradas } from '../../servicios/mesa-de-tiradas';

type AccionDeUnClic = (estado: Estado, sitio: Sitio, dados: Dados) => ResultadoAccion;

// Las acciones que se hacen con un solo clic.
const ACCIONES_DE_UN_CLIC: Partial<Record<IdAccion, AccionDeUnClic>> = {
  pescar,
  cazar,
  reposar,
  dar_discurso: darDiscurso,
  solicitar_audiencia: solicitarAudiencia,
  rezar,
  descansar_en_monasterio: descansarEnMonasterio,
  enterrar_tesoro: enterrarTesoro,
  investigar_naufragio: investigarNaufragio,
  registrar_ruinas: registrarRuinas,
  mendigar,
};

/** Acciones que antes de hacerse piden elegir algo aquí mismo: la apuesta del pulso o los sobornos. */
type EleccionPrevia = 'pulso' | 'sobornos' | null;

// EL PANEL DEL DÍA (pantalla de pruebas): los botones de la fase en que está la partida.
// Con una acción a medias (mercado, marineros, seguidor, mesa de dados) enseña solo esa acción.
// Las opciones y los motivos salen de las consultas de core/; lo que cambia la partida va por
// el servicio Jugar (store.ejecutar + registro).
@Component({
  selector: 'app-panel-del-dia',
  imports: [Mercado, Marineros, SeguidorEnEspera, MesaDeDados],
  templateUrl: './panel-del-dia.html',
  styleUrl: './panel-del-dia.css',
})
export class PanelDelDia {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);
  private readonly navegar = inject(Navegar);
  private readonly mesa = inject(MesaDeTiradas);

  constructor() {
    // Si el jugador cambia de casilla (embarca, desembarca...) o de fase, se cierra cualquier elección
    // a medias ("Viajar…", sobornos, pulso): ya no vale para donde está ahora.
    effect(() => {
      const estado = this.estado();
      void (estado ? `${estado.mundo.posicion.col},${estado.mundo.posicion.fila},${estado.mundo.fase},${estado.mundo.dia}` : '');
      untracked(() => {
        this.eleccionPrevia.set(null);
        this.navegar.eligiendoViaje.set(false);
      });
    });
  }

  protected readonly estado = this.store.estado;
  // Dónde está el jugador: lo dice el mapa (Sprint 9). null si no hay partida.
  private readonly sitio = computed(() => {
    const estado = this.estado();
    return estado ? sitioActual(estado) : null;
  });
  /** El terreno de tierra donde está (para la comida del superviviente y el evento nocturno). */
  private readonly terrenoAlRaso = computed(() => {
    const t = this.sitio()?.terreno;
    return t === 'playa' || t === 'jungla' || t === 'jungla_profunda' ? t : undefined;
  });
  protected readonly eleccionPrevia = signal<EleccionPrevia>(null);

  protected readonly acciones = computed(() => {
    const estado = this.estado();
    if (!estado) {
      return [];
    }
    return accionesDisponibles(estado, this.sitio()!).map(a => ({
      id: a.accion,
      nombre: NOMBRE_DE_ACCION[a.accion],
      sePuede: a.disponible,
      nota: a.disponible ? '' : textoDeMotivo(a),
    }));
  });

  protected readonly apuestas = computed(() => {
    const estado = this.estado();
    return estado ? opcionesDeApuesta(estado).map(b => ({ ...b, texto: textoDeApuesta(b.apuesta, b.cantidad) })) : [];
  });

  protected readonly sobornos = computed(() => {
    const estado = this.estado();
    return estado ? opcionesDeBuscarInformacion(estado, this.sitio()!) : null;
  });

  protected readonly comida = computed(() => {
    const estado = this.estado();
    const sitio = this.sitio();
    return estado && sitio ? opcionesDeComida(estado, sitio.lugar, undefined, this.terrenoAlRaso()) : null;
  });

  protected readonly descanso = computed(() => {
    const estado = this.estado();
    const sitio = this.sitio();
    if (!estado || !sitio) {
      return [];
    }
    return opcionesDeDescanso(estado, sitio.lugar, sitio.hex).map(o => ({
      ...o,
      nombre: NOMBRE_DE_DESCANSO[o.eleccion],
    }));
  });

  protected readonly nombreDeComida = NOMBRE_DE_COMIDA;

  // --- Viajar por el mapa (Sprint 9): las casillas a las que se puede ir ---
  protected readonly impidenViajar = computed(() => {
    const estado = this.estado();
    return estado ? condicionesQueImpidenViajar(estado).map(nombreDeCondicion) : [];
  });
  protected readonly destinos = computed(() => {
    const estado = this.estado();
    if (!estado) return [];
    return destinosDeViaje(estado).map(c => ({ casilla: c, texto: this.navegar.textoDelViaje(c) }));
  });

  /** Eligiendo a dónde viajar (lo comparte con el mapa, que marca las casillas en rojo). */
  protected readonly eligiendoViaje = this.navegar.eligiendoViaje;

  protected prepararViaje(): void {
    this.eleccionPrevia.set(null);
    this.navegar.eligiendoViaje.set(true);
  }

  protected cancelarViaje(): void {
    this.navegar.eligiendoViaje.set(false);
  }

  protected viajar(destino: Coordenada): void {
    this.navegar.viajar(destino);
  }

  protected empezarElDia(): void {
    this.jugar.hacer((e, d) => iniciarTurno(e, d), lineasDeAmanecer);
  }

  protected accion(id: IdAccion): void {
    const sitio = this.sitio()!;
    const nombre = NOMBRE_DE_ACCION[id];
    const deUnClic = ACCIONES_DE_UN_CLIC[id];
    if (deUnClic) {
      const resultado = this.jugar.hacer((e, d) => deUnClic(e, sitio, d), (r, n) => lineasDeAccion(nombre, r, n));
      // las tiradas públicas se enseñan con dados encima del mapa
      if (resultado?.tirada && ACCIONES_CON_DADOS.has(id)) this.mesa.ensenar(resultado.tirada);
      return;
    }
    switch (id) {
      case 'buscar_informacion':
        // En los puertos se elige antes si se soborna; en aldeas y guaridas, directamente.
        if (sitio.lugar === 'puerto') {
          this.eleccionPrevia.set('sobornos');
        } else {
          this.buscarInformacion(0);
        }
        return;
      case 'echar_un_pulso':
        this.eleccionPrevia.set('pulso');
        return;
      case 'ir_al_mercado':
        this.jugar.hacer((e, d) => irAlMercado(e, sitio, d), (r, n) => {
          const en = r.estado.mundo.accionEnCurso;
          const rastrillo = en?.tipo === 'mercado' && en.rastrillo ? `${nombreDeObjeto(en.rastrillo.objeto)} (${en.rastrillo.precio})` : 'nada';
          return [...lineasDeAccion(nombre, r, n), `  Hoy en el rastrillo: ${rastrillo}`];
        });
        return;
      case 'contratar_marineros':
        this.jugar.hacer((e, d) => contratarMarineros(e, sitio, d), (r, n) => {
          const en = r.estado.mundo.accionEnCurso;
          return [...lineasDeAccion(nombre, r, n), `  Hoy hay ${en?.tipo === 'marineros' ? en.disponibles : 0} marineros dispuestos`];
        });
        return;
      case 'buscar_seguidor':
        this.jugar.hacer((e, d) => buscarSeguidor(e, sitio, d), (r, n) => {
          const en = r.estado.mundo.accionEnCurso;
          const quien = en?.tipo === 'seguidor' ? (en.nombre ? `${en.nombre} (${nombreDeTipoDeSeguidor(en.seguidor)})` : nombreDeTipoDeSeguidor(en.seguidor)) : '';
          const oferta = en?.tipo === 'seguidor' ? [`  Se ofrece: ${quien}, por ${en.precio} de oro`] : [];
          return [...lineasDeAccion(nombre, r, n), ...oferta];
        });
        return;
      case 'jugar_a_los_dados':
        this.jugar.hacer((e, d) => sentarseALosDados(e, sitio, d), (r, n) => lineasDeAccion('Te sientas a la mesa de dados', r, n));
        return;
    }
  }

  protected buscarInformacion(sobornos: number): void {
    const sitio = this.sitio()!;
    this.eleccionPrevia.set(null);
    const titulo = sobornos > 0 ? `Buscar información (${sobornos} soborno(s))` : 'Buscar información';
    this.jugar.hacer((e, d) => buscarInformacion(e, sitio, sobornos, d), (r, n) => lineasDeBuscarInformacion(titulo, r, n));
  }

  protected pulso(apuesta: Apuesta): void {
    const sitio = this.sitio()!;
    this.eleccionPrevia.set(null);
    this.jugar.hacer((e, d) => echarUnPulso(e, sitio, apuesta, d), lineasDePulso);
  }

  protected comer(eleccion: EleccionDeComida): void {
    const lugar = this.sitio()!.lugar;
    const terreno = this.terrenoAlRaso();
    this.jugar.hacer((e, d) => comer(e, eleccion, lugar, d, undefined, terreno), (r, n) => lineasDeComida(NOMBRE_DE_COMIDA[eleccion], r, n));
  }

  protected dormir(eleccion: EleccionDeDescanso): void {
    const { lugar, hex } = this.sitio()!;
    const terreno = this.terrenoAlRaso();
    this.jugar.hacer((e, d) => descansar(e, eleccion, lugar, d, undefined, hex, terreno), (r, n) =>
      lineasDeDescanso(NOMBRE_DE_DESCANSO[eleccion], r, n),
    );
  }
}
