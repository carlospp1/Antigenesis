// Comprueba la forma de los dos árboles (src/game/trees.js):
//   · ningún par de nodos en la misma casilla
//   · cada enlace une casillas pegadas en horizontal o vertical
//   · todos los nodos llegan a la raíz
//   · ni ids ni nombres repetidos dentro de un árbol
//   · siguen estando todos los nodos hechos a mano (ids que pueden estar en partidas guardadas)
//   node tools/check-trees.mjs
import { SKILLS, PERKS } from '../src/game/trees.js';

const HAND = {
  SKILLS: 'br1 br2 br3 br4 br5 br6 brK1 br7 br8 brK2 br9 brK3 brK4 br10 br11 br12 fo1 fo2 fo3 fo4 fo5 foK1 fo6 fo7 foK2 fo8 foK3 fo9 foK4 fo10 fo11 fo12 wa1 wa2 wa3 wa4 wa5 waK1 waK2 wa6 wa7 waK3 wa8 waK4 wa9 wa10 wa11 wa12 ta1 ta2 ta3 ta4 ta5 taK1 ta6 ta7 ta8 taK2 ta9 ta10 ta11 lk1 lk2 lkK lc1 lc2 sh1 shK sh2 ghK gh2 gh3 gf1 gf2 sh3 mx1 mx2 mx3 br13 brK5 lk3 fo13 wa13 wa14 b1a b1b b1c b1d b2a b2b b2c b2d b3a b3b b3c b3d b4a b4b b4c b5a b5b b5c b5d b6a b6b b6c b7a b7b b7c b8a b8b b8c b9 f1a f1b f1c f1d f2a f2b f2c f3a f3b f3c f3d f4a f4b f4c f5a f5b f5c f6a f6b f6c f7a f7b f7c f8a f8b f8c f9 w1a w1b w1c w1d w2a w2b w2c w3a w3b w3c w4a w4b w4c w5a w5b w5c w6a w6b w6c w6d w7a w7b w8a w8b w9 t1a t1b t1c t2a t2b t3a t3b t3c t4a t4b t4c t5a t5b t5c t6a t6b t6c t6d t7a t7b t7c t8a t8b t8c t9 cb1 cb2 cb3 cbK cb4 qj1 qj2 qj3 qjK fs1 fs2 fsK mh2 mh3 mh4 mh5',
  PERKS: 'pf1 pf2 pf3 psp ppz pf4 pd1 ph1 pd2 ph2 pbk pd3 ph3 plv pd4 ph4 pe1 pg1 prs ptw pcv pe2 pl1 psh pgh1 pgh2 pgh3 pgf pgf2 psh2 psh3 pl2 ps1 ptp pj1 ps2 pds pj2 ps3 pdx1 pfe1 pdx2 pfe2 pqk pse pkp pbio pns pdg pcb1 pcb2 pcb3 ptc ptc2 ptc3 pqj1 pqj2 pqj3 pfs1 pfs2 pfs3 psk pab1 pgh4 pgh5 pgh6 pgh7 plb1 plb2 plb3 plb4 plb5 plf1 plf2 plf3 plf4 plw1 plw2 plw3 plw4 plw5 plt1 plt2 plt3 plt4 plt5 pls1 pls2'
};

let bad = 0;
const fail = (t, m) => { bad++; console.log('✗ ' + t + ': ' + m); };
for (const [name, N] of [['SKILLS', SKILLS], ['PERKS', PERKS]]) {
  const cells = new Map(), names = new Map();
  for (const id in N) {
    const n = N[id], k = n.x + ',' + n.y;
    if (cells.has(k)) fail(name, `${id} y ${cells.get(k)} en la misma casilla (${k})`); else cells.set(k, id);
    if (names.has(n.name)) fail(name, `nombre repetido «${n.name}» (${id}, ${names.get(n.name)})`); else names.set(n.name, id);
    for (const l of n.links) {
      const m = N[l];
      if (!m) { fail(name, `${id} enlaza con ${l}, que no existe`); continue; }
      if (Math.abs(n.x - m.x) + Math.abs(n.y - m.y) !== 1) fail(name, `${id} → ${l} no están pegados`);
    }
    if (n.reqPerk && !PERKS[n.reqPerk]) fail(name, `${id} pide ${n.reqPerk}, que no existe en el linaje`);
    for (const o of n.own || []) if (!SKILLS[o]) fail(name, `${id} deja tuyo ${o}, que no existe en el árbol`);
  }
  // todos llegan a la raíz
  const seen = new Set(['root']), q = ['root'];
  while (q.length) for (const a of N[q.shift()].adj) if (!seen.has(a)) { seen.add(a); q.push(a); }
  for (const id in N) if (!seen.has(id)) fail(name, `${id} no llega a la raíz`);
  for (const id of HAND[name].split(' ')) if (!N[id]) fail(name, `falta el nodo ${id}`);
  const xs = Object.values(N).map(n => n.x), ys = Object.values(N).map(n => n.y);
  console.log(`${name}: ${Object.keys(N).length} nodos · rejilla ${Math.max(...xs) + 1}×${Math.max(...ys) + 1}`);
}
if (bad) { console.log(`\n${bad} problemas`); process.exit(1); }
console.log('Todo en orden.');
