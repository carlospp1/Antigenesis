// Modo de prueba. También se cambia desde la consola: __ax.free = true
const KEY = 'antigenesis.debug';

export const debug = {
  get free() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
  set free(v) { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* nada */ } }
};
