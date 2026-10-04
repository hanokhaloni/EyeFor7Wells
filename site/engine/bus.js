// Tiny pub/sub. on() returns an unsubscribe function.
export function makeBus() {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt)?.delete(fn);
    },
    emit(evt, data) {
      for (const fn of map.get(evt) || []) {
        try { fn(data); } catch (e) { console.warn('[bus]', evt, e); }
      }
    },
    clear() { map.clear(); },
  };
}
