import { AJUSTES } from '../ajustes/ajustes';
import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { OBJETOS } from '../catalogos/cargar-objetos';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { condicionesVigentes } from '../condiciones/condiciones-vigentes';
import { tripulacionMaxActual, famaObjetivoActual, fuerzaActual, ingenioActual, vidaMaxActual } from '../condiciones/consultas';
import type { Jugador } from '../estado/jugador';
import { espaciosOcupados } from '../objetos/consultas';
import sobrenombresJson from '../../data/personaje/sobrenombres.json';

// LA HOJA DE PERSONAJE, LISTA PARA ENSEÑAR (pantalla de pruebas, tras el Sprint 8).
// Es una CONSULTA: no cambia nada. Junta lo que la pantalla necesita ya calculado y con los
// nombres bonitos de los catálogos, para que la interfaz solo tenga que pintarlo (sin reglas).
// Fuerza, ingenio, vida máxima y fama objetivo salen de las consultas que suman el amuleto y las
// condiciones (no del campo de la hoja), como se decidió en el Sprint 5.

export interface HojaDePersonaje {
  nombre: string;
  sobrenombre: { id: string; nombre: string; descripcion: string };
  retrato: Jugador['retrato'];
  fuerza: number;
  ingenio: number;
  vida: number;
  vidaMax: number;
  oro: number;
  comida: number;
  comidaMaxima: number;
  tripulacion: number;
  tripulacionMax: number;
  fama: number;
  famaObjetivo: number;
  diasSinComer: number;
  espacios: { ocupados: number; total: number };
  inventario: { id: string; nombre: string; usosRestantes?: number }[];
  seguidores: {
    id: string; nombre: string; tipo: string; ataque: number; resistencia: number; resistenciaMaxima: number;
    inseparable: boolean; vital: boolean;
  }[];
  // dentroDe: el nombre de la condición que la lleva dentro ("Amuleto maldito"), solo en las partes.
  // descripcion: lo que implica ("Pierdes 1 PV por día sin comer..."), de la ficha del catálogo.
  condiciones: { id: string; nombre: string; descripcion: string; categoria: string; imagen?: string; turnosRestantes?: number; origen: string; dentroDe?: string; tienePartes: boolean }[];
}

// nombreFemenino: "La maldita", "La hermana"... (se usa con el retrato de mujer).
interface FichaSobrenombre { id: string; nombre: string; nombreFemenino?: string; descripcion: string }
const SOBRENOMBRES = sobrenombresJson as FichaSobrenombre[];

/** El nombre del sobrenombre para enseñar, en femenino con el retrato de mujer ("La afortunada"). */
export function nombreDeSobrenombre(id: string, retrato: Jugador['retrato']): string {
  const ficha = SOBRENOMBRES.find(s => s.id === id);
  return (retrato === 'mujer' ? ficha?.nombreFemenino : undefined) ?? ficha?.nombre ?? id;
}

export function hojaDePersonaje(jugador: Jugador): HojaDePersonaje {
  const sobrenombre = SOBRENOMBRES.find(s => s.id === jugador.sobrenombre);
  return {
    nombre: jugador.nombre,
    sobrenombre: {
      id: jugador.sobrenombre,
      nombre: nombreDeSobrenombre(jugador.sobrenombre, jugador.retrato),
      descripcion: sobrenombre?.descripcion ?? '',
    },
    retrato: jugador.retrato,
    fuerza: fuerzaActual(jugador),
    ingenio: ingenioActual(jugador),
    vida: jugador.vida,
    vidaMax: vidaMaxActual(jugador),
    oro: jugador.oro,
    comida: jugador.comida,
    comidaMaxima: AJUSTES.comidaMaxima,
    tripulacion: jugador.tripulacion,
    tripulacionMax: tripulacionMaxActual(jugador),
    fama: jugador.fama,
    famaObjetivo: famaObjetivoActual(jugador),
    diasSinComer: jugador.diasSinComer,
    espacios: { ocupados: espaciosOcupados(jugador), total: jugador.capacidadInventario },
    inventario: jugador.inventario.map(llevado => ({
      id: llevado.id,
      nombre: OBJETOS.find(o => o.id === llevado.id)?.nombre ?? llevado.id,
      ...(llevado.usosRestantes === undefined ? {} : { usosRestantes: llevado.usosRestantes }),
    })),
    seguidores: jugador.seguidores.map(s => ({
      id: s.id,
      nombre: s.nombre,
      tipo: TIPOS_SEGUIDOR.find(t => t.id === s.tipo)?.nombre ?? s.tipo,
      ataque: s.ataque,
      resistencia: s.resistencia,
      resistenciaMaxima: s.resistenciaMaxima,
      inseparable: s.inseparable === true,
      vital: s.vital === true,
    })),
    condiciones: condicionesVigentes(jugador).map(c => {
      const ficha = CONDICIONES.find(f => f.id === c.id);
      return {
        id: c.id,
        nombre: ficha?.nombre ?? c.id,
        descripcion: ficha?.descripcion ?? '',
        categoria: ficha?.categoria ?? 'otra',
        ...(ficha?.imagen === undefined ? {} : { imagen: ficha.imagen }),
        ...(c.turnosRestantes === undefined ? {} : { turnosRestantes: c.turnosRestantes }),
        origen: c.origen,
        ...(c.dentroDe === undefined ? {} : { dentroDe: CONDICIONES.find(f => f.id === c.dentroDe)?.nombre ?? c.dentroDe }),
        // Lleva otras dentro (el amuleto maldito): la barra enseña sus partes, no a ella.
        tienePartes: (jugador.condiciones.find(a => a.id === c.id)?.partes?.length ?? 0) > 0,
      };
    }),
  };
}
