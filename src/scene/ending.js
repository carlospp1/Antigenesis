// Final del juego, la parte en el diorama: la reina sale del nido (cruza la cueva, trepa por la raíz y sale
// por el agujero) mientras todas las hormigas suben a la superficie y la rodean; la cámara la sigue y al final
// se eleva sobre el diorama. Después ui/ending.js pasa al planeta.
import * as THREE from 'three';
import { ctx } from './context.js';
import { QUEEN } from './layout.js';
import { UP } from './colliders.js';
import { toImage } from './world.js';
import { queen, resetQueenPose } from './brood.js';
import { ground, placeActor, lookAt2D } from './actor.js';
import { playCinematic } from './camera.js';

/** Dónde se planta la reina al salir: en la hierba, a la derecha del agujero (mundo). */
const STAGE = [0.16, 0.211, 0.24];
const QUEEN_TIME = 6;   // segundos que tarda en salir

let path = null, t = 0;
const N = new THREE.Vector3();

export const endingActive = () => !!ctx.ending;
/** Punto de la imagen junto al que se reúnen las hormigas. */
export const gatherPoint = () => toImage(new THREE.Vector3(...STAGE));

export function startEnding() {
  if (!queen) return;
  ctx.ending = { t: 0 };
  t = 0;
  // recorrido: de su sitio al pie de la raíz, la raíz hacia arriba (UP) y la hierba hasta su sitio
  const pts = [{ x: QUEEN.x, y: QUEEN.y, tun: false }, ...UP.map((p, i) => ({ x: p.x, y: p.y, tun: i > 0 })), { ...gatherPoint(), tun: false }];
  let len = 0;
  const w = pts.map(p => { const v = new THREE.Vector3(); ground(p.x, p.y, v, N, p.tun); return v; });
  path = pts.map((p, i) => { if (i) len += w[i].distanceTo(w[i - 1]); return { ...p, d: len }; });
  path.total = len;
  queen.yawBias0 = queen.yawBias; queen.yawBias = 0;

  // cámara: sigue a la reina de cerca y, cuando sale, se eleva hasta ver todo el diorama
  const qPos = new THREE.Vector3();
  playCinematic(s => {
    qPos.copy(queen.orient.position);
    if (s < QUEEN_TIME + 0.5) {
      const near = s < 1.5 ? 0.95 : 0.7;
      return { pos: new THREE.Vector3(qPos.x + 0.12, qPos.y + 0.22, qPos.z + near), look: new THREE.Vector3(qPos.x, qPos.y + 0.06, qPos.z), fov: 32, k: 2.4 };
    }
    return { pos: new THREE.Vector3(0.05, 1.55, 1.95), look: new THREE.Vector3(0.05, 0.12, 0), fov: 36, k: 1.1 };
  });
}

export function stopEnding() {
  // aunque no haya final activo, hay que poner a la reina en su sitio (colonia nueva tras una muerte normal)
  const was = !!ctx.ending;
  ctx.ending = null; path = null;
  if (was) playCinematic(null);
  resetQueenPose();
}

/** Cada fotograma, después de colocar a la reina en su sitio de siempre (brood.js): la mueve por el recorrido. */
export function updateEnding(dt) {
  if (!ctx.ending || !path || !queen) return;
  ctx.ending.t = t += dt;
  const d = Math.min(1, t / QUEEN_TIME) * path.total;
  let i = 1;
  while (i < path.length - 1 && path[i].d < d) i++;
  const a = path[i - 1], b = path[i], k = Math.min(1, Math.max(0, (d - a.d) / Math.max(1e-6, b.d - a.d)));
  queen.x = a.x + (b.x - a.x) * k; queen.y = a.y + (b.y - a.y) * k;
  queen.tun = b.tun;
  const walking = t < QUEEN_TIME;
  if (walking) lookAt2D(queen, b.x - a.x, b.y - a.y); else lookAt2D(queen, 1, 0.2);
  queen.phase += dt * (walking ? 9 : 2);
  queen.step(walking, 0.05, dt, b.tun ? 'climb' : undefined);
  placeActor(queen, dt);
}
