// El mapa 3D (public/models/mapa-opt.glb) y el puente entre la imagen y el mundo.
//
// El juego sigue pensando en PÍXELES DE IMAGEN (layout.js): zonas, rutas, toques. La «imagen» es ahora
// lo que ve una cámara de referencia (REF) fija delante del diorama. Al cargar, se pinta el mapa desde
// esa cámara con un material que guarda la posición y la normal del mundo en cada píxel; así cada punto
// (x, y) de la imagen tiene su punto 3D real sobre el terreno (W) y su normal (N).
// Con eso las hormigas pisan el suelo de verdad y la cámara de juego puede moverse libremente
// (cámara del director, ver director.js): lo que se dibuja es 3D de verdad.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ctx, mobile } from './context.js';
import { IMG, REF, MAP, PXW } from './layout.js';

const BASE = import.meta.env.BASE_URL;
const GS = 2; // un dato cada 2 píxeles de imagen

/** Reintenta una descarga (en el móvil, con mala conexión, a veces falla a la primera). */
async function retry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries) throw e; await new Promise(r => setTimeout(r, 600 * i)); }
  }
}

export const world = { map: null, ref: null, gw: 0, gh: 0, pos: null, nrm: null, ok: null, materials: [] };

/* ---------- materiales que guardan posición y normal ---------- */
const posMat = new THREE.ShaderMaterial({
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'varying vec3 vW; void main(){ gl_FragColor = vec4(vW, 1.0); }',
  side: THREE.DoubleSide
});
const nrmMat = new THREE.ShaderMaterial({
  vertexShader: 'varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vN; void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n, 1.0); }',
  side: THREE.DoubleSide
});

export async function loadWorld(onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await retry(() => loader.loadAsync(BASE + MAP.url, e => onProgress && e.total && onProgress(e.loaded / e.total)));
  const map = gltf.scene;
  map.traverse(o => {
    if (!o.isMesh) return;
    // material Lambert: misma textura y relieve que el PBR del archivo, pero mucho más barato
    // (el mapa ocupa toda la pantalla, así que es lo que más pesa al dibujar)
    const s = o.material, m = new THREE.MeshLambertMaterial({ map: s.map, normalMap: s.normalMap, color: s.color, side: s.side });
    if (s.normalMap) m.normalScale.copy(s.normalScale);
    s.dispose(); o.material = m;
    m.userData.base = m.color.clone(); world.materials.push(m);
  });
  world.map = map;

  const ref = (world.ref = new THREE.PerspectiveCamera(REF.fov, IMG.w / IMG.h, 0.01, 50));
  ref.position.fromArray(REF.pos); ref.lookAt(...REF.target);
  ref.updateMatrixWorld(true); ref.updateProjectionMatrix();

  bake();
  ctx.scene.add(map);
  freezeMap(); // por defecto: foto fija (PC y móvil). El GLB sigue cargado por si se quiere el nido 3D en vivo
  return map;
}

/**
 * El nido no se redibuja: se fotografía una vez. En vertical se abre más que la cámara de
 * referencia, porque la pantalla mira por encima y por los lados de esa foto.
 * El plano son las cuatro esquinas de ESA foto. Se dibuja opaco y detrás de todo, así las
 * hormigas quedan encima. Donde el mapa no llega, el píxel se descarta.
 * El modelo 3D se oculta pero sigue en memoria (pisadas, clics, y setLiveMap(true) lo vuelve a mostrar).
 */
function freezeMap() {
  if (world.photo) return; // ya hecha
  const { renderer } = ctx;
  const cap = world.ref.clone();
  // móvil en vertical necesita mucho FOV; en PC con el mapa aún ancho basta un poco más
  cap.fov = REF.fov * (mobile() ? 2.5 : 1.4);
  cap.updateProjectionMatrix(); cap.updateMatrixWorld(true);
  const w = 2048, h = Math.round(w * IMG.h / IMG.w);
  const rt = new THREE.WebGLRenderTarget(w, h);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(ctx.scene, cap);
  renderer.setRenderTarget(null); renderer.setClearColor('#2a160c', 1);

  const corner = (x, y) => new THREE.Vector3(x, y, 0.5).unproject(cap);
  const bl = corner(-1, -1), br = corner(1, -1), tr = corner(1, 1), tl = corner(-1, 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([bl.x, bl.y, bl.z, br.x, br.y, br.z, tr.x, tr.y, tr.z, tl.x, tl.y, tl.z], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  // alphaTest y no transparent: entra en el pase opaco, antes que las hormigas, y no las tapa
  const mat = new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.5, depthTest: false, depthWrite: false, toneMapped: false });
  mat.userData.base = mat.color.clone(); world.materials.push(mat);
  const plane = new THREE.Mesh(geo, mat);
  plane.renderOrder = -5; plane.frustumCulled = false;
  ctx.scene.add(plane);
  world.map.visible = false; // el modelo sigue en memoria: hace falta para saber dónde pisan y dónde se toca
  world.photo = plane;
  world.liveMap = false;
}

/** true = nido 3D en vivo cada fotograma; false = la foto fija (por defecto). El GLB no se descarga otra vez. */
export function setLiveMap(on) {
  if (!world.map) return false;
  if (on) {
    if (!world.photo) freezeMap();
    world.map.visible = true;
    if (world.photo) world.photo.visible = false;
    world.liveMap = true;
  } else {
    if (!world.photo) freezeMap();
    world.map.visible = false;
    if (world.photo) world.photo.visible = true;
    world.liveMap = false;
  }
  return world.liveMap;
}
export const isLiveMap = () => !!world.liveMap;

/** Pinta el mapa desde la cámara de referencia y guarda posición y normal por píxel. */
function bake() {
  const { renderer } = ctx, gw = (world.gw = Math.ceil(IMG.w / GS)), gh = (world.gh = Math.ceil(IMG.h / GS));
  const float = renderer.extensions.has('EXT_color_buffer_float');
  const rt = new THREE.WebGLRenderTarget(gw, gh, { type: float ? THREE.FloatType : THREE.HalfFloatType, depthBuffer: true });
  const s = new THREE.Scene(); s.add(world.map);
  const read = mat => {
    s.overrideMaterial = mat;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s, world.ref);
    const buf = float ? new Float32Array(gw * gh * 4) : new Uint16Array(gw * gh * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, gw, gh, buf);
    return float ? buf : Float32Array.from(buf, THREE.DataUtils.fromHalfFloat);
  };
  const P = read(posMat), Nn = read(nrmMat);
  renderer.setRenderTarget(null); renderer.setClearColor('#2a160c', 1);
  s.overrideMaterial = null; s.remove(world.map);
  rt.dispose();
  // fila 0 de readPixels = abajo de la imagen: se da la vuelta para indexar como la imagen
  world.pos = new Float32Array(gw * gh * 3); world.nrm = new Float32Array(gw * gh * 3); world.ok = new Uint8Array(gw * gh);
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
    const src = ((gh - 1 - r) * gw + c) * 4, dst = r * gw + c;
    world.ok[dst] = P[src + 3] > 0.5 ? 1 : 0;
    for (let k = 0; k < 3; k++) { world.pos[dst * 3 + k] = P[src + k]; world.nrm[dst * 3 + k] = Nn[src + k]; }
  }
}

/* ---------- imagen → mundo ---------- */
const cellOf = (x, y) => [Math.max(0, Math.min(world.gw - 1, x / GS)), Math.max(0, Math.min(world.gh - 1, y / GS))];

/** Celda válida más cercana (para puntos que caen en el vacío o fuera de la imagen). */
function nearestOk(c, r) {
  const { gw, gh, ok } = world;
  for (let d = 0; d < 80; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
    if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
    const cc = c + dc, rr = r + dr;
    if (cc >= 0 && rr >= 0 && cc < gw && rr < gh && ok[rr * gw + cc]) return rr * gw + cc;
  }
  return 0;
}

/** Interpola un campo (pos o nrm) entre las 4 celdas vecinas, sin mezclar celdas de profundidades distintas. */
function sample(field, x, y, out) {
  const { gw, gh, ok, pos } = world;
  const [fx, fy] = cellOf(x, y), c0 = Math.floor(fx), r0 = Math.floor(fy), tx = fx - c0, ty = fy - r0;
  const ids = [r0 * gw + c0, r0 * gw + Math.min(gw - 1, c0 + 1), Math.min(gh - 1, r0 + 1) * gw + c0, Math.min(gh - 1, r0 + 1) * gw + Math.min(gw - 1, c0 + 1)];
  const ws = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  // la celda de referencia: la más pesada que sea válida
  let best = -1;
  for (let i = 0; i < 4; i++) if (ok[ids[i]] && (best < 0 || ws[i] > ws[best])) best = i;
  if (best < 0) { const id = nearestOk(Math.round(fx), Math.round(fy)); return out.fromArray(field, id * 3); }
  const b = ids[best], bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
  const lim = 0.02 * 0.02; // celdas a más de 2 cm de la de referencia son de otra superficie
  let sw = 0; out.set(0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const id = ids[i];
    if (!ok[id]) continue;
    const dx = pos[id * 3] - bx, dy = pos[id * 3 + 1] - by, dz = pos[id * 3 + 2] - bz;
    if (dx * dx + dy * dy + dz * dz > lim) continue;
    out.x += field[id * 3] * ws[i]; out.y += field[id * 3 + 1] * ws[i]; out.z += field[id * 3 + 2] * ws[i]; sw += ws[i];
  }
  return out.multiplyScalar(1 / sw);
}

/** Punto del terreno que se ve en el píxel (x, y) de la imagen. */
export const W = (x, y, out = new THREE.Vector3()) => sample(world.pos, x, y, out);
/** Normal del terreno en el píxel (x, y). */
export const N = (x, y, out = new THREE.Vector3()) => sample(world.nrm, x, y, out).normalize();

const _v = new THREE.Vector3();
/** Unidades del mundo que mide un píxel de imagen a la distancia de `v` (para conservar los tamaños pensados en píxeles). */
export const scaleAt = v => v.distanceTo(world.ref.position) * 2 * Math.tan(THREE.MathUtils.degToRad(REF.fov) / 2) / IMG.h;
/** Lo mismo para el punto del terreno en el píxel (x, y). */
export const S = (x, y) => scaleAt(W(x, y, _v));
/** Punto del terreno en (x, y) levantado `up` «píxeles» (× PXW, como los tamaños) para etiquetas y efectos encima de algo. */
export function lifted(x, y, up = 0, out = new THREE.Vector3()) {
  W(x, y, out);
  out.y += up * PXW;
  return out;
}

/** La raíz por la que bajan al nido: un tubo marrón que cuelga del agujero. */
export function buildRoot(def) {
  const mat = new THREE.MeshStandardMaterial({ color: '#7e5232', roughness: 0.95 });
  mat.userData.base = mat.color.clone(); world.materials.push(mat);
  const group = new THREE.Group();
  /** Un tubo que se estrecha (r0 → r1) con el grosor algo irregular, como una raíz. */
  const tube = (pts, r0, r1, seed) => {
    const curve = new THREE.CatmullRomCurve3(pts), segs = 56, rad = 10;
    const geo = new THREE.TubeGeometry(curve, segs, 1, rad, false);
    const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / (rad + 1)), t = seg / segs, a = (i % (rad + 1)) / rad * Math.PI * 2;
      curve.getPointAt(Math.min(1, t), c);
      const bump = 1 + 0.18 * Math.sin(t * 23 + seed) * Math.sin(a * 3 + t * 9 + seed) + 0.1 * Math.sin(t * 61 + seed * 2);
      v.fromBufferAttribute(p, i).sub(c).multiplyScalar((r0 + (r1 - r0) * t) * bump).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    group.add(m);
    return curve;
  };
  const main = tube(def.pts.map(p => new THREE.Vector3(...p)), def.r * 1.35, def.r * 0.75, 1.3);
  // raicillas que salen de la principal hacia los lados
  for (const [t, dx, dz, len, s] of [[0.22, -1, 0.3, 0.12, 2.1], [0.45, 1, 0.5, 0.1, 3.7], [0.68, -1, 0.2, 0.09, 5.2], [0.83, 1, -0.2, 0.07, 6.6]]) {
    const a = main.getPointAt(t), b = a.clone().add(new THREE.Vector3(dx * len * 0.6, -len * 0.5, dz * len * 0.4));
    const c = b.clone().add(new THREE.Vector3(dx * len * 0.5, -len * 0.7, dz * len * 0.2));
    tube([a, b, c], def.r * 0.45, def.r * 0.08, s);
  }
  ctx.scene.add(group);
  return group;
}

/** Mundo → píxel de la imagen de referencia. */
export function toImage(v, out = {}) {
  _v.copy(v).project(world.ref);
  out.x = (_v.x + 1) / 2 * IMG.w; out.y = (1 - _v.y) / 2 * IMG.h;
  return out;
}

/* ---------- pantalla → mundo con cualquier cámara: se pinta 1 píxel con el material de posición ---------- */
let pickRT = null;
const pickScene = new THREE.Scene();
export function pickWorld(camera, px, py, w, h, out = new THREE.Vector3()) {
  const { renderer } = ctx;
  const float = renderer.extensions.has('EXT_color_buffer_float');
  pickRT ||= new THREE.WebGLRenderTarget(1, 1, { type: float ? THREE.FloatType : THREE.HalfFloatType });
  const cam = camera.clone();
  cam.setViewOffset(w, h, Math.floor(px), Math.floor(py), 1, 1);
  cam.updateProjectionMatrix();
  const parent = world.map.parent, hidden = !world.map.visible;
  if (hidden) world.map.visible = true;
  pickScene.add(world.map); pickScene.overrideMaterial = posMat;
  renderer.setRenderTarget(pickRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(pickScene, cam);
  const buf = float ? new Float32Array(4) : new Uint16Array(4);
  renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, buf);
  renderer.setRenderTarget(null); renderer.setClearColor('#2a160c', 1);
  pickScene.overrideMaterial = null; parent.add(world.map);
  if (hidden) world.map.visible = false;
  const v = float ? buf : Array.from(buf, THREE.DataUtils.fromHalfFloat);
  if (v[3] < 0.5) return null;
  return out.set(v[0], v[1], v[2]);
}

/**
 * Fondo: la parte de arriba de la ilustración (cielo y follaje), desenfocada, en un plano pegado a la cámara
 * y muy lejos, de modo que detrás del diorama nunca se ve el vacío. Se tiñe de noche como el mapa.
 */
export async function buildBackdrop(camera) {
  const im = await retry(() => new THREE.ImageLoader().loadAsync(BASE + MAP.backdrop));
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  g.filter = 'blur(9px) saturate(1.1)';
  // solo la franja del follaje (sin la tierra de la ilustración); se estira un poco para tapar los bordes del desenfoque
  g.drawImage(im, 0, 0, im.width, im.height * 0.26, -30, -30, cv.width + 60, cv.height + 60);
  // abajo, tierra oscura: en el teléfono en vertical se ve por debajo del diorama y así no parece que flota
  g.filter = 'none';
  const earth = g.createLinearGradient(0, cv.height * 0.5, 0, cv.height * 0.72);
  earth.addColorStop(0, 'rgba(43,22,12,0)'); earth.addColorStop(1, 'rgba(43,22,12,1)');
  g.fillStyle = earth; g.fillRect(0, cv.height * 0.5, cv.width, cv.height * 0.5);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, toneMapped: false, fog: false });
  mat.userData.base = mat.color.clone(); world.materials.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  m.position.z = -40;
  camera.add(m);
  if (!camera.parent) ctx.scene.add(camera);
  world.backdrop = m;
  return m;
}
/** Ajusta el fondo para que cubra toda la pantalla con la apertura actual de la cámara. */
export function fitBackdrop(camera) {
  const m = world.backdrop;
  if (!m) return;
  const h = 2 * 40 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.04;
  m.scale.set(h * camera.aspect, h, 1);
}
