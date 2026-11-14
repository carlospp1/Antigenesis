// Acerca nodos que el check marca a >2 de un padre (sobre todo multi-padre como t9).
import fs from 'node:fs';
import { GRAPHS } from '../src/game/trees.js';
import { LAYOUT } from '../src/game/treeLayout.js';

function repair(tree) {
  const G = GRAPHS[tree];
  const P = {};
  for (const id in LAYOUT[tree]) P[id] = LAYOUT[tree][id].slice();
  const key = (x, y) => x + ',' + y;
  const occMap = () => {
    const m = new Map();
    for (const id in P) m.set(key(P[id][0], P[id][1]), id);
    return m;
  };
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    const occ = occMap();
    for (const id of Object.keys(G)) {
      if (id === 'root') continue;
      const parents = G[id].parents;
      if (parents.every(p => cheb(P[id], P[p]) <= 2)) continue;

      // si los padres están lejos entre sí, acerca el más móvil al otro
      if (parents.length >= 2) {
        for (let i = 0; i < parents.length; i++) {
          for (let j = i + 1; j < parents.length; j++) {
            const pa = parents[i], pb = parents[j];
            if (cheb(P[pa], P[pb]) <= 3) continue;
            // mueve pb hacia pa
            const occ2 = occMap();
            occ2.delete(key(P[pb][0], P[pb][1]));
            let best = null, bc = Infinity;
            for (let R = 1; R <= 6; R++) {
              for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
                const x = P[pa][0] + dx, y = P[pa][1] + dy;
                if (occ2.has(key(x, y))) continue;
                // pb no se aleje demasiado de SUS padres
                const gps = G[pb].parents;
                if (gps.some(g => cheb([x, y], P[g]) > 2)) continue;
                const c = cheb([x, y], P[pa]);
                if (c < bc) { bc = c; best = [x, y]; }
              }
              if (best && bc <= 2) break;
            }
            if (best) {
              occ.delete(key(P[pb][0], P[pb][1]));
              P[pb] = best;
              occ.set(key(best[0], best[1]), pb);
              moved = true;
            }
          }
        }
      }

      const cx = Math.round(parents.reduce((s, p) => s + P[p][0], 0) / parents.length);
      const cy = Math.round(parents.reduce((s, p) => s + P[p][1], 0) / parents.length);
      const occ3 = occMap();
      occ3.delete(key(P[id][0], P[id][1]));
      let best = null, bc = Infinity;
      for (let R = 1; R <= 8; R++) {
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
          const x = cx + dx, y = cy + dy;
          if (occ3.has(key(x, y))) continue;
          if (parents.some(p => cheb([x, y], P[p]) > 2)) continue;
          const c = parents.reduce((s, p) => s + cheb([x, y], P[p]), 0);
          if (c < bc) { bc = c; best = [x, y]; }
        }
        if (best) break;
      }
      if (best && (best[0] !== P[id][0] || best[1] !== P[id][1])) {
        P[id] = best;
        moved = true;
      }
    }
    if (!moved) break;
  }

  let bad = 0;
  for (const id in G) {
    if (id === 'root') continue;
    for (const p of G[id].parents) {
      const d = cheb(P[id], P[p]);
      if (d > 2) { bad++; console.log('still', tree, id, p, d); }
    }
  }
  console.log(tree, 'bad', bad, 'qj1', P.qj1);
  return P;
}

const skills = repair('skills');
const perm = LAYOUT.perm;
const line = o => Object.entries(o).map(([id, [x, y]]) => `${id}:[${x},${y}]`).join(',');
fs.writeFileSync(new URL('../src/game/treeLayout.js', import.meta.url),
  '// Generado por tools/layout-trees.mjs: dónde se dibuja cada nodo de los árboles (columna, fila). No editar a mano.\n' +
  `export const LAYOUT = {\n  skills: {${line(skills)}},\n  perm: {${line(perm)}}\n};\n`);
