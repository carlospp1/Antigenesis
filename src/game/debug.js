// Modo de prueba: todo desbloqueado, y jalea, biomasa y ADN infinitos. Consola: __ax.free = true
const KEY = 'antigenesis.debug';
let mem = false;
try { mem = localStorage.getItem(KEY) === '1'; } catch (e) { /* sin localStorage (p. ej. Node) */ }

export const debug = {
  get free() { return mem; },
  set free(v) {
    mem = !!v;
    try { if (mem) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* nada */ }
  }
};
