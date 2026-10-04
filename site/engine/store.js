// Visitor state. localStorage can throw (private mode, blocked site data) — always guarded.
const KEY = '7wells.v1';
let mem = {};
try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { mem = {}; }
const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} };

export const store = {
  get(k, dflt) { return k in mem ? mem[k] : dflt; },
  set(k, v) { mem[k] = v; flush(); return v; },
  seen(id) { return !!(mem.seen || {})[id]; },
  mark(id) { mem.seen = mem.seen || {}; mem.seen[id] = true; flush(); },
  seenCount() { return Object.keys(mem.seen || {}).length; },
  reset() { mem = {}; flush(); },
};
