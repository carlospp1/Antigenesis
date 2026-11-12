// Hilo de trabajo del simulador: recibe { id, profile, seed, bal, opts }, juega y devuelve el resultado.
// Cada hilo tiene su propia copia de BAL, así que se pueden probar valores distintos en paralelo.
import { parentPort } from 'node:worker_threads';
import { BAL } from '../src/game/data.js';
import { playGame } from './bot.mjs';

const base = { ...BAL };
parentPort.on('message', job => {
  try {
    Object.assign(BAL, base, job.bal || {});
    parentPort.postMessage({ id: job.id, r: playGame(job.profile, job.seed, job.opts) });
  } catch (e) {
    parentPort.postMessage({ id: job.id, error: String(e && e.stack || e) });
  }
});
