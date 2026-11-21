import { BALANCEO, poseDelBalanceo, suavizar } from './balanceo';

describe('el balanceo del monigote', () => {
  it('suavizar empieza en 0, pasa por la mitad y acaba en 1', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(0.5)).toBeCloseTo(0.5);
    expect(suavizar(1)).toBe(1);
  });

  it('al empezar el paso está en el suelo, de pie y sin inclinarse', () => {
    const pose = poseDelBalanceo(0, 0);
    expect(pose.avance).toBe(0);
    expect(pose.alto).toBe(0);
    expect(pose.escalaX).toBe(1);
    expect(pose.escalaY).toBe(1);
    expect(Math.abs(pose.giro)).toBe(0);
  });

  it('en mitad del vuelo está en lo más alto, a medio camino y estirado', () => {
    const pose = poseDelBalanceo(BALANCEO.enElAire / 2, 0);
    expect(pose.alto).toBeCloseTo(BALANCEO.altura);
    expect(pose.avance).toBeCloseTo(0.5);
    expect(pose.escalaY).toBeGreaterThan(1);
    expect(pose.escalaX).toBeLessThan(1);
  });

  it('apoyado en el suelo no avanza más: se queda quieto y se aplasta', () => {
    const pose = poseDelBalanceo((BALANCEO.enElAire + 1) / 2, 0);
    expect(pose.avance).toBe(1);
    expect(pose.alto).toBe(0);
    expect(pose.escalaY).toBeCloseTo(1 - BALANCEO.estirar);
    expect(pose.escalaX).toBeCloseTo(1 + BALANCEO.estirar * 0.8);
  });

  it('se inclina a un lado en los pasos pares y al otro en los impares, como mucho la inclinación máxima', () => {
    const par = poseDelBalanceo(0.5, 0), impar = poseDelBalanceo(0.5, 1);
    expect(par.giro).toBeCloseTo(-BALANCEO.inclinacion);
    expect(impar.giro).toBeCloseTo(BALANCEO.inclinacion);
    for (let p = 0; p <= 1; p += 0.05) expect(Math.abs(poseDelBalanceo(p, 3).giro)).toBeLessThanOrEqual(BALANCEO.inclinacion + 1e-9);
  });

  it('el avance nunca va hacia atrás dentro de un paso', () => {
    let antes = 0;
    for (let p = 0; p < 1; p += 0.01) {
      const avance = poseDelBalanceo(p, 0).avance;
      expect(avance).toBeGreaterThanOrEqual(antes - 1e-9);
      antes = avance;
    }
  });
});
