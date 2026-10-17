/* Murdoku · trabajador en segundo plano: genera casos y calcula pistas sin bloquear la página. */
importScripts('engine.js');
const E = self.createMurdokuEngine();
self.onmessage = e => {
  const m = e.data;
  try {
    if (m.type === 'gen') self.postMessage({ id: m.id, ok: true, puzzle: E.generate(m.diff, m.seed) });
    else if (m.type === 'hint') self.postMessage({ id: m.id, ok: true, hint: E.hint(E.prepare(m.puzzle), m.pos) });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) });
  }
};
