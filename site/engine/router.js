// Scene registry + transitions + hash deep-linking.
// Scenes are lazily imported so a broken scene cannot stop the site from booting.

const ROUTES = {
  'boot-intro': () => import('../scenes/boot-intro.js'),
  surface: () => import('../scenes/surface.js'),
  chamber: () => import('../scenes/chamber.js'),
  seventh: () => import('../scenes/seventh.js'),
};

export function hashFor(id, payload) {
  if (id === 'chamber' && payload && payload.wellId) return '#/well/' + payload.wellId;
  if (id === 'boot-intro') return '#/';
  return '#/' + id;
}

export function parseHash(h = location.hash) {
  const m = /^#\/well\/([a-z0-9-]+)/i.exec(h);
  if (m) return { id: 'chamber', payload: { wellId: m[1] } };
  const s = (h || '').replace(/^#\/?/, '').trim();
  if (s && ROUTES[s]) return { id: s, payload: {} };
  return null;
}

export function makeRouter({ stage, ctxBase, onChange }) {
  let current = null;       // { id, mod, root }
  let busy = false;

  async function go(id, payload = {}, opts = {}) {
    if (busy) return;
    if (!ROUTES[id]) { console.warn('[router] unknown scene', id); return; }
    busy = true;
    try {
      const mod = (await ROUTES[id]()).default;

      if (current) {
        try { current.mod.exit && current.mod.exit(); } catch (e) { console.warn('[router] exit', e); }
        current.root.classList.add('scene--leaving');
        const leaving = current.root;
        setTimeout(() => leaving.remove(), 420);
      }

      const root = document.createElement('div');
      root.className = 'scene';
      root.dataset.scene = id;
      stage.appendChild(root);

      const ctx = {
        ...ctxBase,
        root,
        payload,
        go: (nid, p) => go(nid, p),
        get W() { return window.innerWidth; },
        get H() { return window.innerHeight; },
      };

      current = { id, mod, root, ctx };
      document.body.dataset.scene = id;

      const target = hashFor(id, payload);
      if (!opts.fromHash && location.hash !== target) {
        history.pushState({ id, payload }, '', target);
      }

      try { await mod.enter(ctx); } catch (e) { console.error('[scene ' + id + '] enter failed', e); }
      onChange && onChange(id, payload);
    } catch (e) {
      console.error('[router] failed to load scene', id, e);
    } finally {
      busy = false;
    }
  }

  const router = {
    go,
    get id() { return current && current.id; },
    update(dt, t) {
      if (current && current.mod.update) {
        try { current.mod.update(dt, t); } catch (e) { console.warn('[scene update]', e); }
      }
    },
    resize(w, h) {
      if (current && current.mod.resize) {
        try { current.mod.resize(w, h); } catch {}
      }
    },
  };

  window.addEventListener('popstate', () => {
    const r = parseHash();
    if (r && r.id !== (current && current.id)) go(r.id, r.payload, { fromHash: true });
    else if (r && r.id === 'chamber') go(r.id, r.payload, { fromHash: true });
  });

  return router;
}
