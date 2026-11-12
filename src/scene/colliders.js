// Zonas por las que se camina, en píxeles de imagen, sacadas del propio mapa 3D:
// dentro de la planta de cada zona (layout.js) solo vale el terreno a su altura.
// initLayout pasa a píxeles de imagen los sitios del plano, que layout.js define en el mundo.
// El túnel es la raíz que cuelga del agujero: una línea 3D (ROOT) y su proyección en la imagen.
// También: puntos aleatorios dentro de una zona, corrección de posiciones que se salen
// y una vista de depuración (tecla C).
import * as THREE from 'three';
import { ZONES, NAV, FOOD, QUEEN, EGG_PILE, LARVA_PILE, PANTRY, GUARD, FOE_LINE, BOSS_POS, ROOT, ROOT_TOP, ROOT_FLOOR, IMG, REFUGE, SURF_BAND, HOLE_SIDES } from './layout.js';
import { ctx } from './context.js';
import { world, W, toImage } from './world.js';

/** Punto más cercano del borde de un polígono, un poco hacia dentro. */
function closestOnPoly(x, y, poly) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + dx * t, py = ay + dy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}

export function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- máscaras de las zonas (una celda cada 2 píxeles, como world.js) ---------- */
const masks = {};
/** Altura del plano por el que se camina en cada zona (la mediana del terreno de la zona). */
export const ZONE_Y = {};
const GS = 2;
function buildMasks() {
  const { gw, gh, ok, pos, nrm } = world;
  for (const k in ZONES) {
    const z = ZONES[k], m = new Uint8Array(gw * gh), ys = [];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
      const i = r * gw + c, y = pos[i * 3 + 1];
      if (ok[i] && nrm[i * 3 + 1] > 0.3 && y > z.h[0] && y < z.h[1] && inPoly(pos[i * 3], pos[i * 3 + 2], z.xz)) { m[i] = 1; ys.push(y); }
    }
    masks[k] = m;
    ys.sort((a, b) => a - b);
    ZONE_Y[k] = ys.length ? ys[ys.length >> 1] : (z.h[0] + z.h[1]) / 2;
  }
}

/** Zona que hay a menos de 24 píxeles de (x, y), o null. */
function zoneNear(x, y) {
  const c0 = Math.round(x / GS), r0 = Math.round(y / GS), { gw, gh } = world;
  for (let d = 1; d <= 12; d++) for (let dr = -d; dr <= d; dr += d) for (let dc = -d; dc <= d; dc++) {
    const c = c0 + dc, r = r0 + dr;
    if (c < 0 || r < 0 || c >= gw || r >= gh) continue;
    for (const z in masks) if (masks[z][r * gw + c]) return z;
  }
  return null;
}

const _o = new THREE.Vector3(), _r = new THREE.Vector3();
/**
 * En la superficie y en el suelo de la cueva se camina por un plano liso (las hierbas y los bultos de la malla
 * no hacen saltar a las hormigas): el rayo de la cámara de referencia por (x, y) cortado con la altura de la zona.
 * Devuelve la zona, o null si (x, y) no está en ninguna (entonces vale el terreno, W).
 */
export function flatPoint(x, y, out, nOut) {
  let k = null;
  for (const z in masks) if (inMask(z, x, y)) { k = z; break; }
  if (!k) k = zoneNear(x, y); // detrás de una hierba alta o justo en el borde: la zona de al lado
  if (!k) return null;
  const ref = world.ref;
  _o.copy(ref.position);
  _r.set(x / IMG.w * 2 - 1, 1 - y / IMG.h * 2, 0.5).unproject(ref).sub(_o).normalize();
  const t = (ZONE_Y[k] - _o.y) / _r.y;
  if (!(t > 0)) return null;
  out.copy(_o).addScaledVector(_r, t);
  // detrás de una hierba alta o en el borde, el punto del plano puede quedar fuera: al más cercano de la zona
  const xz = ZONES[k].xz;
  if (!inPoly(out.x, out.z, xz)) { const c = closestOnPoly(out.x, out.z, xz); out.x = c[0]; out.z = c[1]; }
  if (nOut) nOut.set(0, 1, 0);
  return k;
}
const inMask = (k, x, y) => {
  const c = Math.floor(x / GS), r = Math.floor(y / GS);
  return c >= 0 && r >= 0 && c < world.gw && r < world.gh && masks[k][r * world.gw + c] === 1;
};

/* ---------- túnel: la raíz ---------- */
const tunnel = { pts3: [], pts2: [], len: [], band: 26 };

/* ---------- el plano, del mundo a la imagen ---------- */
const V = a => new THREE.Vector3(...a);
const img = a => toImage(V(a));
/** Píxeles de imagen que ocupa un paso (dx, dz) del mundo alrededor de `at`. */
const spanX = (at, d) => Math.abs(img([at[0] + d, at[1], at[2]]).x - img(at).x);
const spanZ = (at, d) => img([at[0], at[1], at[2] + d]).y - img(at).y;
function place(o) { Object.assign(o, img(o.at)); return o; }
function initLayout() {
  for (const o of [QUEEN, EGG_PILE, PANTRY, LARVA_PILE, BOSS_POS]) place(o);
  for (const f of FOOD) { place(f); f.r = spanX(f.at, f.r); }
  for (const p of [EGG_PILE, LARVA_PILE]) { p.sx = spanX(p.at, p.dx); p.sy = spanZ(p.at, p.dz); }
  for (const l of [GUARD, FOE_LINE]) { place(l); l.dxPx = spanX(l.at, l.dx); l.dy = spanZ(l.at, l.dz); }
  GUARD.dx = GUARD.dxPx; FOE_LINE.dx = FOE_LINE.dxPx; FOE_LINE.spawnX = img(FOE_LINE.spawn).x;
  const a = img(REFUGE.a), b = img(REFUGE.b);
  Object.assign(REFUGE, { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
  SURF_BAND.y0 = img([0, 0.21, SURF_BAND.z[0]]).y; SURF_BAND.y1 = img([0, 0.21, SURF_BAND.z[1]]).y;
  const l = img(HOLE_SIDES.L), r = img(HOLE_SIDES.R);
  NAV.holeL = [l.x, l.y]; NAV.holeR = [r.x, r.y];
}

/** Se llama al cargar el mapa: el plano a píxeles, las zonas, la raíz y los puntos de paso. */
export function initNav() {
  initLayout();
  buildMasks();
  // la misma curva que se dibuja (world.buildRoot), en tramos cortos
  const curve = new THREE.CatmullRomCurve3(ROOT.pts.map(a => new THREE.Vector3(...a)));
  const along = curve.getSpacedPoints(24);
  const p3 = [new THREE.Vector3(...ROOT_TOP), ...along, new THREE.Vector3(...ROOT_FLOOR)];
  tunnel.pts3 = p3;
  tunnel.pts2 = p3.map(v => toImage(v));
  const q = tunnel.pts2, n = q.length;
  NAV.hole = [q[0].x, q[0].y];
  NAV.t1 = [q[Math.round(n * 0.33)].x, q[Math.round(n * 0.33)].y];
  NAV.t2 = [q[Math.round(n * 0.66)].x, q[Math.round(n * 0.66)].y];
  NAV.floorIn = [q[n - 1].x, q[n - 1].y];
  // puntos de paso: el borde, unos cuantos de la raíz (para seguir su curva) y el suelo
  DOWN.length = 0;
  for (let i = 0; i < n; i += i === 0 || i >= n - 3 ? 1 : 4) DOWN.push({ x: q[i].x, y: q[i].y });
  if (DOWN[DOWN.length - 1].y !== q[n - 1].y) DOWN.push({ x: q[n - 1].x, y: q[n - 1].y });
  UP.length = 0; UP.push(...DOWN.slice().reverse());
}

/** Punto más cercano de la raíz proyectada: índice del tramo, t y distancia en píxeles. */
function onTunnel(x, y) {
  const q = tunnel.pts2;
  let best = null;
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i], b = q[i + 1], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
    if (!best || d < best.d) best = { i, t, d };
  }
  return best;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
/**
 * Si (x, y) está en el túnel, el punto 3D sobre la raíz (por delante, hacia la cámara) y su normal.
 * Los extremos (borde del agujero y suelo) se mezclan con el terreno para que no haya saltos.
 */
export function tunnelPoint(x, y, out, nOut) {
  if (!tunnel.pts2.length) return false;
  const h = onTunnel(x, y);
  if (!h || h.d > tunnel.band) return false;
  const p = tunnel.pts3, last = p.length - 2;
  _a.copy(p[h.i]); _b.copy(p[h.i + 1]);
  out.lerpVectors(_a, _b, h.t);
  _t.subVectors(_b, _a).normalize();
  const onRoot = h.i > 0 && h.i < last; // el primer tramo va por el césped y el último por el suelo
  if (onRoot) {
    // en la cara de la raíz que mira a la cámara (la raíz se estrecha hacia abajo, como en buildRoot)
    const t = (h.i - 1 + h.t) / (last - 1);
    nOut.set(0, 0, 1).addScaledVector(_t, -_t.z).normalize();
    out.addScaledVector(nOut, ROOT.r * (1.35 - 0.6 * t));
  } else if (h.i === 0) { // del césped al borde: se va inclinando hacia la raíz
    nOut.set(0, 1, 0).lerp(_b.set(0, 0, 1), h.t * h.t).normalize();
  } else nOut.set(0, 1, 0);
  return true;
}

/** Zona en (x, y). La franja de la raíz solo cuenta para quien va por ella (`tun`): si no, junto al agujero
 * valdría cualquier punto de la hierba, también los del borde. */
export function zoneAt(x, y, tun = true) {
  if (tun && tunnel.pts2.length) { const h = onTunnel(x, y); if (h && h.d <= tunnel.band) return 'tunnel'; }
  for (const k in masks) if (inMask(k, x, y)) return k;
  return null;
}

/** Rectángulo de la imagen que ocupa una zona. */
const zoneBox = {};
function maskBox(k) {
  const { gw, gh } = world, m = masks[k];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (m[r * gw + c]) { x0 = Math.min(x0, c); x1 = Math.max(x1, c); y0 = Math.min(y0, r); y1 = Math.max(y1, r); }
  return { x0: x0 * GS, y0: y0 * GS, x1: x1 * GS + GS, y1: y1 * GS + GS };
}

/** Punto aleatorio dentro de una zona, opcionalmente limitado a un rectángulo. */
export function randomIn(zone, rect) {
  const b = zoneBox[zone] ||= maskBox(zone);
  const r = rect ? { x0: Math.max(b.x0, rect.x0 ?? b.x0), y0: Math.max(b.y0, rect.y0 ?? b.y0), x1: Math.min(b.x1, rect.x1 ?? b.x1), y1: Math.min(b.y1, rect.y1 ?? b.y1) } : b;
  for (let i = 0; i < 80; i++) {
    const x = r.x0 + Math.random() * (r.x1 - r.x0), y = r.y0 + Math.random() * (r.y1 - r.y0);
    if (inMask(zone, x, y)) return { x, y };
  }
  return clampToWalkable({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
}

/** Si (x, y) cae fuera de toda zona caminable, lo devuelve a la celda caminable más cercana. */
export function clampToWalkable(p, tun = false) {
  if (zoneAt(p.x, p.y, tun)) return p;
  const c0 = Math.round(p.x / GS), r0 = Math.round(p.y / GS), { gw, gh } = world;
  for (let d = 1; d < 120; d++) {
    let best = null, bd = Infinity;
    for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || r < 0 || c >= gw || r >= gh) continue;
      const i = r * gw + c;
      let hit = false;
      for (const k in masks) if (masks[k][i]) { hit = true; break; }
      if (hit && dr * dr + dc * dc < bd) { bd = dr * dr + dc * dc; best = [c, r]; }
    }
    if (best) { p.x = best[0] * GS + 1; p.y = best[1] * GS + 1; return p; }
  }
  return p;
}

/** Ruta entre la superficie y la cámara por la raíz (se rellena en initNav). */
export const DOWN = [];
export const UP = [];

/* ---------- depuración ---------- */
let debugGroup = null;
export function toggleDebug(force) {
  const on = force != null ? force : !(debugGroup && debugGroup.visible);
  if (!world.ok) return false; // el mapa aún no ha cargado
  if (!debugGroup) {
    debugGroup = new THREE.Group();
    const colors = { surface: '#7dff7a', chamber: '#ff7ad9' };
    const v = new THREE.Vector3();
    for (const k in masks) { // una muestra de la zona, como puntos sobre el terreno
      const pts = [];
      for (let y = 0; y < IMG.h; y += 14) for (let x = 0; x < IMG.w; x += 14) if (inMask(k, x, y)) pts.push(W(x, y, v).clone().addScalar(0).setY(v.y + 0.004));
      debugGroup.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: colors[k], size: 4, sizeAttenuation: false, depthTest: false })));
    }
    debugGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tunnel.pts3), new THREE.LineBasicMaterial({ color: '#ffd166', depthTest: false })));
    const dot = (x, y, col) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      W(x, y, m.position); debugGroup.add(m);
    };
    for (const k in NAV) dot(NAV[k][0], NAV[k][1], '#ffffff');
    for (const f of FOOD) dot(f.x, f.y, '#9cff5a');
    dot(QUEEN.x, QUEEN.y, '#ff5a5a'); dot(EGG_PILE.x, EGG_PILE.y, '#fff2c8'); dot(LARVA_PILE.x, LARVA_PILE.y, '#fff2c8'); dot(PANTRY.x, PANTRY.y, '#c8ff8a');
    dot(GUARD.x, GUARD.y, '#7ab8ff'); dot(FOE_LINE.x, FOE_LINE.y, '#ff8a3a'); dot(BOSS_POS.x, BOSS_POS.y, '#ff3a3a');
    debugGroup.traverse(o => { o.renderOrder = 999; });
    ctx.scene.add(debugGroup);
  }
  debugGroup.visible = on;
  return on;
}
