// Patas animables para mallas de una sola pieza (hormiga-base.glb, reina-base.glb).
//
// Estos modelos son una superficie soldada: las patas no se pueden separar en piezas como en los
// .glb anteriores. En su lugar, cada vértice recibe a qué pata pertenece y cuánto le afecta la
// cadera y la rodilla, y el shader de vértices gira esa parte de la malla (un «skinning» de 6 huesos
// calculado al cargar):
//   1. pies: los vértices más bajos, agrupados en 6 manchas sobre el suelo;
//   2. distancia geodésica (por la superficie) desde los pies, Dijkstra con todas las fuentes a la vez;
//      cada vértice se queda con la pata del pie más cercano;
//   3. la cadera está a `hip` de distancia del pie (medida sobre la superficie); de ahí hacia el cuerpo
//      el peso cae a 0, así que el cuerpo no se mueve y la unión se estira suavemente;
//   4. la rodilla es el punto más alto de la pata (o su mitad si la pata baja siempre).
// Coordenadas del archivo: Y arriba, cabeza hacia +Z, lados en ±X.
import * as THREE from 'three';

/**
 * Calcula el esqueleto de patas de `geo` y le añade el atributo `legInfo` (pata, peso de cadera, peso de rodilla).
 * opt.hip: distancia del pie a la cadera, en fracción de la altura del modelo (un número o [delanteras, resto]).
 * opt.foot: banda del suelo que cuenta como pie (fracción de la altura); si no salen seis, se prueban otras.
 * opt.raise: si faltan pies, también valen los mínimos locales por debajo de esta fracción (una pata en el aire).
 * Devuelve [{ side, row, hip, knee }] (puntos en coordenadas de la malla) o null si no encuentra 6 pies.
 */
export function skinLegs(geo, opt = {}) {
  // (con getX/Y/Z: los .glb optimizados guardan los vértices intercalados con normales y UV)
  const PA = geo.attributes.position, n = PA.count, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = PA.getX(i); pos[i * 3 + 1] = PA.getY(i); pos[i * 3 + 2] = PA.getZ(i); }
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);

  // vértices duplicados en las costuras de UV: se sueldan para recorrer la superficie
  const rep = new Int32Array(n), seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos[3 * i] * 1e4) + ',' + Math.round(pos[3 * i + 1] * 1e4) + ',' + Math.round(pos[3 * i + 2] * 1e4);
    const r = seen.get(k);
    if (r === undefined) { seen.set(k, i); rep[i] = i; } else rep[i] = r;
  }
  // vecinos (CSR)
  const deg = new Int32Array(n + 1);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = rep[idx[t + e]], b = rep[idx[t + (e + 1) % 3]];
    if (a !== b) { deg[a + 1]++; deg[b + 1]++; }
  }
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const adj = new Int32Array(deg[n]), fill = deg.slice(0, n);
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = rep[idx[t + e]], b = rep[idx[t + (e + 1) % 3]];
    if (a !== b) { adj[fill[a]++] = b; adj[fill[b]++] = a; }
  }

  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { const y = pos[3 * i + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const H = maxY - minY;

  /** Pies con la banda del suelo `frac` (fracción de la altura). */
  const detect = frac => {
    const footY = minY + H * frac;

    // pies: celdas de 0,1 en el suelo unidas con sus vecinas
    const cells = new Map();
    for (let i = 0; i < n; i++) {
      if (rep[i] !== i || pos[3 * i + 1] >= footY) continue;
      const k = Math.round(pos[3 * i] * 10) + ',' + Math.round(pos[3 * i + 2] * 10);
      let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(i);
    }
    const label = new Map(), feet = [];
    for (const k of cells.keys()) {
      if (label.has(k)) continue;
      const id = feet.length, stack = [k], verts = [];
      label.set(k, id);
      while (stack.length) {
        const c = stack.pop(); verts.push(...cells.get(c));
        const [x, z] = c.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const q = (x + dx) + ',' + (z + dz);
          if (cells.has(q) && !label.has(q)) { label.set(q, id); stack.push(q); }
        }
      }
      feet.push(verts);
    }
    // una pata puede ir levantada en el diseño: su punta no toca la banda del suelo
    if (feet.length < 6 && opt.raise) {
      const raiseY = minY + H * opt.raise, gap2 = 0.22 * 0.22;
      const mins = [];
      for (let i = 0; i < n; i++) {
        if (rep[i] !== i || pos[3 * i + 1] >= raiseY) continue;
        let low = true;
        for (let e = deg[i]; e < deg[i + 1]; e++) if (pos[3 * adj[e] + 1] < pos[3 * i + 1] - 1e-4) { low = false; break; }
        if (low) mins.push(i);
      }
      const used = new Uint8Array(mins.length), clusters = [];
      for (let a = 0; a < mins.length; a++) {
        if (used[a]) continue;
        const g = [mins[a]]; used[a] = 1;
        for (let b = a + 1; b < mins.length; b++) {
          if (used[b]) continue;
          const dx = pos[3 * mins[a]] - pos[3 * mins[b]], dy = pos[3 * mins[a] + 1] - pos[3 * mins[b] + 1], dz = pos[3 * mins[a] + 2] - pos[3 * mins[b] + 2];
          if (dx * dx + dy * dy + dz * dz < 0.12 * 0.12) { used[b] = 1; g.push(mins[b]); }
        }
        clusters.push(g);
      }
      const center = f => { let x = 0, z = 0; for (const i of f) { x += pos[3 * i]; z += pos[3 * i + 2]; } return { x: x / f.length, z: z / f.length }; };
      const have = feet.map(center);
      clusters.sort((a, b) => pos[3 * a[0] + 1] - pos[3 * b[0] + 1]);
      for (const g of clusters) {
        if (feet.length >= 6) break;
        let x = 0, z = 0; for (const i of g) { x += pos[3 * i]; z += pos[3 * i + 2]; }
        x /= g.length; z /= g.length;
        if (Math.abs(x) < 0.15) continue; // el vientre, no una pata
        if (have.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < gap2)) continue;
        feet.push(g); have.push({ x, z });
      }
    }
    // más de seis contactos: adornos o el abdomen. Se empareja izquierda con derecha y se quedan las tres parejas más separadas del cuerpo.
    if (feet.length > 6) {
      const ctr = f => { let x = 0, z = 0; for (const i of f) { x += pos[3 * i]; z += pos[3 * i + 2]; } return { x: x / f.length, z: z / f.length }; };
      const list = feet.map(f => ({ f, p: ctr(f) })).filter(o => Math.abs(o.p.x) >= 0.12);
      const used = new Set(), pairs = [];
      for (;;) {
        let bi = -1, bj = -1, best = Infinity;
        for (let i = 0; i < list.length; i++) if (!used.has(i)) for (let j = i + 1; j < list.length; j++) if (!used.has(j) && Math.sign(list[j].p.x) !== Math.sign(list[i].p.x)) {
          const dx = Math.abs(Math.abs(list[j].p.x) - Math.abs(list[i].p.x)), dz = list[j].p.z - list[i].p.z, s = dx * dx + dz * dz;
          if (s < best) { best = s; bi = i; bj = j; }
        }
        if (bi < 0 || best > 0.08) break;
        used.add(bi); used.add(bj);
        pairs.push({ bi, bj, x: (Math.abs(list[bi].p.x) + Math.abs(list[bj].p.x)) / 2 });
      }
      if (pairs.length >= 3) {
        pairs.sort((a, b) => b.x - a.x);
        feet.length = 0;
        for (const p of pairs) { if (feet.length >= 6) break; feet.push(list[p.bi].f, list[p.bj].f); }
      }
    }
    return feet;
  };
  // cada modelo apoya distinto (pezuñas, garras, pinzas en el suelo…): se prueban bandas hasta dar con
  // seis pies, tres a cada lado; opt.foot es la primera que se prueba
  let feet = null;
  for (const frac of [opt.foot ?? 0.03, 0.03, 0.05, 0.07, 0.09, 0.12, 0.15]) {
    const f = detect(frac);
    const left = f.filter(v => { let x = 0; for (const i of v) x += pos[3 * i]; return x < 0; }).length;
    if (f.length === 6 && left === 3) { feet = f; break; }
  }
  if (!feet) { console.warn('[antigenesis] patas: no se encontraron seis pies'); return null; }

  // filas y lados: por la posición del pie (delante = +Z)
  const legs = feet.map(f => {
    let x = 0, z = 0; for (const i of f) { x += pos[3 * i]; z += pos[3 * i + 2]; }
    return { side: x < 0 ? -1 : 1, z: z / f.length };
  });
  for (const s of [-1, 1]) legs.filter(l => l.side === s).sort((a, b) => b.z - a.z).forEach((l, r) => { l.row = r; });

  // Dijkstra desde los seis pies a la vez (montículo binario con arrays tipados)
  const hipOf = l => (Array.isArray(opt.hip) ? (l.row === 0 ? opt.hip[0] : opt.hip[1]) : opt.hip ?? 0.4) * H;
  const maxHip = Math.max(...legs.map(hipOf)), maxD = maxHip * 1.3;
  const dist = new Float64Array(n).fill(Infinity), leg = new Int8Array(n).fill(-1);
  let hd = new Float64Array(1 << 16), hv = new Int32Array(1 << 16), hn = 0;
  const push = (d, v) => {
    if (hn === hd.length) { const d2 = new Float64Array(hn * 2); d2.set(hd); hd = d2; const v2 = new Int32Array(hn * 2); v2.set(hv); hv = v2; }
    let c = hn++;
    while (c > 0) { const p = (c - 1) >> 1; if (hd[p] <= d) break; hd[c] = hd[p]; hv[c] = hv[p]; c = p; }
    hd[c] = d; hv[c] = v;
  };
  feet.forEach((f, l) => { for (const i of f) { dist[i] = 0; leg[i] = l; push(0, i); } });
  while (hn) {
    const d = hd[0], i = hv[0], ld = hd[--hn], lv = hv[hn];
    let c = 0;
    for (;;) {
      const a = 2 * c + 1; if (a >= hn) break;
      const m = a + 1 < hn && hd[a + 1] < hd[a] ? a + 1 : a;
      if (hd[m] >= ld) break;
      hd[c] = hd[m]; hv[c] = hv[m]; c = m;
    }
    hd[c] = ld; hv[c] = lv;
    if (d > dist[i] || d > maxD) continue;
    for (let e = deg[i]; e < deg[i + 1]; e++) {
      const j = adj[e], dx = pos[3 * i] - pos[3 * j], dy = pos[3 * i + 1] - pos[3 * j + 1], dz = pos[3 * i + 2] - pos[3 * j + 2];
      const nd = d + Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (nd < dist[j]) { dist[j] = nd; leg[j] = leg[i]; push(nd, j); }
    }
  }

  // cadera y rodilla: centro de los vértices de la pata a esa distancia del pie
  const ring = (l, d0, d1) => {
    const c = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < n; i++) if (rep[i] === i && leg[i] === l && dist[i] >= d0 && dist[i] < d1) { c.x += pos[3 * i]; c.y += pos[3 * i + 1]; c.z += pos[3 * i + 2]; k++; }
    return k ? c.divideScalar(k) : null;
  };
  legs.forEach((L, l) => {
    const hip = hipOf(L), band = H * 0.02;
    L.hipD = hip;
    L.hip = ring(l, hip - band, hip + band) || ring(l, 0, hip);
    // rodilla: el punto más alto del camino del pie a la cadera
    let best = null;
    for (let s = 0.3; s <= 0.85; s += 0.05) {
      const c = ring(l, hip * s - band, hip * s + band);
      if (c && (!best || c.y > best.c.y + H * 0.01)) best = { c, s };
    }
    L.kneeS = best && best.s < 0.8 ? best.s : 0.5;
    L.knee = ring(l, hip * L.kneeS - band, hip * L.kneeS + band) || L.hip.clone();
  });

  // pesos: cadera 1 en la pata y 0 dentro del cuerpo; rodilla 1 por debajo de la rodilla
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const info = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rep[i], l = leg[r], d = dist[r];
    if (l < 0 || !(d < maxD)) { info[3 * i] = -1; continue; }
    const L = legs[l];
    const w = 1 - ss(L.hipD * 0.8, L.hipD * 1.25, d);
    if (w <= 0) { info[3 * i] = -1; continue; }
    info[3 * i] = l;
    info[3 * i + 1] = w;
    info[3 * i + 2] = 1 - ss(L.hipD * (L.kneeS - 0.06), L.hipD * (L.kneeS + 0.08), d);
  }
  geo.setAttribute('legInfo', new THREE.BufferAttribute(info, 3));
  return legs.map(({ side, row, hip, knee }) => ({ side, row, hip, knee }));
}

const SHADER_HEAD = /* glsl */`
attribute vec3 legInfo;
uniform vec3 uLegHip[6];
uniform vec3 uLegKnee[6];
uniform vec3 uLegHipR[6];
uniform vec3 uLegKneeR[6];
mat3 legEuler(vec3 a) { // mismo orden que THREE.Euler 'XYZ'
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  return mat3(
    cy * cz, cx * sz + sx * sy * cz, sx * sz - cx * sy * cz,
    -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz,
    sy, -sx * cy, cx * cy);
}
`;

/**
 * Prepara el material de una copia de la hormiga: el shader gira cada pata con sus uniformes.
 * legs: [{ hip, knee, pv, knee: … }]; pv.rotation y kneePv.rotation son los ángulos que pone la animación.
 * Devuelve una función que copia los ángulos a los uniformes (llamar antes de dibujar).
 */
export function skinMaterial(mesh, legs) {
  const material = mesh.material.clone();
  const U = {
    uLegHip: { value: legs.map(l => l.hipAt.clone()) },
    uLegKnee: { value: legs.map(l => l.kneeAt.clone()) },
    uLegHipR: { value: legs.map(() => new THREE.Vector3()) },
    uLegKneeR: { value: legs.map(() => new THREE.Vector3()) }
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = SHADER_HEAD + shader.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        int legI = int(legInfo.x + 0.5);
        mat3 legK = mat3(1.0), legH = mat3(1.0);
        vec3 legKp = vec3(0.0), legHp = vec3(0.0);
        if (legInfo.x > -0.5) {
          legK = legEuler(uLegKneeR[legI] * legInfo.z); legKp = uLegKnee[legI];
          legH = legEuler(uLegHipR[legI] * legInfo.y); legHp = uLegHip[legI];
          objectNormal = legH * (legK * objectNormal);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (legInfo.x > -0.5) {
          transformed = legK * (transformed - legKp) + legKp;
          transformed = legH * (transformed - legHp) + legHp;
        }`);
  };
  material.customProgramCacheKey = () => 'antigenesis-legskin';
  mesh.material = material;
  mesh.frustumCulled = false; // las patas pueden salir de la caja de la malla en reposo
  return () => {
    for (let i = 0; i < legs.length; i++) {
      const r = legs[i].pv.rotation, k = legs[i].knee.rotation;
      U.uLegHipR.value[i].set(r.x, r.y, r.z);
      U.uLegKneeR.value[i].set(k.x, k.y, k.z);
    }
  };
}
