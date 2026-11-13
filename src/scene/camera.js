// Cámara en perspectiva sobre el mapa 3D. Solo la mueve el jugador.
//
// La cámara está donde la de referencia (layout.REF, de frente) y enseña una ventana de la «imagen».
// En horizontal la ventana cubre la pantalla (como antes, con zoom y arrastre limitados a los bordes, así que
// nunca se ve el borde del diorama). En vertical (teléfono) se ve la parte central del ancho (PORTRAIT_W) con
// toda la altura; por encima y por debajo queda el fondo (world.buildBackdrop: follaje arriba, tierra abajo).
// Lo único automático es el temblor de los pisotones de la noche final, que vuelve solo a su sitio,
// y la secuencia del final del juego (playCinematic), que mueve la cámara mientras dura.
import * as THREE from 'three';
import { ctx } from './context.js';
import { IMG, REF } from './layout.js';
import { world, lifted, toImage, pickWorld, fitBackdrop } from './world.js';

const view = { cx: IMG.w / 2, cy: IMG.h * 0.5, zoom: 1, gcx: IMG.w / 2, gcy: IMG.h * 0.5, gzoom: 1, w: 1, h: 1 };

export function createCamera() { return new THREE.PerspectiveCamera(REF.fov, 1, 0.01, 60); }
export function fitCamera(w, h) { view.w = w; view.h = h; }

/** En vertical se ve esta fracción del ancho de la imagen (la cueva de la despensa a las larvas). */
const PORTRAIT_W = 0.56;
/** En vertical, a qué altura de la pantalla queda el centro de la imagen (entre los paneles de arriba y de abajo). */
const PORTRAIT_Y = 0.46;
const portrait = () => view.w < view.h;
/** Píxeles de pantalla por píxel de imagen. */
const scale = z => (portrait() ? view.w / (IMG.w * PORTRAIT_W) : Math.max(view.w / IMG.w, view.h / IMG.h)) * z;
function clampCenter(z, c) {
  const s = scale(z), hw = view.w / s / 2, hh = view.h / s / 2;
  c.x = hw * 2 >= IMG.w ? IMG.w / 2 : Math.max(hw, Math.min(IMG.w - hw, c.x));
  // si cabe entera de alto (vertical), queda fija con su centro en PORTRAIT_Y de la pantalla
  c.y = hh * 2 >= IMG.h ? IMG.h / 2 + (0.5 - PORTRAIT_Y) * view.h / s : Math.max(hh, Math.min(IMG.h - hh, c.y));
}

const _d = new THREE.Vector3(), _look = new THREE.Vector3(), _b = new THREE.Vector3();

/* ---------- secuencia de cámara (solo el final del juego) ---------- */
let cine = null;
const cs = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: REF.fov };
/**
 * fn(t) devuelve la pose que toca a los t segundos ({ pos: Vector3, look: Vector3, fov }) o null para acabar;
 * la cámara la sigue con suavidad. playCinematic(null) la corta y vuelve a la vista del jugador.
 */
export function playCinematic(fn) {
  const { camera } = ctx;
  if (fn && camera) {
    cs.pos.copy(camera.position);
    camera.getWorldDirection(cs.look); cs.look.multiplyScalar(2).add(camera.position);
    cs.fov = camera.fov;
  }
  cine = fn ? { fn, t: 0 } : null;
}
function cinematicStep(dt) {
  const p = cine.fn(cine.t += dt);
  if (!p) { cine = null; return false; }
  const k = 1 - Math.exp(-dt * (p.k || 2.2)), { camera } = ctx;
  cs.pos.lerp(p.pos, k); cs.look.lerp(p.look, k); cs.fov += (p.fov - cs.fov) * k;
  camera.position.copy(cs.pos); camera.up.set(0, 1, 0); camera.lookAt(cs.look);
  camera.fov = cs.fov; camera.aspect = view.w / view.h;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  fitBackdrop(camera);
  return true;
}

export function updateCamera(dt) {
  if (!world.ref) return; // el mapa aún no ha cargado
  if (cine && cinematicStep(dt)) return;
  const k = Math.min(1, dt * 8);
  const g = { x: view.gcx, y: view.gcy };
  clampCenter(view.gzoom, g); view.gcx = g.x; view.gcy = g.y;
  view.zoom += (view.gzoom - view.zoom) * k; view.cx += (view.gcx - view.cx) * k; view.cy += (view.gcy - view.cy) * k;

  // la ventana (centro y zoom) vista desde la posición de referencia: mismo ojo, otra dirección y otra apertura
  const c = { x: view.cx, y: view.cy }; clampCenter(view.zoom, c);
  const hh = view.h / scale(view.zoom), { camera } = ctx;
  camera.position.fromArray(REF.pos);
  _d.set(c.x / IMG.w * 2 - 1, 1 - c.y / IMG.h * 2, 0.5).unproject(world.ref).sub(camera.position).normalize();
  _look.copy(camera.position).add(_d);
  // temblor (pisotones): se desvanece solo
  if (ctx.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * ctx.shake * 0.02; camera.position.y += (Math.random() - 0.5) * ctx.shake * 0.02;
    ctx.shake = Math.max(0, ctx.shake - dt * 2.5);
  }
  camera.up.set(0, 1, 0);
  camera.lookAt(_look);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(REF.fov) / 2) * hh / IMG.h));
  camera.aspect = view.w / view.h;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  fitBackdrop(camera);
}

export const zoomBy = f => { view.gzoom = Math.max(1, Math.min(2.6, view.gzoom / f)); };
export const panBy = (dx, dy) => { const s = scale(view.zoom); view.gcx -= dx / s; view.gcy -= dy / s; };
export const resetView = () => { view.gzoom = 1; view.gcx = IMG.w / 2; view.gcy = IMG.h * 0.5; };
/** Centra la vista en un punto de la imagen (útil en móvil). */
export const focus = (x, y) => { view.gcx = x; view.gcy = y; };

/* ---------- pantalla ↔ imagen ---------- */
const _p = new THREE.Vector3();
/** Pantalla → imagen. Desde la posición de referencia basta la dirección; si no, se busca el terreno bajo el dedo. */
export function screenToImage(px, py) {
  const { camera } = ctx;
  _p.set(px / view.w * 2 - 1, 1 - py / view.h * 2, 0.5).unproject(camera);
  if (camera.position.distanceToSquared(world.ref.position) > 1e-6) {
    const hit = pickWorld(camera, px, py, view.w, view.h, _b);
    if (hit) return toImage(hit);
  }
  return toImage(_p);
}
/** Imagen → pantalla (con `up` píxeles de imagen por encima del terreno). */
export function imageToScreen(x, y, up = 0) {
  lifted(x, y, up, _p).project(ctx.camera);
  const behind = _p.z > 1;
  return { x: (_p.x + 1) / 2 * view.w, y: (1 - _p.y) / 2 * view.h, behind };
}
