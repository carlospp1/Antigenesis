// Geometría low-poly procedimental: cría, partículas y las hormigas de respaldo
// (se usan si un modelo .glb no se puede cargar).
import * as THREE from 'three';

const V3 = THREE.Vector3, X1 = new V3(1, 0, 0);

export function ico(r, s, p, col, detail) {
  const g = new THREE.IcosahedronGeometry(r, detail == null ? 1 : detail);
  if (s) g.scale(s[0], s[1], s[2]);
  g.translate(p[0], p[1], p[2]);
  return [g, col];
}

export function seg(a, b, th, col) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.BoxGeometry(len, th, th);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(X1, d.normalize())));
  const m = A.add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return [g, col];
}

/** Funde varias piezas [geometría, color] en una sola geometría con color por vértice. */
export function merge(parts, smooth = false) {
  let n = 0; const gs = [];
  for (const [g0, c] of parts) {
    if (smooth && !g0.attributes.normal) g0.computeVertexNormals();
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!smooth) g.computeVertexNormals();
    n += g.attributes.position.count;
    gs.push([g, new THREE.Color(c)]);
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const [g, c] of gs) {
    const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Seis patas en dos trípodes (A y B) que se mueven alternos. */
export function legParts(col, th, spreadX, reach, kneeY, hipY, baseX) {
  const A = [], B = [];
  for (const xi of [1, 0, -1]) for (const s of [1, -1]) {
    const hip = [baseX + xi * 0.06, hipY, s * 0.05], knee = [baseX + xi * spreadX * 0.65, kneeY, s * reach * 0.72], foot = [baseX + xi * spreadX, 0, s * reach];
    const set = ((xi + 1) + (s > 0 ? 0 : 1)) % 2 === 0 ? A : B;
    set.push(seg(hip, knee, th, col), seg(knee, foot, th * 0.85, col));
  }
  return [merge(A), merge(B)];
}

export function antGeo(o) {
  const hs = o.headS || 1, as = o.abdS || 1, al = o.antL || 1;
  const parts = [
    ico(0.13, [1.45 * as, as, as], [-0.21 - 0.07 * (as - 1), 0.15 + 0.02 * (as - 1), 0], o.abd),
    ico(0.085, [1.35, 0.95, 0.9], [0, 0.14, 0], o.body),
    ico(0.09 * hs, null, [0.17 + 0.03 * (hs - 1), 0.16, 0], o.head),
    seg([0.22, 0.2, 0.04], [0.22 + 0.14 * al, 0.2 + 0.1 * al, 0.1], 0.018, o.body),
    seg([0.22, 0.2, -0.04], [0.22 + 0.14 * al, 0.2 + 0.1 * al, -0.1], 0.018, o.body),
    ico(0.022, null, [0.215 + 0.05 * (hs - 1), 0.195, 0.065 * hs], '#1c0f0c', 0),
    ico(0.022, null, [0.215 + 0.05 * (hs - 1), 0.195, -0.065 * hs], '#1c0f0c', 0)
  ];
  if (o.mand) parts.push(...mandibleParts(o.mand, 0.24 + 0.06 * (hs - 1), o.mandCol));
  const legs = legParts(o.legs || o.body, 0.022, 0.2, 0.23, 0.17, 0.11, 0.03);
  return { body: merge(parts), la: legs[0], lb: legs[1] };
}

export function mandibleParts(m, hx, col, y = 0) {
  return [
    seg([hx, 0.13 + y, 0.035], [hx + 0.1 * m, 0.1 + y, 0.075], 0.03 * m, col),
    seg([hx, 0.13 + y, -0.035], [hx + 0.1 * m, 0.1 + y, -0.075], 0.03 * m, col),
    seg([hx + 0.1 * m, 0.1 + y, 0.075], [hx + 0.16 * m, 0.1 + y, 0.02], 0.022 * m, col),
    seg([hx + 0.1 * m, 0.1 + y, -0.075], [hx + 0.16 * m, 0.1 + y, -0.02], 0.022 * m, col)
  ];
}

function sph(r, s, p, col) {
  const g = new THREE.SphereGeometry(r, 22, 16);
  if (s) g.scale(s[0], s[1], s[2]);
  g.translate(p[0], p[1], p[2]);
  return [g, col];
}

/** Cápsula entre dos puntos. El radio incluye las tapas. */
function limb(a, b, r, col) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 3, 8);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize())));
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return [g, col];
}

/** Patas cortas y gordas, en dos trípodes, para que se lean sobre la hierba. */
function clayLegs(col, s = 1) {
  const A = [], B = [];
  let i = 0;
  for (const hx of [0.14, 0.02, -0.08]) for (const side of [1, -1]) {
    const fwd = hx > 0.08 ? 0.1 : hx < 0 ? -0.08 : 0.01;
    const hip = [hx * s, 0.14 * s, side * 0.07 * s];
    const knee = [(hx + fwd * 0.35) * s, 0.07 * s, side * 0.15 * s];
    const foot = [(hx + fwd) * s, 0.01, side * 0.24 * s];
    const set = i % 2 === 0 ? A : B;
    set.push(limb(hip, knee, 0.038 * s, col), limb(knee, foot, 0.028 * s, col));
    i++;
  }
  return [merge(A, true), merge(B, true)];
}

/**
 * Hormiga de arcilla: esferas lisas y patas gruesas, el mismo lenguaje que el nido.
 * Los .glb de Poly Pizza son low-poly de aristas duras y no encajan con ese fondo.
 */
export function clayAnt(o = {}) {
  const body = o.body || '#6b3422', abd = o.abd || '#8d4630', head = o.head || '#a85a38', legs = o.legs || '#5a2c1c';
  const hs = o.headS || 1;
  const parts = [
    sph(0.17, [1.28, 1.08, 0.96], [-0.26, 0.22, 0], abd),
    sph(0.055, [1.15, 0.8, 0.8], [-0.05, 0.2, 0], body),
    sph(0.105, [1.4, 0.98, 0.9], [0.08, 0.2, 0], body),
    sph(0.098 * hs, [1.08, 0.98, 1], [0.27 + 0.02 * (hs - 1), 0.215, 0], head),
    sph(0.04, null, [0.33, 0.27, 0.055], '#2a1610'),
    sph(0.04, null, [0.33, 0.27, -0.055], '#2a1610'),
    limb([0.3, 0.3, 0.04], [0.44, 0.42, 0.1], 0.016, body),
    limb([0.3, 0.3, -0.04], [0.44, 0.42, -0.1], 0.016, body)
  ];
  if (o.mand) {
    const hx = 0.34 + 0.03 * (hs - 1), m = o.mand, col = o.mandCol || '#f0ddb4';
    parts.push(
      limb([hx, 0.16, 0.04], [hx + 0.12 * m, 0.13, 0.08], 0.022 * m, col),
      limb([hx, 0.16, -0.04], [hx + 0.12 * m, 0.13, -0.08], 0.022 * m, col),
      limb([hx + 0.12 * m, 0.13, 0.08], [hx + 0.2 * m, 0.12, 0.02], 0.016 * m, col),
      limb([hx + 0.12 * m, 0.13, -0.08], [hx + 0.2 * m, 0.12, -0.02], 0.016 * m, col)
    );
  }
  const [la, lb] = clayLegs(legs);
  return { body: merge(parts, true), la, lb };
}

/** La reina, misma arcilla, con el gáster grande y un tono más ámbar para leerse en la cámara. */
export function clayQueen() {
  const parts = [
    sph(0.16, [1.2, 1.05, 0.96], [-0.78, 0.24, 0], '#e2b06a'),
    sph(0.19, [1.15, 1.08, 1], [-0.5, 0.26, 0], '#c9843e'),
    sph(0.17, [1.12, 1.02, 0.98], [-0.24, 0.24, 0], '#e2b06a'),
    sph(0.07, [1.25, 0.8, 0.8], [-0.02, 0.21, 0], '#a85a30'),
    sph(0.12, [1.45, 1, 0.92], [0.16, 0.22, 0], '#b86a38'),
    sph(0.115, [1.08, 1, 1], [0.36, 0.24, 0], '#d4924e'),
    sph(0.042, null, [0.44, 0.31, 0.065], '#2a1610'),
    sph(0.042, null, [0.44, 0.31, -0.065], '#2a1610'),
    limb([0.4, 0.34, 0.05], [0.56, 0.48, 0.12], 0.018, '#a85a30'),
    limb([0.4, 0.34, -0.05], [0.56, 0.48, -0.12], 0.018, '#a85a30')
  ];
  const [la, lb] = clayLegs('#8a4a28', 1.15);
  return { body: merge(parts, true), la, lb };
}

export const GEO = {}, MAT = {};

/** Crea geometrías y materiales compartidos. Llamar una vez tras crear el renderer. */
export function buildProcedural() {
  GEO.ants = clayAnt();
  GEO.queen = clayQueen();
  GEO.termite = antGeo({ body: '#ead8a4', abd: '#f1e4bb', head: '#c98a3c', headS: 1.3, abdS: 1.2, mand: 1.1, mandCol: '#5a3416', legs: '#d9c48c' });

  // araña de respaldo
  const sp = [ico(0.42, [1.2, 1, 1.05], [-0.5, 0.52, 0], '#5b3a63'), ico(0.26, [1.1, 0.9, 1], [0.08, 0.44, 0], '#6d4a73')];
  for (const ez of [0.07, -0.07, 0.17, -0.17]) sp.push(ico(0.035, null, [0.32, 0.5 + (Math.abs(ez) < 0.1 ? 0.03 : 0), ez], '#f6efe0', 0));
  const sA = [], sB = []; let li = 0;
  for (const xi of [1.25, 0.45, -0.35, -1.15]) for (const s of [1, -1]) {
    const hip = [0.08 + xi * 0.08, 0.42, s * 0.16], knee = [0.08 + xi * 0.34, 0.98, s * 0.72], foot = [0.08 + xi * 0.55, 0, s * 1.22];
    const set = (li + (s > 0 ? 0 : 1)) % 2 === 0 ? sA : sB;
    set.push(seg(hip, knee, 0.06, '#48304f'), seg(knee, foot, 0.045, '#48304f'));
    if (s < 0) li++;
  }
  GEO.spider = { body: merge(sp), la: merge(sA), lb: merge(sB) };

  // escarabajo de respaldo
  const bt = [ico(0.6, [1.25, 0.82, 1], [-0.2, 0.56, 0], '#2f6b6b'), ico(0.36, [1.05, 0.85, 1.1], [0.56, 0.45, 0], '#285757'),
    ico(0.2, null, [0.92, 0.38, 0], '#1c3b3b'), seg([0.98, 0.46, 0], [1.28, 0.86, 0], 0.09, '#1c3b3b')];
  const bl = legParts('#173131', 0.07, 0.62, 0.92, 0.5, 0.3, 0.05);
  GEO.beetle = { body: merge(bt), la: bl[0], lb: bl[1] };

  // cría
  // cría: esferas lisas, como en la referencia
  const sph = (r, s, p, col) => { const g = new THREE.SphereGeometry(r, 24, 16); if (s) g.scale(...s); g.translate(...p); return [g, col]; };
  GEO.egg = merge([sph(0.105, [1, 1.3, 1], [0, 0.137, 0], '#fbefd6')], true);
  GEO.larva = merge([sph(0.085, [1, 0.95, 1], [0.2, 0.09, 0], '#efd2a2'), sph(0.105, null, [0.07, 0.105, 0], '#f6e6c4'), sph(0.115, null, [-0.07, 0.115, 0], '#f3dfb6'),
    sph(0.105, null, [-0.21, 0.105, 0], '#f6e6c4'), sph(0.08, null, [-0.33, 0.08, 0], '#efd8ae'),
    sph(0.016, null, [0.27, 0.11, 0.045], '#3a2212'), sph(0.016, null, [0.27, 0.11, -0.045], '#3a2212')], true);
  GEO.bit = new THREE.IcosahedronGeometry(0.075, 0);
  GEO.bar = new THREE.PlaneGeometry(1, 1);
  GEO.barFill = new THREE.PlaneGeometry(1, 1); GEO.barFill.translate(0.5, 0, 0);
  // mandíbulas de la mutación w3, para pegarlas a la cabeza de un modelo
  GEO.jaw = merge(mandibleParts(1.1, 0, '#e8d2a6', -0.06));

  MAT.v = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.carry = {
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#c88a10', emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.2 }),
    leaf: new THREE.MeshLambertMaterial({ color: '#7fc04a' }), seed: new THREE.MeshLambertMaterial({ color: '#e0c07a' }),
    berry: new THREE.MeshLambertMaterial({ color: '#d8484e' }), soil: new THREE.MeshLambertMaterial({ color: '#6b4a32' })
  };
  MAT.barBg = new THREE.MeshBasicMaterial({ color: '#1e120c', transparent: true, opacity: 0.6, depthTest: false });
  MAT.barFill = new THREE.MeshBasicMaterial({ color: '#f0b84c', depthTest: false });
  MAT.part = {
    gold: new THREE.MeshBasicMaterial({ color: '#ffd77a' }), dust: new THREE.MeshBasicMaterial({ color: '#a8835f' }),
    white: new THREE.MeshBasicMaterial({ color: '#fff7e6' }), green: new THREE.MeshBasicMaterial({ color: '#b6e27a' }),
    teal: new THREE.MeshBasicMaterial({ color: '#7fe6cf' }), red: new THREE.MeshBasicMaterial({ color: '#ff9a7a' })
  };
}

/**
 * En el teléfono: junta los vértices que caen en la misma celdilla.
 * La celdilla es 1/n del lado largo, así la forma se conserva y sobran menos triángulos.
 * Devuelve la misma geometría si casi no se gana nada.
 */
export function thin(geo) {
  const pos = geo.attributes.position;
  if (!pos || pos.count < 600) return geo;
  const box = new THREE.Box3().setFromBufferAttribute(pos), size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  if (!(span > 0)) return geo;
  const before = geo.index ? geo.index.count : pos.count;
  let best = geo, bestN = before;
  for (const div of [64, 44, 32]) {
    const cell = span / div, map = new Map(), remap = new Int32Array(pos.count), nv = [], uv = geo.attributes.uv, nuv = uv ? [] : null;
    const key = i => Math.round((pos.getX(i) - box.min.x) / cell) + ',' + Math.round((pos.getY(i) - box.min.y) / cell) + ',' + Math.round((pos.getZ(i) - box.min.z) / cell);
    for (let i = 0; i < pos.count; i++) {
      const k = key(i);
      let id = map.get(k);
      if (id === undefined) {
        id = nv.length / 3; map.set(k, id);
        nv.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (nuv) nuv.push(uv.getX(i), uv.getY(i));
      }
      remap[i] = id;
    }
    const src = geo.index ? geo.index.array : null, tri = [], n = src ? src.length : pos.count;
    for (let t = 0; t < n; t += 3) {
      const a = remap[src ? src[t] : t], b = remap[src ? src[t + 1] : t + 1], c = remap[src ? src[t + 2] : t + 2];
      if (a !== b && b !== c && c !== a) tri.push(a, b, c);
    }
    if (tri.length < 24 || tri.length >= bestN) continue;
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(nv, 3));
    if (nuv) out.setAttribute('uv', new THREE.Float32BufferAttribute(nuv, 2));
    out.setIndex(tri); out.computeVertexNormals();
    best = out; bestN = tri.length;
    if (tri.length < before * 0.55) break;
  }
  return best;
}
