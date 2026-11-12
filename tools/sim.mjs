// Simulador de equilibrio: varios jugadores automáticos (tools/bot.mjs) juegan partidas completas
// con las reglas reales a toda velocidad, en paralelo, y se comparan con los OBJETIVOS de abajo.
//
//   node tools/sim.mjs                         → todos los perfiles, 6 partidas cada uno
//   node tools/sim.mjs --profile=normal --runs=20
//   node tools/sim.mjs --profile=activo --runs=1 --v --trace   → detalle de cada colonia y cada noche
//   node tools/sim.mjs --foeHpG=1.32           → prueba otro valor de BAL sin tocar el código
//   node tools/sim.mjs --tune                  → busca valores de BAL que cumplan los objetivos (perfil promedio)
//   node tools/sim.mjs --tune=foeHpG,adnK,skillG --profile=activo --runs=10
//   node tools/sim.mjs --out=informe.json      → guarda todos los resultados
//
// Otras opciones: --cps / --late (toques por segundo), --dt (paso de simulación), --capH (horas jugando máx.),
// --capDays, --threads, --seed (primera semilla), --iters (vueltas de --tune).
import os from 'node:os';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import { BAL, FINAL_NIGHT } from '../src/game/data.js';
import { PROFILES, MILESTONES } from './bot.mjs';

/**
 * OBJETIVOS DE DISEÑO (edítalos): qué experiencia quieres para cada tipo de jugador.
 *   winRate    fracción mínima de partidas ganadas antes del tope
 *   activeH    [mín, máx] horas JUGANDO hasta vencer a los humanos (mediana)
 *   days       [mín, máx] días de calendario hasta ganar (mediana, cuenta el tiempo fuera)
 *   first      [mín, máx] noche a la que llega la primera colonia
 *   colonies   [mín, máx] colonias hasta ganar
 *   maxGapMin  máximo de minutos seguidos sin poder comprar nada (aburrimiento)
 *   wallH      máximo de horas entre dos hitos seguidos (paredes de progreso)
 */
const TARGETS = {
  promedio: { winRate: 1, activeH: [3, 6], first: [3, 5], colonies: [8, 18], maxGapMin: 5, wallH: 1.2 },
  activo: { winRate: 1, activeH: [2.5, 5], first: [3, 5], colonies: [8, 18], maxGapMin: 5, wallH: 1.2 },
  normal: { winRate: 1, activeH: [3, 6], days: [2, 5], first: [3, 5], maxGapMin: 6, wallH: 1.5 },
  casual: { winRate: 0.8, days: [5, 14], first: [2, 5] },
  idle: {}
};

/* ---------- argumentos ---------- */
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const profiles = args.profile ? String(args.profile).split(',') : (args.tune ? ['promedio'] : Object.keys(PROFILES));
const RUNS = +(args.runs || (args.tune ? 8 : 6)), SEED0 = +(args.seed || 1);
const opts = { dt: +(args.dt || 0.5), capH: +(args.capH || args.cap || 12), capDays: +(args.capDays || 45), trace: !!args.trace };
if (args.cps) opts.cps = +args.cps;
if (args.late) opts.late = +args.late;
const balOver = {};
for (const k in args) if (k in BAL) balOver[k] = +args[k];

/* ---------- hilos ---------- */
const THREADS = Math.max(1, +(args.threads || Math.min(12, (os.availableParallelism?.() || os.cpus().length) - 1)));
const pool = [], queue = [], waiting = new Map();
let jobId = 0;
function spawn() {
  const w = new Worker(new URL('./sim-worker.mjs', import.meta.url));
  w.busy = false;
  w.on('message', m => { const cb = waiting.get(m.id); waiting.delete(m.id); w.busy = false; pump(); m.error ? cb.reject(new Error(m.error)) : cb.resolve(m.r); });
  w.on('error', e => { console.error(e); process.exit(1); });
  pool.push(w);
}
function pump() {
  for (const w of pool) {
    if (w.busy || !queue.length) continue;
    const job = queue.shift(); w.busy = true; w.postMessage(job);
  }
}
const run = (profile, seed, bal) => new Promise((resolve, reject) => {
  const id = ++jobId; waiting.set(id, { resolve, reject });
  queue.push({ id, profile, seed, bal, opts }); pump();
});
const runMany = (profile, bal) => Promise.all(Array.from({ length: RUNS }, (_, i) => run(profile, SEED0 + i, bal)));

/* ---------- estadística ---------- */
const q = (arr, p) => { const a = arr.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo); };
const med = a => q(a, 0.5);
const f1 = x => x == null ? '—' : x < 10 ? x.toFixed(2) : x.toFixed(1);

function summarize(rs) {
  const won = rs.filter(r => r.won);
  const ms = Object.fromEntries(MILESTONES.map(m => [m, med(rs.map(r => r.milestones[m]))]));
  // pared: el mayor salto de tiempo entre dos hitos seguidos
  let wall = 0, wallAt = null, prev = 0;
  for (const m of MILESTONES) { if (ms[m] == null) break; if (ms[m] - prev > wall) { wall = ms[m] - prev; wallAt = m; } prev = ms[m]; }
  return {
    n: rs.length, winRate: won.length / rs.length,
    activeH: med(won.map(r => r.activeH)) ?? null, activeP: [q(won.map(r => r.activeH), 0.1), q(won.map(r => r.activeH), 0.9)],
    days: med(won.map(r => r.days)) ?? null,
    colonies: med(rs.map(r => r.colonies.length)), first: med(rs.map(r => r.firstNight)),
    maxGapMin: med(rs.map(r => r.maxGapMin)), deaths: med(rs.map(r => r.deaths)), founds: med(rs.map(r => r.founds)),
    best: med(rs.map(r => Math.max(...r.colonies.map(c => c.night)))),
    ms, wallH: wall, wallAt
  };
}

/** ✔ / ✘ de cada objetivo y una pista de qué tocar. */
function check(s, T) {
  const out = [], inR = (x, [a, b]) => x != null && x >= a && x <= b;
  const range = (k, label, unit, tooLow, tooHigh) => {
    if (!T[k]) return;
    const x = s[k], ok = inR(x, T[k]);
    out.push({ ok, text: `${label}: ${f1(x)}${unit} (objetivo ${T[k][0]}–${T[k][1]}${unit})${ok ? '' : ' → ' + (x == null ? 'no llega' : x < T[k][0] ? tooLow : tooHigh)}` });
  };
  if (T.winRate != null) out.push({ ok: s.winRate >= T.winRate, text: `ganadas: ${Math.round(s.winRate * 100)}% (objetivo ≥ ${Math.round(T.winRate * 100)}%)${s.winRate >= T.winRate ? '' : ' → demasiado difícil o lento: baja foeHpG/foeDpsG o sube adnK'}` });
  range('activeH', 'horas jugando hasta ganar', ' h', 'demasiado fácil: sube foeHpG o baja adnK', 'demasiado lento: baja foeHpG o sube adnK/blood');
  range('days', 'días de calendario', ' d', 'demasiado rápido para quien juega a ratos', 'demasiados días: sube el progreso sin conexión o baja la dificultad');
  range('first', 'noche de la 1ª colonia', '', 'la 1ª colonia muere muy pronto: baja foeHp0/foeDps0', 'la 1ª colonia aguanta demasiado: sube foeHp0/foeCountK');
  range('colonies', 'colonias hasta ganar', '', 'pocas refundaciones: el linaje apenas se usa', 'demasiadas refundaciones: sube adnK o baja foeHpG');
  if (T.maxGapMin != null) out.push({ ok: s.maxGapMin <= T.maxGapMin, text: `mayor rato sin comprar nada: ${f1(s.maxGapMin)} min (máx. ${T.maxGapMin})${s.maxGapMin <= T.maxGapMin ? '' : ' → hay esperas aburridas: abarata skillG o sube prizeG'}` });
  if (T.wallH != null) out.push({ ok: s.wallH <= T.wallH, text: `mayor pared: ${f1(s.wallH)} h antes de la noche ${s.wallAt ?? '—'} (máx. ${T.wallH} h)${s.wallH <= T.wallH ? '' : ' → esa era es demasiado dura'}` });
  return out;
}

function printProfile(name, rs, s) {
  const P = PROFILES[name], T = TARGETS[name] || {};
  console.log(`\n━━ ${name.toUpperCase()} · ${P.desc} · ${rs.length} partidas`);
  console.log(`   ganadas ${Math.round(s.winRate * 100)}%   jugando ${f1(s.activeH)} h (p10 ${f1(s.activeP[0])} · p90 ${f1(s.activeP[1])})   calendario ${f1(s.days)} d   colonias ${f1(s.colonies)} (${f1(s.deaths)} muertes, ${f1(s.founds)} fundadas)   mejor noche ${f1(s.best)}`);
  console.log('   hitos (horas jugando, mediana): ' + MILESTONES.map(m => `N${m} ${f1(s.ms[m])}`).join(' · '));
  for (const c of check(s, T)) console.log(`   ${c.ok ? '✔' : '✘'} ${c.text}`);
  if (args.v) for (const r of rs) {
    console.log(`\n   semilla ${r.seed}: ${r.won ? 'GANADA' : 'sin ganar'} en ${r.activeH.toFixed(2)} h jugando, ${r.days.toFixed(1)} días`);
    for (const c of r.colonies) console.log(`     gen ${String(c.gen).padStart(2)}  noche ${String(c.night).padStart(2)}  ${String(c.min).padStart(5)} min  ${c.cause.padEnd(6)} +${c.adn} ADN  árbol ${c.skills}  linaje ${c.perms}  evo ${c.evo}`);
    if (r.trace) for (const t of r.trace) console.log(`       g${t.gen} N${String(t.night).padStart(2)} ${String(t.min).padStart(5)}m  hormigas ${String(t.ants).padStart(3)}  daño ${t.dmg}  vida ${t.hp}  enemigo ${t.foeHp} hp / ${t.foeDps} dps  jalea ${t.jelly}  bio ${t.bio}  árbol ${t.skills}  ${t.win ? 'gana' : 'PIERDE'}`);
  }
}

/* ---------- autoajuste ---------- */

/** Cuánto se aleja un resumen de los objetivos (0 = perfecto). */
function loss(s, T) {
  let L = 0;
  const pull = (x, [a, b], w = 1) => { if (x == null) { L += 4 * w; return; } const c = Math.sqrt(a * b), d = Math.log(x / c); L += w * d * d * (x < a || x > b ? 2 : 0.25); };
  if (T.winRate != null && s.winRate < T.winRate) L += 6 * (T.winRate - s.winRate);
  if (T.activeH) pull(s.activeH, T.activeH, 2);
  if (T.days) pull(s.days, T.days);
  if (T.first) pull(s.first, T.first);
  if (T.colonies) pull(s.colonies, T.colonies, 0.5);
  if (T.maxGapMin && s.maxGapMin > T.maxGapMin) L += Math.log(s.maxGapMin / T.maxGapMin);
  if (T.wallH && s.wallH > T.wallH) L += Math.log(s.wallH / T.wallH);
  return L;
}

/** Paso de un parámetro: los de crecimiento (…G, p.ej. 1.36) se mueven sobre su parte por encima de 1. */
const nudge = (k, v, f) => k.endsWith('G') && v > 1 ? +(1 + (v - 1) * f).toFixed(4) : +(v * f).toFixed(4);

async function tune() {
  const keys = (args.tune === true ? 'foeHpG,adnK' : String(args.tune)).split(',').map(s => s.trim()).filter(Boolean);
  for (const k of keys) if (!(k in BAL)) { console.error(`«${k}» no está en BAL`); process.exit(1); }
  const name = profiles[0], T = TARGETS[name];
  if (!T || !Object.keys(T).length) { console.error(`El perfil ${name} no tiene objetivos en TARGETS`); process.exit(1); }
  const cache = new Map();
  const evalBal = async bal => {
    const key = JSON.stringify(bal);
    if (!cache.has(key)) { const rs = await runMany(name, bal); const s = summarize(rs); cache.set(key, { s, L: loss(s, T) }); }
    return cache.get(key);
  };
  let cur = { ...balOver }; for (const k of keys) cur[k] ??= BAL[k];
  let best = await evalBal(cur), step = +(args.step || 0.12);
  const show = (tag, bal, e) => console.log(`${tag.padEnd(8)} pérdida ${e.L.toFixed(3).padStart(6)}  ${keys.map(k => `${k}=${bal[k]}`).join('  ')}  → jugando ${f1(e.s.activeH)} h, ${f1(e.s.days)} d, 1ª noche ${f1(e.s.first)}, ganadas ${Math.round(e.s.winRate * 100)}%`);
  console.log(`Ajustando ${keys.join(', ')} para el perfil «${name}» (${RUNS} partidas por prueba, mismas semillas en todas)\n`);
  show('inicio', cur, best);
  const iters = +(args.iters || 8);
  for (let it = 0; it < iters && step > 0.01; it++) {
    let improved = false;
    for (const k of keys) for (const f of [1 + step, 1 - step]) {
      const cand = { ...cur, [k]: nudge(k, cur[k], f) }, e = await evalBal(cand);
      if (e.L < best.L - 1e-6) { cur = cand; best = e; improved = true; show(`vuelta ${it + 1}`, cur, best); break; }
    }
    if (!improved) step /= 2;
    if (best.L < 0.02) break;
  }
  console.log('\nResultado:');
  printProfile(name, [], best.s);
  console.log('\nCopia esto en BAL (src/game/data.js):');
  for (const k of keys) console.log(`  ${k}: ${cur[k]},   // antes ${BAL[k]}`);
  return { profile: name, keys, bal: cur, summary: best.s };
}

/* ---------- principal ---------- */
const t0 = Date.now();
for (let i = 0; i < THREADS; i++) spawn();
let report;
if (args.tune) report = await tune();
else {
  console.log(`Simulando ${profiles.join(', ')} · ${RUNS} partidas por perfil · ${THREADS} hilos${Object.keys(balOver).length ? ' · BAL ' + JSON.stringify(balOver) : ''}`);
  report = {};
  for (const name of profiles) {
    const rs = await runMany(name, balOver), s = summarize(rs);
    printProfile(name, rs, s);
    report[name] = { summary: s, runs: rs };
  }
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s · final en la noche ${FINAL_NIGHT})`);
if (args.out) { fs.writeFileSync(String(args.out), JSON.stringify({ date: new Date().toISOString(), bal: { ...BAL, ...balOver }, report }, null, 1)); console.log('Guardado en ' + args.out); }
for (const w of pool) w.terminate();
