// Coloca los nodos de los dos árboles (src/game/trees.js) en la rejilla y guarda el resultado en
// src/game/treeLayout.js. Hay que volver a lanzarlo al añadir, quitar o cambiar de padres algún nodo:
//   node tools/layout-trees.mjs && node tools/check-trees.mjs
//
// Qué busca (recocido simulado, con semilla: sale siempre igual):
//   · cada nodo pegado a TODOS sus padres (las 8 casillas de alrededor: también en diagonal)
//   · cada rama en su lado (un sector alrededor de la raíz), abriéndose desde el centro en todas direcciones
//   · cada nodo algo más lejos de la raíz que sus padres (el árbol crece hacia fuera)
//   · sin enlaces en diagonal que se crucen, y lo más compacto posible
import fs from 'node:fs';
import { GRAPHS } from '../src/game/trees.js';

/** Centro del lado de cada rama (grados; 0 = derecha, −90 = arriba) y la mitad de su anchura. */
const SECTORS = {
  skills: { half: 45, w: 30, at: { food: -45, war: 45, tap: 135, brood: -135 } },
  perm: { half: 36, w: 120, at: { brood: -90, food: -18, war: 54, found: 126, tap: -162 } }
};
const ITERS = { skills: 1.2e7, perm: 6e6 };

function seeded(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function layout(tree, seed) {
  const G = GRAPHS[tree], S = SECTORS[tree], rnd = seeded(seed);
  const ids = ['root', ...Object.keys(G)], idx = new Map(ids.map((id, i) => [id, i])), n = ids.length;
  const par = ids.map(id => (id === 'root' ? [] : G[id].parents.map(p => idx.get(p))));
  const kids = ids.map(() => []);
  par.forEach((ps, i) => ps.forEach(p => kids[p].push(i)));
  const linked = new Set();
  par.forEach((ps, i) => ps.forEach(p => { linked.add(i * 4096 + p); linked.add(p * 4096 + i); }));
  const center = ids.map(id => (id === 'root' ? 0 : S.at[G[id].cat]) * Math.PI / 180), half = S.half * Math.PI / 180;
  const X = new Int32Array(n), Y = new Int32Array(n), occ = new Map(), key = (x, y) => (x + 2000) * 8192 + (y + 2000);
  // profundidad: el camino más largo desde la raíz (orden de colocación)
  const depth = new Array(n).fill(-1);
  const dep = i => { if (depth[i] >= 0) return depth[i]; let d = 0; for (const p of par[i]) d = Math.max(d, dep(p) + 1); return (depth[i] = d); };
  for (let i = 0; i < n; i++) dep(i);

  /** Coste de tener el nodo i en (x, y), con lo demás donde está (solo cuenta lo que ya está colocado). */
  const placed = new Uint8Array(n);
  function cost(i, x, y) {
    if (i === 0) return 0;
    const r = Math.hypot(x, y);
    let a = Math.atan2(y, x) - center[i];
    a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    let c = r * 0.25 + a * 0.6 + Math.max(0, a - half + 0.06) * S.w;
    const near = (j, parent) => {
      if (!placed[j]) return;
      const dx = x - X[j], dy = y - Y[j], d = Math.max(Math.abs(dx), Math.abs(dy)), rj = Math.hypot(X[j], Y[j]);
      c += d <= 1 ? (dx && dy ? 0.3 : 0) : 200 * (d - 1);
      if (parent ? r < rj + 0.5 : rj < r + 0.5) c += 12 * (parent ? rj + 0.5 - r : r + 0.5 - rj);
      if (d === 1 && dx && dy) { // dos diagonales que se cruzan en el mismo cuadrado
        const a1 = occ.get(key(x, Y[j])), b1 = occ.get(key(X[j], y));
        if (a1 != null && b1 != null && linked.has(a1 * 4096 + b1)) c += 150;
      }
    };
    for (const p of par[i]) near(p, true);
    for (const k of kids[i]) near(k, false);
    // las series no van en línea recta: seguir en la misma dirección que el padre cuesta un poco (se curvan como ramas)
    const bend = (a, b, cc) => { if (placed[a] && placed[b] && placed[cc] && X[a] - X[b] === X[b] - X[cc] && Y[a] - Y[b] === Y[b] - Y[cc]) c += 0.8; };
    if (par[i].length === 1) { const p = par[i][0]; if (par[p].length === 1) bend(i, p, par[p][0]); }
    for (const k of kids[i]) if (par[k].length === 1) { if (par[i].length === 1) bend(k, i, par[i][0]); for (const g of kids[k]) if (par[g].length === 1) bend(g, k, i); }
    return c;
  }
  const put = (i, x, y) => { X[i] = x; Y[i] = y; occ.set(key(x, y), i); placed[i] = 1; };

  // colocación inicial: por profundidad, en la mejor casilla libre cerca de sus padres
  put(0, 0, 0);
  const order = ids.map((_, i) => i).slice(1).sort((a, b) => depth[a] - depth[b] || a - b);
  for (const i of order) {
    const cx = Math.round(par[i].reduce((s, p) => s + X[p], 0) / par[i].length), cy = Math.round(par[i].reduce((s, p) => s + Y[p], 0) / par[i].length);
    let best = null, bc = Infinity;
    for (let R = 1; R < 30 && (!best || R < 4); R++) {
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
        const x = cx + dx, y = cy + dy;
        if (occ.has(key(x, y))) continue;
        const c = cost(i, x, y);
        if (c < bc) { bc = c; best = [x, y]; }
      }
    }
    put(i, best[0], best[1]);
  }

  // recocido: mover un nodo a una casilla cercana (o junto a un vecino suyo), o intercambiarlo con quien esté allí
  const N = ITERS[tree], T0 = 4, T1 = 0.02;
  for (let it = 0; it < N; it++) {
    const T = T0 * Math.pow(T1 / T0, it / N);
    const i = 1 + Math.floor(rnd() * (n - 1));
    let tx, ty;
    const nb = par[i].concat(kids[i]);
    if (nb.length && rnd() < 0.5) { const j = nb[Math.floor(rnd() * nb.length)]; tx = X[j] + Math.floor(rnd() * 3) - 1; ty = Y[j] + Math.floor(rnd() * 3) - 1; }
    else { tx = X[i] + Math.floor(rnd() * 5) - 2; ty = Y[i] + Math.floor(rnd() * 5) - 2; }
    if (tx === X[i] && ty === Y[i]) continue;
    const k = occ.get(key(tx, ty));
    if (k === 0) continue;
    const ox = X[i], oy = Y[i];
    if (k == null) {
      const before = cost(i, ox, oy);
      occ.delete(key(ox, oy)); X[i] = tx; Y[i] = ty; occ.set(key(tx, ty), i);
      const delta = cost(i, tx, ty) - before;
      if (delta > 0 && rnd() >= Math.exp(-delta / T)) { occ.delete(key(tx, ty)); X[i] = ox; Y[i] = oy; occ.set(key(ox, oy), i); }
    } else {
      const before = cost(i, ox, oy) + cost(k, tx, ty);
      X[i] = tx; Y[i] = ty; X[k] = ox; Y[k] = oy; occ.set(key(tx, ty), i); occ.set(key(ox, oy), k);
      const delta = cost(i, tx, ty) + cost(k, ox, oy) - before;
      if (delta > 0 && rnd() >= Math.exp(-delta / T)) { X[i] = ox; Y[i] = oy; X[k] = tx; Y[k] = ty; occ.set(key(ox, oy), i); occ.set(key(tx, ty), k); }
    }
  }

  // informe
  let long = 0, cross = 0, out = 0, inward = 0;
  for (let i = 1; i < n; i++) {
    for (const p of par[i]) {
      const d = Math.max(Math.abs(X[i] - X[p]), Math.abs(Y[i] - Y[p]));
      if (d > 1) long++;
      if (Math.hypot(X[i], Y[i]) < Math.hypot(X[p], Y[p])) inward++;
      if (d === 1 && X[i] !== X[p] && Y[i] !== Y[p]) { const a = occ.get(key(X[i], Y[p])), b = occ.get(key(X[p], Y[i])); if (a != null && b != null && linked.has(a * 4096 + b)) cross++; }
    }
    let a = Math.atan2(Y[i], X[i]) - center[i]; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (a > half + 0.02) out++;
  }
  // reparación: ningún hijo a más de 2 casillas (Chebyshev) de cada padre
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 1; i < n; i++) {
      const far = par[i].filter(p => Math.max(Math.abs(X[i] - X[p]), Math.abs(Y[i] - Y[p])) > 2);
      if (!far.length) continue;
      const cx = Math.round(par[i].reduce((s, p) => s + X[p], 0) / par[i].length);
      const cy = Math.round(par[i].reduce((s, p) => s + Y[p], 0) / par[i].length);
      let best = null, bc = Infinity;
      for (let R = 1; R <= 8; R++) {
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
          const x = cx + dx, y = cy + dy, k = key(x, y), who = occ.get(k);
          if (who != null && who !== i) continue;
          let c = 0, ok = true;
          for (const p of par[i]) {
            const d = Math.max(Math.abs(x - X[p]), Math.abs(y - Y[p]));
            if (d > 2) ok = false;
            c += d;
          }
          if (!ok) continue;
          if (c < bc) { bc = c; best = [x, y]; }
        }
        if (best) break;
      }
      if (!best) continue;
      occ.delete(key(X[i], Y[i]));
      X[i] = best[0]; Y[i] = best[1];
      occ.set(key(X[i], Y[i]), i);
      moved = true;
    }
    if (!moved) break;
  }
  long = 0; cross = 0; out = 0; inward = 0;
  for (let i = 1; i < n; i++) {
    for (const p of par[i]) {
      const d = Math.max(Math.abs(X[i] - X[p]), Math.abs(Y[i] - Y[p]));
      if (d > 1) long++;
      if (Math.hypot(X[i], Y[i]) < Math.hypot(X[p], Y[p])) inward++;
      if (d === 1 && X[i] !== X[p] && Y[i] !== Y[p]) { const a = occ.get(key(X[i], Y[p])), b = occ.get(key(X[p], Y[i])); if (a != null && b != null && linked.has(a * 4096 + b)) cross++; }
    }
    let a = Math.atan2(Y[i], X[i]) - center[i]; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (a > half + 0.02) out++;
  }

  const res = {};
  for (let i = 0; i < n; i++) res[ids[i]] = [X[i], Y[i]];
  return { res, score: long * 10 + cross * 10 + out + inward, text: `${n} nodos · enlaces que no se tocan: ${long} · cruces: ${cross / 2} · fuera de su lado: ${out} · hacia dentro: ${inward}` };
}

/** Varias semillas por árbol: se queda la que menos falla. */
function best(tree, seeds) {
  let b = null;
  for (const s of seeds) { const r = layout(tree, s); if (!b || r.score < b.score) b = r; }
  console.log(`${tree}: ${b.text}`);
  return b.res;
}
const L = { skills: best('skills', [7, 21, 33]), perm: best('perm', [11, 23, 37]) };
const line = o => Object.entries(o).map(([id, [x, y]]) => `${id}:[${x},${y}]`).join(',');
fs.writeFileSync(new URL('../src/game/treeLayout.js', import.meta.url),
  '// Generado por tools/layout-trees.mjs: dónde se dibuja cada nodo de los árboles (columna, fila). No editar a mano.\n' +
  `export const LAYOUT = {\n  skills: {${line(L.skills)}},\n  perm: {${line(L.perm)}}\n};\n`);
console.log('Guardado en src/game/treeLayout.js');
