import { atacar, huir, iniciarCombate, quedarseConElAtaque, volverATirar, type EnemigoPedido } from '../../../core/combate/combate';
import { dadosTrucados } from '../../../core/dados/dados-trucados';
import type { Estado } from '../../../core/estado/estado';
import type { Seguidor } from '../../../core/estado/seguidor';
import { crearPartida } from '../../../core/partida/crear-partida';
import { nombresDeLuchadores } from '../../textos/textos-de-combate';
import { dadosDeLaPausa, guionDeRonda, type GuionDeRonda } from './guion-de-ronda';

// Partida de prueba: 15 PV, sin condiciones, en un combate.
function combate(pedidos: EnemigoPedido[], cambios: Partial<Estado['jugador']> = {}, sorteo: number[] = []): Estado {
  const { estado } = crearPartida(1, 'Ana');
  const partida: Estado = {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_conformista', vida: 15, vidaMax: 15, seguidores: [], condiciones: [], diasSinComer: 0, ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
  return iniciarCombate(partida, pedidos, dadosTrucados(sorteo));
}

const forzudo: Seguidor = { id: 'forzudo_1', tipo: 'forzudo', nombre: 'Rufus', ataque: 3, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };

/** Juega un botón y prepara su guion, como hará la ventana. */
function jugar(antes: Estado, boton: (e: Estado) => ReturnType<typeof atacar>): { guion: GuionDeRonda; despues: Estado } {
  const resultado = boton(antes);
  return { guion: guionDeRonda(antes, resultado, nombresDeLuchadores(antes, resultado.estado)), despues: resultado.estado };
}

describe('guion de una ronda', () => {
  it('los dados caen todos a la vez, cada uno con su color: dorado tú, verde tus seguidores, rojo los enemigos', () => {
    const antes = combate([{ enemigo: 'explorador' }], { seguidores: [forzudo] }, [0]);
    const { guion } = jugar(antes, e => atacar(e, dadosTrucados([4, 3, 5]))); // tú 4, Rufus 3 (acierta: 3), explorador 5 (2)

    expect(guion.dados).toEqual([
      { luchador: 'jugador', color: 'dorado', valor: 4 },
      { luchador: 'forzudo_1', color: 'verde', valor: 3 },
      { luchador: 'enemigo_1', color: 'rojo', valor: 5 },
    ]);
    expect(guion.enPausa).toBe(false);
  });

  it('un mensaje por golpe, encima de quien lo recibe, y las barras bajan golpe a golpe', () => {
    const antes = combate([{ enemigo: 'explorador' }], { seguidores: [forzudo] }, [0]);
    const { guion, despues } = jugar(antes, e => atacar(e, dadosTrucados([4, 3, 5])));

    expect(guion.vidasIniciales).toEqual({ jugador: 15, forzudo_1: 10, enemigo_1: 10 });
    expect(guion.pasos.map(p => [p.mensaje, p.luchador, p.tono])).toEqual([
      ['¡Impactas! 4 de daño', 'enemigo_1', 'bueno'],
      ['¡Rufus impacta! 3 de daño', 'enemigo_1', 'bueno'],
      ['¡Explorador impacta! 2 de daño', 'jugador', 'malo'],
    ]);
    expect(guion.pasos.map(p => p.vidas['enemigo_1'])).toEqual([6, 3, 3]);
    expect(guion.pasos.map(p => p.vidas['jugador'])).toEqual([15, 15, 13]);
    expect(guion.pasos[0].atacante).toBe('jugador');
    // Al final, las barras cuadran con la partida.
    expect(guion.pasos[guion.pasos.length - 1].vidas).toEqual({ jugador: despues.jugador.vida, forzudo_1: 10, enemigo_1: 3 });
  });

  it('fallos, muertes y el final: "¡Fallo!", "¡X falla!", "¡Jaguar cae!" y "¡VICTORIA!"', () => {
    const fallo = jugar(combate([{ enemigo: 'jaguar' }]), e => atacar(e, dadosTrucados([1, 2]))).guion;
    expect(fallo.pasos.map(p => [p.mensaje, p.luchador, p.animacion])).toEqual([
      ['¡Fallo!', 'jugador', 'falla'],
      ['¡Jaguar falla!', 'enemigo_1', 'falla'],
    ]);

    const victoria = jugar(combate([{ enemigo: 'jaguar' }]), e => atacar(e, dadosTrucados([6, 1]))).guion; // tu 6 ya basta
    expect(victoria.pasos.map(p => p.mensaje)).toEqual(['¡Impactas! 6 de daño', '¡Jaguar falla!', '¡Jaguar cae!', '¡VICTORIA!']);
    expect(victoria.pasos[2]).toMatchObject({ luchador: 'enemigo_1', animacion: 'muere', tono: 'bueno' });
  });

  it('lo que suma y resta va entre paréntesis: hambre, bonificador, piel de piedra', () => {
    const antes = combate([{ enemigo: 'golem_guardian' }], { diasSinComer: 1, condiciones: [{ id: 'maleficio_del_pirata' }] });
    const { guion } = jugar(antes, e => atacar(e, dadosTrucados([5, 1])));
    expect(guion.pasos[0].mensaje).toBe('¡Impactas! 2 de daño (−1 bonificador, −1 por hambre, −1 piel de piedra)');
  });

  it('el 6: la ronda se queda en pausa, caen TODOS los dados y sale la pregunta', () => {
    const antes = combate([{ enemigo: 'explorador' }]);
    const { guion, despues } = jugar(antes, e => atacar(e, dadosTrucados([6, 4])));

    expect(guion.enPausa).toBe(true);
    expect(guion.dados).toEqual([
      { luchador: 'jugador', color: 'dorado', valor: 6 },
      { luchador: 'enemigo_1', color: 'rojo', valor: 4 },
    ]);
    expect(guion.pasos.map(p => p.mensaje)).toEqual(['¡SEIS! ¿Volver a tirar?']);
    expect(guion.pasos[0].vidas).toEqual(guion.vidasIniciales); // todavía no se ha aplicado nada
    expect(dadosDeLaPausa(despues)).toEqual(guion.dados); // por si se recarga la página a mitad
  });

  it('tras la pausa, al volver a tirar solo cae tu dado nuevo; con un 1, "¡PIFIA!"', () => {
    const pausa = combate([{ enemigo: 'explorador' }]);
    const enPausa = atacar(pausa, dadosTrucados([6, 4])).estado;

    const pifia = jugar(enPausa, e => volverATirar(e, dadosTrucados([1]))).guion;
    expect(pifia.dados).toEqual([{ luchador: 'jugador', color: 'dorado', valor: 1 }]);
    expect(pifia.pasos.map(p => p.mensaje)).toEqual(['¡PIFIA! Has perdido tu ataque', '¡Explorador impacta! 2 de daño']);

    const bien = jugar(enPausa, e => volverATirar(e, dadosTrucados([3]))).guion;
    expect(bien.pasos[0].mensaje).toBe('¡Impactas! 9 de daño');
  });

  it('otro 6 sigue en pausa (cae solo el dado nuevo); quedarse así no tira ningún dado', () => {
    const enPausa = atacar(combate([{ enemigo: 'tiranosaurio' }]), dadosTrucados([6, 1])).estado;
    const otro = jugar(enPausa, e => volverATirar(e, dadosTrucados([6])));
    expect(otro.guion.enPausa).toBe(true);
    expect(otro.guion.dados).toEqual([{ luchador: 'jugador', color: 'dorado', valor: 6 }]);

    const quieto = jugar(otro.despues, e => quedarseConElAtaque(e, dadosTrucados([]))).guion;
    expect(quieto.dados).toEqual([]);
    expect(quieto.pasos[0].mensaje).toBe('¡Impactas! 12 de daño');
  });

  it('golpe de gracia: la barra baja a 0 con el golpe y vuelve a 1 con el mensaje', () => {
    const { guion } = jugar(combate([{ enemigo: 'jaguar' }], { vida: 3 }), e => atacar(e, dadosTrucados([6, 6])));
    const tuya = guion.pasos.map(p => [p.mensaje, p.vidas['jugador']]);
    expect(tuya).toContainEqual(['¡Jaguar impacta! 5 de daño', 0]);
    expect(tuya).toContainEqual(['¡Golpe de gracia! Ibas a caer, pero te quedas con 1 PV', 1]);
    expect(guion.pasos[guion.pasos.length - 1].vidas['jugador']).toBe(1);
  });

  it('el esqueleto que se levanta y el que no', () => {
    const vuelve = jugar(combate([{ enemigo: 'pirata_esqueleto' }]), e => atacar(e, dadosTrucados([3, 1, 1]))).guion;
    expect(vuelve.pasos.map(p => p.mensaje)).toContain('¡Pirata esqueleto se levanta otra vez!');
    expect(vuelve.pasos[vuelve.pasos.length - 1].vidas['enemigo_1']).toBe(3);

    const no = jugar(combate([{ enemigo: 'pirata_esqueleto' }]), e => atacar(e, dadosTrucados([3, 1, 4]))).guion;
    expect(no.pasos.map(p => p.mensaje)).toContain('Pirata esqueleto intenta levantarse... y no puede');
  });

  it('el chamán: "¡TE MALDICEN!" sale después de los golpes', () => {
    const { guion } = jugar(combate([{ enemigo: 'chaman' }]), e => atacar(e, dadosTrucados([2, 6])));
    expect(guion.pasos.map(p => p.mensaje)).toEqual(['¡Impactas! 2 de daño', '¡Chamán impacta! 2 de daño', '¡Chamán saca un 6: TE MALDICEN!']);
  });

  it('huir: tu dado dorado y el mensaje', () => {
    const tras = atacar(combate([{ enemigo: 'explorador' }]), dadosTrucados([2, 1])).estado;
    const mal = jugar(tras, e => huir(e, dadosTrucados([2]))).guion;
    expect(mal.dados).toEqual([{ luchador: 'jugador', color: 'dorado', valor: 2 }]);
    expect(mal.pasos.map(p => p.mensaje)).toEqual(['¡No logras huir! Tus enemigos acertarán el siguiente ataque']);

    const bien = jugar(tras, e => huir(e, dadosTrucados([5]))).guion;
    expect(bien.pasos.map(p => p.mensaje)).toEqual(['¡Huyes!', 'Os ponéis a salvo']);
  });

  it('emboscada', () => {
    const sinCombate = combate([{ enemigo: 'jaguar' }]);
    const emboscada = iniciarCombate({ ...sinCombate, mundo: { ...sinCombate.mundo, combate: null } }, [{ enemigo: 'jaguar' }], dadosTrucados([]), { sorpresa: 'suya' });
    const suya = jugar(emboscada, e => atacar(e, dadosTrucados([3]))).guion;
    expect(suya.pasos[0]).toMatchObject({ mensaje: '¡EMBOSCADA! Esta ronda solo atacan ellos', luchador: null, tono: 'malo' });
    expect(suya.dados).toEqual([{ luchador: 'enemigo_1', color: 'rojo', valor: 3 }]);
  });
});
