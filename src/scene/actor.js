// Actor: un modelo 3D que camina sobre el mapa.
//   - su posición es un punto de la imagen (a.x, a.y): world.js da el punto real del terreno y su normal
//   - mientras baja o sube (a.tun) se agarra a la raíz del túnel (colliders.tunnelPoint)
//   - se apoya en el terreno: «arriba» es la normal del suelo (en la pared o la raíz se le ve el lomo)
//     y la cabeza mira hacia donde camina, también en 3D
//   - el tamaño se pensó en píxeles: se pasa a unidades del mundo con PXW (mide lo mismo en todo el mapa)
//   - sombra suave bajo las patas
import * as THREE from 'three';
import { createCreature } from './creature.js';
import { W, N, scaleAt } from './world.js';
import { PXW } from './layout.js';
import { tunnelPoint, flatPoint } from './colliders.js';

let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c2 = cv.getContext('2d'), g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(20,8,2,0.55)'); g.addColorStop(1, 'rgba(20,8,2,0)');
  c2.fillStyle = g; c2.fillRect(0, 0, 64, 64);
  return (shadowTex = new THREE.CanvasTexture(cv));
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export function createActor(kind, size, opts = {}) {
  const c = createCreature(kind, 1);
  const orient = new THREE.Group();
  orient.add(c.g);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.scale.set(1.25 * (opts.shadow || 1), 1, 0.7 * (opts.shadow || 1)); shadow.position.y = 0.01; shadow.renderOrder = -1;
  orient.add(shadow);
  Object.assign(c, { orient, shadow, size, x: 0, y: 0, dx: 1, dy: 0, wall: 0, yawBias: opts.yaw || 0, up: null, fwd: null });
  c.root = orient; // lo que se añade a la escena
  return c;
}

/** Mira hacia (dx, dy) en píxeles de imagen. */
export function lookAt2D(a, dx, dy) { if (Math.hypot(dx, dy) > 1e-4) { a.dx = dx; a.dy = dy; } }

const P = new THREE.Vector3(), Nn = new THREE.Vector3(), Q = new THREE.Vector3(), Qn = new THREE.Vector3();
const F = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4(), q = new THREE.Quaternion();

/** Punto 3D y normal de un punto de la imagen (en la raíz si va por el túnel). Devuelve si está en la raíz. */
export function ground(x, y, out, nOut, tun) {
  if (tun && tunnelPoint(x, y, out, nOut)) return true;
  if (!flatPoint(x, y, out, nOut)) { W(x, y, out); N(x, y, nOut); }
  return false;
}

/** Sincroniza el objeto 3D con la posición y orientación 2D. */
export function placeActor(a, dt) {
  const inTunnel = ground(a.x, a.y, P, Nn, a.tun);
  const s = a.size * PXW;
  a.orient.scale.setScalar(s);
  a.orient.position.copy(P);

  // arriba: la normal del terreno, suavizada (los cambios de pared a suelo no son de golpe)
  const k = Math.min(1, dt * 10);
  if (!a.up) a.up = Nn.clone(); else a.up.lerp(Nn, k).normalize();
  // delante: el paso de 6 píxeles en la dirección en que mira, llevado al terreno
  const len = Math.hypot(a.dx, a.dy) || 1, e = 6;
  ground(a.x + a.dx / len * e, a.y + a.dy / len * e, Q, Qn, a.tun);
  F.subVectors(Q, P);
  const far = F.length() > e * scaleAt(P) * 4; // el paso cruza un borde: no sirve
  if (far || F.lengthSq() < 1e-12) F.copy(a.fwd || Z.set(1, 0, 0));
  F.addScaledVector(a.up, -F.dot(a.up));
  if (F.lengthSq() < 1e-10) F.copy(a.fwd || Z.set(1, 0, 0)).addScaledVector(a.up, -a.up.dot(a.fwd || Z));
  F.normalize();
  if (a.yawBias) F.applyAxisAngle(a.up, a.yawBias);
  if (!a.fwd) a.fwd = F.clone(); else a.fwd.lerp(F, Math.min(1, dt * 12)).normalize();

  // base: delante (+X del modelo), arriba (+Y) y el lado
  Z.crossVectors(a.fwd, a.up).normalize();
  F.crossVectors(a.up, Z).normalize();
  M.makeBasis(F, a.up, Z);
  q.setFromRotationMatrix(M);
  if (dt >= 1) a.orient.quaternion.copy(q); else a.orient.quaternion.slerp(q, Math.min(1, dt * 14));
  a.g.quaternion.identity();
  a.wall = inTunnel ? 1 : 0;
  a.shadow.material.opacity = inTunnel ? 0 : 1;
}
