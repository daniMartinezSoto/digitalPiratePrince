import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// EL BARCO 3D (el mismo modelo low poly del HTML de referencia, en public/barco/).
// Se dibuja con three.js en una capa transparente encima del mapa, con cámara ortográfica en
// píxeles de pantalla. El modelo va inclinado hacia la cámara (vista en tres cuartos) y gira
// según el rumbo. Modelo: "Low-Poly Pirate Ship" de JamesWhite (OpenGameArt, CC0).

const TILT = 0.95; // inclinación hacia la cámara (radianes): se ve la cubierta y los mástiles

export interface Barco3D {
  /** true cuando el modelo ya ha cargado (antes, el mapa dibuja el barco a tinta). */
  listo(): boolean;
  redimensionar(ancho: number, alto: number, dpr: number): void;
  /** x, y en píxeles CSS; pxU = píxeles CSS por unidad de mundo; rumbo en radianes. */
  dibujar(x: number, y: number, pxU: number, rumbo: number, tiempo: number, sinMovimiento: boolean): void;
  /** Borra el barco 3D (cuando se usa el barco 2D). */
  limpiar(): void;
  destruir(): void;
}

export function crearBarco3D(lienzo: HTMLCanvasElement, rutaModelo: string, rutaTextura: string): Barco3D {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x6b5a40, 0.95));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.75);
  sun.position.set(-0.6, 1, 0.9);
  scene.add(sun);
  const pivot = new THREE.Group(), tilt = new THREE.Group(), yaw = new THREE.Group(), bob = new THREE.Group();
  tilt.rotation.x = TILT;
  pivot.add(tilt);
  tilt.add(yaw);
  yaw.add(bob);
  scene.add(pivot);

  let ok = false;
  const tex = new THREE.TextureLoader().load(rutaTextura);
  tex.flipY = false;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  new GLTFLoader().load(
    rutaModelo,
    gltf => {
      gltf.scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
      });
      gltf.scene.position.z = -0.37; // centra el casco (la proa apunta a +Z)
      bob.add(gltf.scene);
      ok = true;
    },
    undefined,
    error => console.warn('No se pudo cargar el barco 3D', error),
  );

  return {
    listo: () => ok,
    redimensionar(ancho, alto, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(ancho, alto, false);
      Object.assign(cam, { left: 0, right: ancho, top: 0, bottom: -alto });
      cam.updateProjectionMatrix();
    },
    dibujar(x, y, pxU, rumbo, tiempo, sinMovimiento) {
      pivot.position.set(x, -y, 0);
      pivot.scale.setScalar(pxU * 0.36 * 1.25);
      yaw.rotation.y = rumbo;
      bob.rotation.z = sinMovimiento ? 0 : Math.sin(tiempo * 1.7) * 0.05;
      bob.rotation.x = sinMovimiento ? 0 : Math.sin(tiempo * 1.3) * 0.04;
      renderer.render(scene, cam);
    },
    limpiar() {
      renderer.clear();
    },
    destruir() {
      material.dispose();
      tex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
