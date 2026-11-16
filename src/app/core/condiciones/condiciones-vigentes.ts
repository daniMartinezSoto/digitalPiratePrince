import { HABILIDADES } from '../catalogos/cargar-habilidades';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Habilidad } from '../catalogos/habilidad';
import type { Objeto } from '../catalogos/objeto';
import type { Jugador } from '../estado/jugador';
import sobrenombresJson from '../../data/personaje/sobrenombres.json';

// CONDICIONES VIGENTES = todas las que afectan al jugador AHORA MISMO. Salen de tres sitios:
//   apuntada: está escrita en su hoja (jugador.condiciones): tormenta, escorbuto, el amuleto maldito...
//   parte:    va DENTRO de una apuntada. El amuleto maldito lleva dos: su bendición y su maldición.
//             Si se quita el amuleto, se van las dos con él.
//   otorgada: se la da algo que tiene (su sobrenombre, un objeto o la habilidad de un seguidor)
//             MIENTRAS lo tenga. No se guarda: se calcula aquí cada vez. Por eso, al perder el
//             amuleto kalinago, el vínculo nativo desaparece solo (salvo que otra cosa también lo dé).
// Las reglas del juego (prohibiciones, bonificadores, fama objetivo...) miran SIEMPRE esta lista,
// no jugador.condiciones directamente.

export type OrigenCondicion = 'apuntada' | 'parte' | 'otorgada';

export interface CondicionVigente {
  // Id de la condición en el catálogo.
  id: string;

  origen: OrigenCondicion;

  // Solo en las apuntadas que tienen los turnos contados.
  turnosRestantes?: number;

  // Solo en las partes: id de la condición apuntada que la lleva dentro ("amuleto_maldito").
  dentroDe?: string;
}

// Lo que nos interesa aquí de un sobrenombre.
interface SobrenombreQueOtorga {
  id: string;
  otorga?: string[];
}

/** Dónde buscar qué otorga cada cosa. Por defecto, los catálogos del juego; los tests pueden pasar otros. */
export interface FuentesDeCondiciones {
  sobrenombres: readonly SobrenombreQueOtorga[];
  objetos: readonly Pick<Objeto, 'id' | 'otorga'>[];
  habilidades: readonly Pick<Habilidad, 'id' | 'otorga'>[];
}

const FUENTES_DEL_JUEGO: FuentesDeCondiciones = {
  sobrenombres: sobrenombresJson as SobrenombreQueOtorga[],
  objetos: OBJETOS,
  habilidades: HABILIDADES,
};

/**
 * Todas las condiciones que afectan al jugador ahora mismo, sin repetir ninguna.
 * Orden: primero las apuntadas (cada una seguida de sus partes), en el orden en que las tiene;
 * después las otorgadas por el sobrenombre, los objetos y los seguidores.
 * Si la misma condición llega por varios sitios (vínculo nativo por el sobrenombre Y por el amuleto),
 * sale una sola vez.
 */
export function condicionesVigentes(jugador: Jugador, fuentes: FuentesDeCondiciones = FUENTES_DEL_JUEGO): CondicionVigente[] {
  const vigentes: CondicionVigente[] = [];
  const anadir = (condicion: CondicionVigente): void => {
    if (!vigentes.some(v => v.id === condicion.id)) {
      vigentes.push(condicion);
    }
  };

  for (const apuntada of jugador.condiciones) {
    anadir(
      apuntada.turnosRestantes === undefined
        ? { id: apuntada.id, origen: 'apuntada' }
        : { id: apuntada.id, origen: 'apuntada', turnosRestantes: apuntada.turnosRestantes },
    );
    for (const parte of apuntada.partes ?? []) {
      anadir({ id: parte, origen: 'parte', dentroDe: apuntada.id });
    }
  }

  for (const id of idsOtorgados(jugador, fuentes)) {
    anadir({ id, origen: 'otorgada' });
  }

  return vigentes;
}

/** ¿Le afecta ahora mismo esa condición, venga de donde venga? */
export function tieneCondicion(jugador: Jugador, idCondicion: string, fuentes: FuentesDeCondiciones = FUENTES_DEL_JUEGO): boolean {
  return condicionesVigentes(jugador, fuentes).some(v => v.id === idCondicion);
}

/** Ids de las condiciones que le dan su sobrenombre, sus objetos y las habilidades de sus seguidores. */
function idsOtorgados(jugador: Jugador, fuentes: FuentesDeCondiciones): string[] {
  const ids: string[] = [];

  ids.push(...(fuentes.sobrenombres.find(s => s.id === jugador.sobrenombre)?.otorga ?? []));

  for (const llevado of jugador.inventario) {
    ids.push(...(fuentes.objetos.find(o => o.id === llevado.id)?.otorga ?? []));
  }

  for (const seguidor of jugador.seguidores) {
    for (const idHabilidad of seguidor.habilidades) {
      ids.push(...(fuentes.habilidades.find(h => h.id === idHabilidad)?.otorga ?? []));
    }
  }

  return ids;
}
