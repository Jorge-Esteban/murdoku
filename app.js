/* Murdoku · interfaz */
(() => {
  'use strict';
  const E = window.createMurdokuEngine();
  const DIFFS = ['facil', 'normal', 'dificil', 'experto', 'maestro'];
  const DL = { facil: 'F', normal: 'N', dificil: 'D', experto: 'E', maestro: 'M' };
  const LD = { F: 'facil', N: 'normal', D: 'dificil', E: 'experto', M: 'maestro' };
  const DESC = {
    facil: 'Para calentar. Pistas directas.',
    normal: 'Ya hay que cruzar declaraciones.',
    dificil: 'Filas, columnas y habitaciones a la vez.',
    experto: 'Deducciones en cadena.',
    maestro: 'Toca suponer y pillar contradicciones.'
  };
  const DIFF_TILE = { facil: 'var(--p0)', normal: 'var(--p1)', dificil: 'var(--p3)', experto: 'var(--p4)', maestro: 'var(--red)' };
  const WEEK = ['maestro', 'facil', 'normal', 'normal', 'dificil', 'dificil', 'experto'];
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ROOM_EMOJI = ['🟦', '🟧', '🟩', '🟥', '🟫', '🟪', '🟨', '⬜'];
  const PRAISE = { 3: ['¡Brillante!', '¡Impecable!', '¡Elemental!'], 2: ['¡Pillado!', '¡Bien visto!', '¡Te lo has currado!'], 1: ['¡Por los pelos!', '¡Caso cerrado!'] };
  const LOADING = [
    ['Escondiendo el cadáver…', 'Repartiendo coartadas'],
    ['Moviendo los muebles…', 'Alguien ha dejado huellas en el piano'],
    ['Apagando las luces…', 'Ensayando caras de inocente'],
    ['Sirviendo el último té…', 'Nadie ha visto nada, claro'],
    ['Cerrando las puertas…', 'Todos tienen algo que ocultar']
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('murdoku:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('murdoku:' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem('murdoku:' + k); } catch (e) { /* nada */ } }
  };
  const settings = Object.assign({ theme: 'system', sound: true, shade: true, status: true, cands: false }, store.get('settings', {}));

  /* ---------- Trabajador en segundo plano ---------- */
  let worker = null, wid = 0;
  const pending = new Map();
  try {
    worker = new Worker('worker.js');
    worker.onmessage = e => {
      const m = e.data, p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m); else p.direct();
    };
    worker.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      const list = [...pending.values()];
      pending.clear(); worker = null;
      list.forEach(p => p.direct());
    };
  } catch (e) { worker = null; }
  function runDirect(msg) {
    if (msg.type === 'gen') return { puzzle: E.generate(msg.diff, msg.seed) };
    if (msg.type === 'hint') return { hint: E.hint(E.prepare(msg.puzzle), msg.pos) };
    return {};
  }
  function call(msg) {
    return new Promise((resolve, reject) => {
      const direct = () => setTimeout(() => { try { resolve(runDirect(msg)); } catch (err) { reject(err); } }, 40);
      if (!worker) return direct();
      const id = ++wid;
      const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); direct(); } }, 25000);
      pending.set(id, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        direct: () => { clearTimeout(timer); direct(); }
      });
      worker.postMessage(Object.assign({ id }, msg));
    });
  }

  /* ---------- Referencias ---------- */
  const board = $('#board'), picker = $('#picker'), peopleEl = $('#people'), legendEl = $('#legend');
  const hintPanel = $('#hintPanel'), loader = $('#loader');
  let G = null;
  let cells = [];
  let hoverCell = -1;
  let modalDepth = 0;

  /* ---------- Utilidades ---------- */
  const pad = n => String(n).padStart(2, '0');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  }
  function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function dailyCode(d = new Date()) { return `${DL[WEEK[d.getDay()]]}-D${todayStr(d).replace(/-/g, '')}`; }
  function randomCode(diff) {
    let s = '';
    const buf = new Uint32Array(6);
    try { crypto.getRandomValues(buf); } catch (e) { for (let i = 0; i < 6; i++) buf[i] = Math.floor(Math.random() * 1e9); }
    for (let i = 0; i < 6; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length];
    return `${DL[diff]}-${s}`;
  }
  function parseCode(code) {
    const m = /^([FNDEM])-([A-Z0-9]{3,14})$/.exec(String(code || '').trim().toUpperCase());
    return m ? { diff: LD[m[1]], seed: m[2], code: `${m[1]}-${m[2]}`, daily: /^D\d{8}$/.test(m[2]) } : null;
  }
  const personName = (p, capital) => {
    const pe = G.puz.people[p];
    const s = pe.art ? pe.art + ' ' + pe.name : pe.name;
    return capital ? cap(s) : s;
  };
  const shortName = p => (G.puz.people[p].role === 'victim' ? 'Víctima' : G.puz.people[p].name);
  const cellName = i => E.cellName(G.N, i);
  const objName = o => E.OBJ[o].name;
  const indef = o => (E.OBJ[o].g === 'f' ? 'una ' : 'un ') + E.OBJ[o].name;
  const roomName = k => G.puz.rooms[k].name;
  const isVictim = p => G.puz.people[p].role === 'victim';
  const faceCache = new Map();
  const faceOf = p => {
    const key = G.code + ':' + p;
    if (!faceCache.has(key)) faceCache.set(key, window.MurdokuFaces.face(G.puz.people[p], p));
    return faceCache.get(key);
  };
  const avatarHTML = p => `<span class="avatar${isVictim(p) ? ' victim' : ''}" style="--pc:var(--p${p % 9})">${faceOf(p)}</span>`;

  /* ---------- Sonido ---------- */
  let AC = null;
  const SOUNDS = {
    place: [[620, 0, .06, 'triangle', .12], [930, .045, .08, 'triangle', .07]],
    lift: [[520, 0, .05, 'triangle', .08], [390, .04, .07, 'triangle', .06]],
    x: [[260, 0, .04, 'square', .03]],
    note: [[1046, 0, .04, 'sine', .05]],
    undo: [[392, 0, .06, 'triangle', .07]],
    err: [[160, 0, .16, 'square', .04]],
    hint: [[784, 0, .09, 'sine', .08], [1175, .08, .14, 'sine', .07]],
    win: [[523, 0, .12, 'triangle', .12], [659, .1, .12, 'triangle', .12], [784, .2, .12, 'triangle', .12], [1047, .3, .45, 'triangle', .12]],
    wrong: [[220, 0, .2, 'sawtooth', .05], [165, .17, .35, 'sawtooth', .05]]
  };
  function beep(kind) {
    if (!settings.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      const t0 = AC.currentTime;
      for (const [f, d, len, type, vol] of SOUNDS[kind] || []) {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(vol, t0 + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len);
        o.connect(g).connect(AC.destination);
        o.start(t0 + d); o.stop(t0 + d + len + 0.03);
      }
    } catch (e) { /* sin audio */ }
  }

  /* ---------- Avisos ---------- */
  function toast(msg, ms = 2200) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }

  /* ---------- Tema ---------- */
  function applyTheme() {
    const root = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme);
    else root.removeAttribute('data-theme');
    document.body.classList.toggle('hide-status', !settings.status);
  }
  function saveSettings() { store.set('settings', settings); applyTheme(); if (G) updateAll(); }

  /* ---------- Carga de partidas ---------- */
  function setLoading(on) {
    loader.hidden = !on;
    if (on) {
      const [t, s] = pick(LOADING);
      $('#loaderText').textContent = t;
      $('#loaderSub').textContent = s;
    }
  }
  async function loadGame(code) {
    const info = parseCode(code);
    if (!info) { toast('Ese código no vale. Tiene esta pinta: N-K7Q2MX'); return; }
    closeHint();
    setLoading(true);
    let puz = store.get('p:' + info.code, null);
    if (!puz || puz.v !== 3) {
      try { puz = (await call({ type: 'gen', diff: info.diff, seed: info.seed })).puzzle; } catch (e) { puz = null; }
      if (!puz) { setLoading(false); toast('Este caso se ha atascado. Prueba con otro.'); return; }
      cachePuzzle(info.code, puz);
    }
    setupGame(puz, info);
    setLoading(false);
  }
  function cachePuzzle(code, puz) {
    const list = store.get('plist', []).filter(c => c !== code);
    list.push(code);
    while (list.length > 12) store.del('p:' + list.shift());
    store.set('plist', list);
    store.set('p:' + code, puz);
  }

  function setupGame(puz, info) {
    const N = puz.N, NN = N * N;
    const saved = store.get('g:' + info.code, null);
    G = {
      code: info.code, diff: info.diff, daily: info.daily, puz, N, NN,
      ctx: E.prepare(puz),
      pos: new Array(N).fill(-1), xm: new Uint8Array(NN), notes: new Uint16Array(NN),
      sel: null, mode: 'place', elapsed: 0, hints: 0, mistakes: 0, checks: 0, stars: 0,
      revealed: false, solved: false, started: false, history: [], future: [],
      hl: null, wrongCells: new Set(), xWrong: new Set(), roomHl: null,
      cursor: Math.floor(NN / 2), paused: false, hint: null, hintStage: 0, completeWarned: ''
    };
    if (saved) {
      if (Array.isArray(saved.pos) && saved.pos.length === N) G.pos = saved.pos.slice();
      (saved.xm || []).forEach(i => { if (i < NN) G.xm[i] = 1; });
      (saved.notes || []).forEach(([i, m]) => { if (i < NN) G.notes[i] = m; });
      Object.assign(G, {
        elapsed: saved.elapsed || 0, hints: saved.hints || 0, mistakes: saved.mistakes || 0, checks: saved.checks || 0,
        revealed: !!saved.revealed, solved: !!saved.solved, started: !!saved.started, stars: saved.stars || 0
      });
    }
    store.set('last', G.code);
    buildBoard();
    buildPeople();
    buildLegend();
    updateHeader();
    setMode('place');
    if (G.solved) toast(G.revealed ? 'Este caso lo cerraste rindiéndote.' : 'Este caso ya lo resolviste.');
  }

  function saveGame() {
    if (!G) return;
    const notes = [];
    G.notes.forEach((m, i) => { if (m) notes.push([i, m]); });
    const xm = [];
    G.xm.forEach((v, i) => { if (v) xm.push(i); });
    store.set('g:' + G.code, {
      pos: G.pos, xm, notes, elapsed: G.elapsed, hints: G.hints, mistakes: G.mistakes, checks: G.checks,
      revealed: G.revealed, solved: G.solved, started: G.started, stars: G.stars
    });
  }

  /* ---------- Construcción del plano ---------- */
  function buildBoard() {
    const { N, puz, ctx } = G;
    const room = puz.room;
    board.style.setProperty('--n', N);
    board.classList.remove('win');
    board.innerHTML = '';
    cells = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < G.NN; i++) {
      const r = Math.floor(i / N), c = i % N;
      const bt = r === 0 || room[i - N] !== room[i];
      const bb = r === N - 1 || room[i + N] !== room[i];
      const bl = c === 0 || room[i - 1] !== room[i];
      const br = c === N - 1 || room[i + 1] !== room[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (ctx.blocked[i] ? ' blocked' : '') + (bt ? ' bt' : '') + (bb ? ' bb' : '') + (bl ? ' bl' : '') + (br ? ' br' : '') +
        (!br ? ' ir' : '') + (!bb ? ' ib' : '');
      b.dataset.i = i;
      b.setAttribute('role', 'gridcell');
      b.tabIndex = i === G.cursor ? 0 : -1;
      const rad = (x, y) => (x && y ? '6px' : '0');
      b.style.cssText = `grid-area:${r + 1}/${c + 1};--room:var(--r${puz.rooms[room[i]].color});--d:${(r + c) * 45};` +
        `border-radius:${rad(bt, bl)} ${rad(bt, br)} ${rad(bb, br)} ${rad(bb, bl)}`;
      const o = puz.obj[i];
      b.innerHTML = (o ? `<svg class="obj" aria-hidden="true"><use href="#i-${o}"/></svg>` : '') +
        '<span class="notes"></span><svg class="xmark" aria-hidden="true"><use href="#i-x"/></svg><span class="token"></span>';
      frag.appendChild(b);
      cells.push(b);
    }
    // rótulo de cada habitación sobre su tramo horizontal más largo
    puz.rooms.forEach((rm, k) => {
      let best = null;
      for (let r = 0; r < N; r++) {
        let c = 0;
        while (c < N) {
          if (room[r * N + c] !== k) { c++; continue; }
          let e = c;
          while (e < N && room[r * N + e] === k) e++;
          if (!best || e - c > best.len) best = { r, c, len: e - c };
          c = e;
        }
      }
      const lab = document.createElement('span');
      lab.className = 'rlabel';
      lab.textContent = rm.name;
      lab.style.gridArea = `${best.r + 1} / ${best.c + 1} / span 1 / span ${best.len}`;
      frag.appendChild(lab);
    });
    board.appendChild(frag);
    const L = E.LETTERS;
    $('#colCoords').innerHTML = Array.from({ length: N }, (_, c) => `<span>${L[c]}</span>`).join('');
    $('#rowCoords').innerHTML = Array.from({ length: N }, (_, r) => `<span>${r + 1}</span>`).join('');
    sizeBoard();
  }
  function sizeBoard() {
    if (!G) return;
    const w = board.clientWidth || 360;
    board.style.setProperty('--cell', (w / G.N).toFixed(1) + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(sizeBoard).observe(board);
  else window.addEventListener('resize', sizeBoard);

  function buildPeople() {
    const { puz, N } = G;
    picker.style.setProperty('--cols', N <= 6 ? N : Math.ceil(N / 2));
    picker.innerHTML = puz.people.map((pe, p) => `
      <button type="button" class="key${pe.role === 'victim' ? ' victim' : ''}" data-p="${p}" aria-pressed="false"
        style="--pc:var(--p${p % 9})" title="${esc(personName(p, true))} · atajo ${p === N - 1 ? '0' : p + 1}">
        <span class="kface">${faceOf(p)}</span><small>${esc(shortName(p))}</small>
      </button>`).join('');
    peopleEl.innerHTML = puz.people.map((pe, p) => {
      const clues = puz.clues.map((cl, k) => ({ cl, k })).filter(o => o.cl.p === p);
      const lis = clues.length
        ? clues.map(o => `<li data-k="${o.k}"><span class="st" aria-hidden="true"></span><span>${esc(o.cl.text)}</span></li>`).join('')
        : `<li class="none"><span class="st" aria-hidden="true"></span><span>${pe.role === 'victim' ? 'No está en condiciones de declarar.' : 'Prefiere no decir nada.'}</span></li>`;
      return `<article class="pcard" data-p="${p}" role="button" tabindex="0" aria-pressed="false">
        <header>${avatarHTML(p)}<span class="pname">${esc(personName(p, true))}</span>${pe.role === 'victim' ? '<span class="role">Víctima</span>' : ''}<span class="loc">—</span></header>
        <ul class="clues">${lis}</ul>
      </article>`;
    }).join('');
    const general = puz.clues.map((cl, k) => ({ cl, k })).filter(o => o.cl.p == null);
    $('#inspector').innerHTML = `<h4>Notas del inspector</h4><ul class="clues">
      ${general.map(o => `<li data-k="${o.k}"><span class="st" aria-hidden="true"></span><span>${esc(o.cl.text)}</span></li>`).join('')}
      <li data-rule="murder"><span class="st" aria-hidden="true"></span><span>El asesino es el único que estuvo a solas con la víctima en una habitación.</span></li>
    </ul>`;
  }

  function buildLegend() {
    legendEl.innerHTML = G.puz.rooms.map((rm, k) =>
      `<button type="button" data-room="${k}" aria-pressed="false" style="--sw:var(--r${rm.color})"><i></i>${esc(rm.name)}</button>`).join('');
  }

  function updateHeader() {
    const { puz, diff, daily } = G;
    const label = E.DIFF[diff].label;
    $('#caseEyebrow').textContent = daily ? `Caso del día · ${label}` : `Caso ${G.code} · ${label}`;
    $('#caseTitle').textContent = puz.title;
    $('#storyTitle').textContent = `¿Quién mató a ${personName(G.N - 1)}?`;
    $('#story').textContent = puz.story;
  }

  /* ---------- Actualización de la vista ---------- */
  function placedMap() {
    const m = new Map();
    G.pos.forEach((i, p) => { if (i >= 0) m.set(i, p); });
    return m;
  }

  function updateBoard() {
    const { N, NN, ctx, puz } = G;
    const occ = placedMap();
    const rows = new Set(), cols = new Set();
    for (const i of occ.keys()) { rows.add(ctx.rowOf[i]); cols.add(ctx.colOf[i]); }
    const conflict = new Set();
    G.pos.forEach((i, p) => {
      if (i < 0) return;
      G.pos.forEach((j, q) => {
        if (q !== p && j >= 0 && (ctx.rowOf[i] === ctx.rowOf[j] || ctx.colOf[i] === ctx.colOf[j])) conflict.add(i);
      });
    });
    let cand = null;
    if (settings.cands && G.sel != null && G.pos[G.sel] < 0 && !G.solved) cand = new Set(E.candidatesFor(ctx, G.pos, G.sel));
    const hl = G.hl || {};
    for (let i = 0; i < NN; i++) {
      const el = cells[i];
      const p = occ.has(i) ? occ.get(i) : null;
      const ghost = p == null && hoverCell === i && G.mode === 'place' && G.sel != null && !ctx.blocked[i] && !G.solved;
      const showP = p != null ? p : ghost ? G.sel : null;
      const tok = el.lastElementChild;
      if (String(showP) !== tok.dataset.p) {
        tok.dataset.p = String(showP);
        if (showP == null) { tok.innerHTML = ''; tok.className = 'token'; }
        else if (isVictim(showP)) { tok.className = 'token victim'; tok.innerHTML = faceOf(showP); }
        else { tok.className = 'token'; tok.style.setProperty('--pc', `var(--p${showP % 9})`); tok.innerHTML = faceOf(showP) + `<span class="ini">${esc(puz.people[showP].initial)}</span>`; }
      }
      const cl = el.classList;
      cl.toggle('has-token', p != null);
      cl.toggle('victim-here', p != null && isVictim(p));
      cl.toggle('ghost', ghost);
      cl.toggle('has-x', !!G.xm[i] && p == null);
      cl.toggle('shaded', settings.shade && p == null && !ctx.blocked[i] && (rows.has(ctx.rowOf[i]) || cols.has(ctx.colOf[i])));
      cl.toggle('conflict', conflict.has(i));
      cl.toggle('wrong', G.wrongCells.has(i));
      cl.toggle('x-wrong', G.xWrong.has(i));
      cl.toggle('sel-token', p != null && p === G.sel && !G.solved);
      cl.toggle('murderer', G.solved && p === puz.murderer);
      cl.toggle('hl', !!(hl.cells && hl.cells.has(i)));
      cl.toggle('target', hl.target === i);
      cl.toggle('cand', !!(cand && cand.has(i)));
      cl.toggle('roomhl', G.roomHl != null && puz.room[i] === G.roomHl);
      cl.toggle('cursor', i === G.cursor);
      el.tabIndex = i === G.cursor ? 0 : -1;
      const notesEl = el.children[puz.obj[i] ? 1 : 0];
      const m = p == null ? G.notes[i] : 0;
      if (String(m) !== notesEl.dataset.m) {
        notesEl.dataset.m = String(m);
        let h = '';
        for (let q = 0; q < N; q++) {
          if (!((m >> q) & 1)) continue;
          const slot = `grid-area:${Math.floor(q / 3) + 1}/${(q % 3) + 1}`;
          h += isVictim(q) ? `<i style="${slot};--pc:var(--red)">✝</i>` : `<i style="${slot};--pc:var(--p${q % 9})">${esc(puz.people[q].initial)}</i>`;
        }
        notesEl.innerHTML = h;
      }
      let label = `${cellName(i)}, ${roomName(puz.room[i])}`;
      if (puz.obj[i]) label += `, ${objName(puz.obj[i])}`;
      if (p != null) label += `, ${personName(p)}`;
      else if (G.xm[i]) label += ', tachada';
      el.setAttribute('aria-label', label);
    }
    board.classList.toggle('paused', G.paused);
    const veil = $('.pause-veil', board);
    if (G.paused && !veil) board.insertAdjacentHTML('beforeend', '<div class="pause-veil"><div>Pausa<small>Toca el reloj para seguir</small></div></div>');
    if (!G.paused && veil) veil.remove();
    $('#timerBtn').classList.toggle('paused', G.paused);
  }

  function updatePeople() {
    const { puz, N, ctx } = G;
    picker.querySelectorAll('.key').forEach(k => {
      const p = +k.dataset.p;
      k.setAttribute('aria-pressed', String(G.sel === p));
      k.classList.toggle('placed', G.pos[p] >= 0);
    });
    const hintP = G.hint && G.hint.type === 'place' && G.hintStage >= 1 ? G.hint.p : -1;
    peopleEl.querySelectorAll('.pcard').forEach(card => {
      const p = +card.dataset.p;
      card.setAttribute('aria-pressed', String(G.sel === p));
      card.classList.toggle('hinted', p === hintP && G.sel !== p);
      const loc = card.querySelector('.loc');
      loc.textContent = G.pos[p] >= 0 ? cellName(G.pos[p]) : '—';
      loc.classList.toggle('on', G.pos[p] >= 0);
    });
    document.querySelectorAll('.clues li[data-k]').forEach(li => {
      const v = E.evalClue(ctx, +li.dataset.k, G.pos);
      li.classList.toggle('ok', v === true);
      li.classList.toggle('bad', v === false);
    });
    const mli = document.querySelector('li[data-rule="murder"]');
    if (mli) {
      let v = null;
      const vp = G.pos[N - 1];
      if (vp >= 0) {
        let inRoom = 0, unknown = 0;
        for (let s = 0; s < N - 1; s++) {
          if (G.pos[s] < 0) unknown++;
          else if (puz.room[G.pos[s]] === puz.room[vp]) inRoom++;
        }
        if (inRoom > 1 || (!unknown && inRoom === 0)) v = false;
        else if (!unknown && inRoom === 1) v = true;
      }
      mli.classList.toggle('ok', v === true);
      mli.classList.toggle('bad', v === false);
    }
  }

  function updateStatus() {
    const placed = G.pos.filter(i => i >= 0).length;
    $('#progressText').textContent = `${placed} de ${G.N} en el plano`;
    let txt;
    if (hoverCell >= 0) {
      const i = hoverCell, o = G.puz.obj[i];
      txt = `<b>${cellName(i)}</b> · ${esc(roomName(G.puz.room[i]))} · ` +
        (o ? (E.OBJ[o].occ ? `${esc(cap(objName(o)))}, aquí se puede estar` : `${esc(cap(objName(o)))}, aquí no cabe nadie`) : 'suelo');
    } else if (G.solved) {
      txt = G.revealed ? 'Te rendiste. Así estaban todos.' : `Caso cerrado: fue <b>${esc(personName(G.puz.murderer))}</b>.`;
    } else if (G.sel != null) {
      txt = G.mode === 'place' ? `¿Dónde estaba <b>${esc(personName(G.sel))}</b>? Toca una casilla.`
        : G.mode === 'note' ? `Apunta dónde podría estar <b>${esc(personName(G.sel))}</b>.`
          : 'Tacha las casillas donde seguro que no había nadie.';
    } else {
      txt = G.mode === 'x' ? 'Tacha las casillas donde seguro que no había nadie.' : 'Elige a alguien abajo y tócale un sitio en el plano.';
    }
    $('#statusText').innerHTML = txt;
    legendEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.room === G.roomHl)));
  }

  function updateControls() {
    $('#undoBtn').disabled = !G.history.length || G.solved;
    $('#redoBtn').disabled = !G.future.length || G.solved;
    $('#hintBtn').disabled = G.solved;
    $('#checkBtn').disabled = G.solved;
    $('#accuseBtn').disabled = !G.pos.every(i => i >= 0) || G.solved;
    const badge = $('#hintBadge');
    badge.hidden = !G.hints;
    badge.textContent = G.hints;
    const d = E.DIFF[G.diff];
    $('#caseStats').innerHTML = `<span><b>${G.N}×${G.N}</b></span><span>${d.label}</span>` +
      `<span>Pistas <b>${G.hints + G.checks}</b></span><span>Fallos <b>${G.mistakes}</b></span>`;
    $('#timer').textContent = fmtTime(G.elapsed);
  }

  function updateAll() {
    if (!G) return;
    updateBoard(); updatePeople(); updateStatus(); updateControls();
  }

  /* ---------- Historial ---------- */
  const snap = () => JSON.stringify([G.pos, Array.from(G.xm), Array.from(G.notes)]);
  function restore(s) {
    const [pos, xm, notes] = JSON.parse(s);
    G.pos = pos; G.xm = Uint8Array.from(xm); G.notes = Uint16Array.from(notes);
  }
  function commit(fn) {
    if (!G || G.solved) return false;
    const before = snap();
    fn();
    if (snap() === before) return false;
    G.history.push(before);
    if (G.history.length > 400) G.history.shift();
    G.future = [];
    afterChange();
    return true;
  }
  function afterChange() {
    G.wrongCells.clear(); G.xWrong.clear();
    if (!G.started) {
      G.started = true;
      const st = store.get('stats', {});
      const s = st[G.diff] || (st[G.diff] = { played: 0, won: 0, best: 0, total: 0, perfect: 0 });
      s.played++;
      store.set('stats', st);
    }
    if (G.hint && G.hint.type === 'place' && G.pos[G.hint.p] === G.hint.cell) closeHint();
    saveGame();
    updateAll();
    checkComplete();
  }
  function undo() {
    if (!G || !G.history.length || G.solved) return;
    G.future.push(snap());
    restore(G.history.pop());
    beep('undo');
    afterChange();
  }
  function redo() {
    if (!G || !G.future.length || G.solved) return;
    G.history.push(snap());
    restore(G.future.pop());
    beep('undo');
    afterChange();
  }

  /* ---------- Acciones sobre el plano ---------- */
  function select(p) {
    if (!G) return;
    G.sel = G.sel === p ? null : p;
    updateAll();
  }
  function setMode(m) {
    if (G) G.mode = m;
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    if (G) updateAll();
  }
  function nudgePicker() {
    picker.classList.remove('nudge');
    void picker.offsetWidth;
    picker.classList.add('nudge');
  }
  function shakeCell(i) {
    cells[i].animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 300 });
  }

  function cellAction(i) {
    if (!G || G.solved || G.paused) return;
    G.cursor = i;
    if (G.mode === 'x') return toggleX(i);
    if (G.mode === 'note') return toggleNote(i);
    place(i);
  }
  function place(i) {
    const occP = G.pos.indexOf(i);
    if (G.sel == null) {
      if (occP >= 0) { select(occP); beep('lift'); }
      else { nudgePicker(); toast('Primero elige a alguien en el teclado de abajo.'); updateAll(); }
      return;
    }
    if (G.ctx.blocked[i]) {
      beep('err'); shakeCell(i);
      toast(`¡Eh! Nadie se sube encima de ${indef(G.puz.obj[i])}.`);
      return;
    }
    const s = G.sel;
    const removing = G.pos[s] === i;
    commit(() => {
      if (removing) G.pos[s] = -1;
      else { if (occP >= 0) G.pos[occP] = -1; G.pos[s] = i; G.xm[i] = 0; }
    });
    beep(removing ? 'lift' : 'place');
  }
  function toggleX(i) {
    if (!G || G.solved || G.paused) return;
    if (G.ctx.blocked[i] || G.pos.indexOf(i) >= 0) return;
    commit(() => { G.xm[i] ^= 1; });
    beep('x');
  }
  function toggleNote(i) {
    if (G.sel == null) { nudgePicker(); toast('Elige a quién quieres apuntar.'); return; }
    if (G.ctx.blocked[i] || G.pos.indexOf(i) >= 0) return;
    const s = G.sel;
    commit(() => { G.notes[i] ^= 1 << s; });
    beep('note');
  }
  function clearCell(i) {
    const occP = G.pos.indexOf(i);
    commit(() => { if (occP >= 0) G.pos[occP] = -1; G.xm[i] = 0; G.notes[i] = 0; });
  }

  function isCorrect() { return G.pos.every((i, p) => i === G.puz.solution[p]); }
  function checkComplete() {
    if (G.solved || !G.pos.every(i => i >= 0)) { G.completeWarned = ''; return; }
    const key = G.pos.join(',');
    if (G.completeWarned === key) return;
    G.completeWarned = key;
    if (isCorrect()) setTimeout(() => openAccuse(true), 450);
    else toast('Ya están todos… pero algo no cuadra con lo que dicen.', 3000);
  }

  /* Eventos del plano */
  let pressTimer = null, longFired = false;
  board.addEventListener('pointerdown', e => {
    const c = e.target.closest('.cell');
    if (!c) return;
    longFired = false;
    if (e.pointerType !== 'mouse') {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longFired = true;
        toggleX(+c.dataset.i);
        try { navigator.vibrate && navigator.vibrate(15); } catch (err) { /* nada */ }
      }, 430);
    }
  });
  ['pointerup', 'pointercancel'].forEach(t => board.addEventListener(t, () => clearTimeout(pressTimer)));
  board.addEventListener('click', e => {
    const c = e.target.closest('.cell');
    if (!c) return;
    if (longFired) { longFired = false; return; }
    document.body.classList.remove('kbd');
    cellAction(+c.dataset.i);
  });
  board.addEventListener('contextmenu', e => {
    const c = e.target.closest('.cell');
    if (!c) return;
    e.preventDefault();
    clearTimeout(pressTimer);
    if (!longFired) toggleX(+c.dataset.i);
  });
  board.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest('.cell');
    const i = c ? +c.dataset.i : -1;
    if (i !== hoverCell) { hoverCell = i; if (G) { updateBoard(); updateStatus(); } }
  });
  board.addEventListener('pointerleave', () => {
    clearTimeout(pressTimer);
    if (hoverCell !== -1) { hoverCell = -1; if (G) { updateBoard(); updateStatus(); } }
  });

  picker.addEventListener('click', e => {
    const k = e.target.closest('.key');
    if (k) select(+k.dataset.p);
  });
  peopleEl.addEventListener('click', e => {
    const card = e.target.closest('.pcard');
    if (card) select(+card.dataset.p);
  });
  peopleEl.addEventListener('keydown', e => {
    const card = e.target.closest('.pcard');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+card.dataset.p); }
  });
  legendEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !G) return;
    const k = +b.dataset.room;
    G.roomHl = G.roomHl === k ? null : k;
    updateAll();
  });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#hintBtn').addEventListener('click', requestHint);
  $('#checkBtn').addEventListener('click', checkBoard);
  $('#accuseBtn').addEventListener('click', () => openAccuse(false));
  $('#newBtn').addEventListener('click', openNewGame);
  $('#statsBtn').addEventListener('click', () => openStats(false));
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#helpBtn').addEventListener('click', openHelp);
  $('#timerBtn').addEventListener('click', togglePause);

  const moreBtn = $('#moreBtn'), moreMenu = $('#moreMenu');
  moreBtn.addEventListener('click', e => {
    e.stopPropagation();
    moreMenu.hidden = !moreMenu.hidden;
    moreBtn.setAttribute('aria-expanded', String(!moreMenu.hidden));
  });
  document.addEventListener('click', e => {
    if (!moreMenu.hidden && !moreMenu.contains(e.target)) { moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); }
  });
  moreMenu.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !G) return;
    moreMenu.hidden = true;
    const act = b.dataset.act;
    if (act === 'copy') copyText(G.code, `Código ${G.code} copiado. Quien lo abra jugará este mismo caso.`);
    else if (act === 'clearx') commit(() => { G.xm.fill(0); G.notes.fill(0); });
    else if (act === 'reset') confirmModal('¿Empezar de cero?', 'Se vacía el plano. El reloj y las pistas que llevas se quedan como están.', 'Vaciar el plano', () => {
      if (G.revealed) { G.revealed = false; G.solved = false; G.pos.fill(-1); G.history = []; saveGame(); updateAll(); return; }
      if (G.solved) return;
      commit(() => { G.pos.fill(-1); G.xm.fill(0); G.notes.fill(0); });
    });
    else if (act === 'reveal') {
      if (G.solved) { toast('Este caso ya está cerrado.'); return; }
      confirmModal('¿Te rindes?', 'Verás dónde estaba cada uno y quién lo hizo. El caso no contará como resuelto.', 'Sí, ¿quién fue?', reveal, true);
    }
  });

  function copyText(text, okMsg) {
    const fallback = () => openModal(`${closeBtn()}<h2>Cópialo a mano</h2>
      <textarea id="copyArea" readonly rows="${Math.min(14, text.split('\n').length + 1)}" style="width:100%;font:600 14px/1.4 var(--font-ui);padding:10px;border-radius:4px;border:0;box-shadow:inset 0 0 0 1.5px var(--line);background:var(--bg);color:var(--fg);resize:none">${esc(text)}</textarea>`,
    m => { const a = $('#copyArea', m); a.focus(); a.select(); });
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback); } catch (e) { fallback(); }
  }

  /* ---------- Pausa y reloj ---------- */
  function togglePause() {
    if (!G || G.solved) return;
    G.paused = !G.paused;
    updateAll();
  }
  setInterval(() => {
    if (!G || G.solved || G.paused || !G.started || modalDepth > 0 || document.visibilityState !== 'visible') return;
    G.elapsed++;
    $('#timer').textContent = fmtTime(G.elapsed);
    if (G.elapsed % 5 === 0) saveGame();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') saveGame(); });
  window.addEventListener('pagehide', saveGame);

  /* ---------- Comprobar, pistas, solución ---------- */
  function checkBoard() {
    if (!G || G.solved) return;
    G.checks++;
    G.wrongCells = new Set(); G.xWrong = new Set();
    G.pos.forEach((i, p) => { if (i >= 0 && i !== G.puz.solution[p]) G.wrongCells.add(i); });
    const sol = new Set(G.puz.solution);
    G.xm.forEach((v, i) => { if (v && sol.has(i)) G.xWrong.add(i); });
    const n = G.wrongCells.size + G.xWrong.size;
    if (!n) { toast('¡Todo bien hasta ahora!'); beep('hint'); }
    else { toast(n === 1 ? 'Hay una cosa que no cuadra. Te la marco en rojo.' : `Hay ${n} cosas que no cuadran. Te las marco en rojo.`, 3000); beep('err'); }
    saveGame();
    updateAll();
  }

  async function requestHint() {
    if (!G || G.solved) return;
    if (G.paused) togglePause();
    const btn = $('#hintBtn');
    btn.disabled = true;
    let h;
    try { h = (await call({ type: 'hint', puzzle: G.puz, pos: G.pos })).hint; } catch (e) { h = { type: 'none' }; }
    btn.disabled = false;
    G.hint = h;
    G.hints++;
    beep('hint');
    if (h.type === 'place') { G.hintStage = 1; G.sel = null; }
    renderHint();
    saveGame();
    updateAll();
  }
  function closeHint() {
    if (!G) { hintPanel.hidden = true; return; }
    G.hint = null; G.hintStage = 0; G.hl = null;
    hintPanel.hidden = true;
    hintPanel.innerHTML = '';
    updateAll();
  }
  function renderHint() {
    const h = G.hint;
    if (!h) return closeHint();
    const head = `<h3><svg aria-hidden="true"><use href="#i-bulb"/></svg>Pista</h3>`;
    let body = '', actions = '';
    G.hl = null;
    if (h.type === 'wrong') {
      const names = h.persons.map(p => personName(p));
      body = `<p>${h.persons.length === 1 ? `Ojo: ${esc(names[0])} no está donde debería.` : `Ojo: hay ${h.persons.length} personas mal puestas (${esc(names.join(', '))}).`} Vuelve a leer lo que dicen.</p>`;
      actions = `<button class="btn dark" data-h="remove">Quitar${h.persons.length === 1 ? 'la' : 'las'}</button><button class="btn ghost" data-h="close">Vale</button>`;
      G.hl = { cells: new Set(h.persons.map(p => G.pos[p])) };
    } else if (h.type === 'place') {
      if (G.hintStage === 1) {
        body = `<p>Psst… fíjate en <b>${esc(personName(h.p))}</b>. ${esc(h.nudge || '')}</p>`;
        actions = `<button class="btn dark" data-h="explain">Explícamelo</button><button class="btn ghost" data-h="close">Vale, lo intento</button>`;
      } else {
        const steps = h.steps.slice(-12);
        const skipped = h.steps.length - steps.length;
        body = `<p>Así se deduce dónde estaba <b>${esc(personName(h.p))}</b>${skipped ? ` (después de ${skipped} pasos más sencillos)` : ''}:</p><ol>` +
          steps.map(s => `<li>${esc(s.text)}</li>`).join('') +
          `<li><b>${esc(personName(h.p, true))} estaba en ${cellName(h.cell)}.</b></li></ol>`;
        actions = `<button class="btn green" data-h="place">Colócalo tú</button><button class="btn ghost" data-h="close">Ya lo pongo yo</button>`;
        const last = h.steps[h.steps.length - 1];
        G.hl = { cells: new Set(last && last.focusCells ? last.focusCells : []), target: h.cell };
      }
    } else {
      body = '<p>Desde aquí no veo nada nuevo. ¿Alguna declaración tiene una ✕ roja?</p>';
      actions = '<button class="btn ghost" data-h="close">Vale</button>';
    }
    hintPanel.innerHTML = head + body + `<div class="actions">${actions}</div>`;
    hintPanel.hidden = false;
    updateAll();
    try { hintPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* nada */ }
  }
  // en pantallas anchas la pista va en la columna del caso, para que el plano no se mueva
  const mqWide = window.matchMedia('(min-width: 980px)');
  function placeHintPanel() {
    if (mqWide.matches) $('.side').prepend(hintPanel);
    else $('.play').insertBefore(hintPanel, $('.plan-frame'));
  }
  if (mqWide.addEventListener) mqWide.addEventListener('change', placeHintPanel);
  placeHintPanel();

  hintPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-h]');
    if (!b || !G || !G.hint) return;
    const act = b.dataset.h, h = G.hint;
    if (act === 'close') return closeHint();
    if (act === 'explain') { G.hintStage = 2; renderHint(); return; }
    if (act === 'place') {
      G.hints++;
      const { p, cell } = h;
      closeHint();
      commit(() => { const o = G.pos.indexOf(cell); if (o >= 0) G.pos[o] = -1; G.pos[p] = cell; G.xm[cell] = 0; });
      beep('place');
      return;
    }
    if (act === 'remove') {
      const ps = h.persons;
      closeHint();
      commit(() => ps.forEach(p => (G.pos[p] = -1)));
    }
  });

  function reveal() {
    closeHint();
    G.history.push(snap());
    G.pos = G.puz.solution.slice();
    G.revealed = true; G.solved = true; G.sel = null;
    saveGame();
    updateAll();
    toast(`Fue ${personName(G.puz.murderer)}.`, 3500);
  }

  /* ---------- Ventanas ---------- */
  const closeBtn = () => `<button class="icon-btn x" data-close aria-label="Cerrar"><svg><use href="#i-close"/></svg></button>`;
  function openModal(html, onMount, onClose) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const prevFocus = document.activeElement;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      ov.remove(); modalDepth--;
      document.removeEventListener('keydown', onKey, true);
      if (onClose) onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey, true);
    $('#modalRoot').appendChild(ov);
    modalDepth++;
    const m = ov.firstElementChild;
    if (onMount) onMount(m, close);
    const f = m.querySelector('[autofocus]') || m.querySelector('button:not([data-close]), input');
    if (f) f.focus({ preventScroll: true });
    return close;
  }
  function confirmModal(title, text, okLabel, onOk, danger) {
    openModal(`${closeBtn()}<h2>${esc(title)}</h2><p class="muted center">${esc(text)}</p>
      <div class="modal-foot"><button class="btn ghost" data-close>Mejor no</button><button class="btn ${danger ? 'red' : 'dark'}" data-ok autofocus>${esc(okLabel)}</button></div>`,
    (m, close) => { $('[data-ok]', m).addEventListener('click', () => { close(); onOk(); }); });
  }

  function openNewGame() {
    const stats = store.get('stats', {});
    const today = new Date();
    const dCode = dailyCode(today);
    const dInfo = parseCode(dCode);
    const dSaved = store.get('g:' + dCode, null);
    const dDone = dSaved && dSaved.solved && !dSaved.revealed;
    const dateTxt = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const dd = E.DIFF[dInfo.diff];
    openModal(`
      ${closeBtn()}<h2>Nuevo caso</h2>
      <button class="daily-row" data-daily type="button">
        <svg aria-hidden="true"><use href="#i-cal"/></svg>
        <div><div class="dname">Caso del día${dDone ? ' ✓' : ''}</div><small>${esc(cap(dateTxt))} · ${dd.label} ${dd.N}×${dd.N} · el mismo para todo el mundo</small></div>
      </button>
      <h3>O elige dificultad</h3>
      <div class="diff-list">${DIFFS.map(k => {
        const d = E.DIFF[k], s = stats[k];
        return `<button class="diff-row" type="button" data-diff="${k}">
          <span class="tile" style="background:${DIFF_TILE[k]}">${d.N}×${d.N}</span>
          <span><span class="dname">${d.label}</span><br><span class="ddesc">${DESC[k]}</span></span>
          <span class="dbest">${s && s.best ? 'Récord<br>' + fmtTime(s.best) : ''}</span>
        </button>`;
      }).join('')}</div>
      <h3>¿Te han pasado un código?</h3>
      <form class="code-row" id="codeForm">
        <label class="sr-only" for="codeInput">Código del caso</label>
        <input id="codeInput" placeholder="N-K7Q2MX" autocomplete="off" spellcheck="false">
        <button class="btn dark" type="submit">Abrir</button>
      </form>
      <p class="muted" style="font-size:13px">El de este caso es <b>${esc(G ? G.code : '')}</b>. Pásalo y jugaréis exactamente el mismo.</p>
    `, (m, close) => {
      $('[data-daily]', m).addEventListener('click', () => { close(); loadGame(dCode); });
      m.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { close(); loadGame(randomCode(b.dataset.diff)); }));
      $('#codeForm', m).addEventListener('submit', e => {
        e.preventDefault();
        const v = $('#codeInput', m).value;
        if (!parseCode(v)) { toast('Ese código no vale. Tiene esta pinta: N-K7Q2MX'); return; }
        close(); loadGame(v);
      });
    });
  }

  function openAccuse(auto) {
    if (!G || G.solved) return;
    if (!G.pos.every(i => i >= 0)) { toast('Antes pon a todo el mundo en el plano.'); return; }
    let choice = null;
    const N = G.N;
    openModal(`
      ${closeBtn()}<h2>${auto ? '¡Todo encaja! ¿Quién ha sido?' : '¿Quién ha sido?'}</h2>
      <p class="muted center">Fue quien estuvo a solas con ${esc(personName(N - 1))} en la misma habitación.</p>
      <div class="suspect-pick">${G.puz.people.slice(0, N - 1).map((pe, p) =>
        `<button type="button" data-s="${p}" aria-pressed="false"><span class="sface" style="--pc:var(--p${p % 9})">${faceOf(p)}</span>${esc(pe.name)}</button>`).join('')}</div>
      <div class="modal-foot"><button class="btn ghost" data-close>Aún no</button><button class="btn red" data-go disabled><svg><use href="#i-gavel"/></svg>Acusar</button></div>
    `, (m, close) => {
      const go = $('[data-go]', m);
      m.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
        choice = +b.dataset.s;
        m.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        go.disabled = false;
        go.innerHTML = `<svg><use href="#i-gavel"/></svg>¡Fue ${esc(G.puz.people[choice].name)}!`;
      }));
      go.addEventListener('click', () => {
        if (choice == null) return;
        close();
        if (!isCorrect()) {
          G.mistakes++; beep('wrong'); saveGame(); updateAll();
          toast('Antes de acusar, revisa el plano: hay algo mal puesto.', 3200);
        } else if (choice !== G.puz.murderer) {
          G.mistakes++; beep('wrong'); saveGame(); updateAll();
          toast(`${G.puz.people[choice].name} tiene coartada. ¡Prueba otra vez!`, 3200);
        } else win();
      });
    });
  }

  function computeStars() {
    const used = G.hints + G.checks;
    if (used === 0 && G.mistakes === 0) return 3;
    if (used <= 2 && G.mistakes <= 1) return 2;
    return 1;
  }
  function win() {
    closeHint();
    G.solved = true; G.sel = null; G.paused = false;
    const stars = computeStars();
    G.stars = stars;
    const st = store.get('stats', {});
    const s = st[G.diff] || (st[G.diff] = { played: 1, won: 0, best: 0, total: 0, perfect: 0 });
    s.won++; s.total += G.elapsed;
    G.record = !s.best || G.elapsed < s.best;
    if (G.record) s.best = G.elapsed;
    if (stars === 3) s.perfect++;
    store.set('stats', st);
    const dist = store.get('stars', { 1: 0, 2: 0, 3: 0 });
    dist[stars] = (dist[stars] || 0) + 1;
    store.set('stars', dist);
    if (G.daily && G.code === dailyCode()) {
      const d = store.get('daily', { last: '', streak: 0, best: 0 });
      const today = todayStr();
      if (d.last !== today) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        d.streak = d.last === todayStr(y) ? d.streak + 1 : 1;
        d.best = Math.max(d.best, d.streak);
        d.last = today;
        store.set('daily', d);
      }
    }
    saveGame();
    updateAll();
    beep('win');
    board.classList.add('win');
    setTimeout(() => board.classList.remove('win'), 1800);
    G.praise = pick(PRAISE[stars]);
    toast(G.praise, 1700);
    setTimeout(() => { confetti(); openStats(true); }, 1500);
  }

  function shareText() {
    const d = E.DIFF[G.diff];
    const now = new Date();
    const label = G.daily ? `Caso del día ${pad(now.getDate())}/${pad(now.getMonth() + 1)}` : `Caso ${G.code}`;
    const { N, puz, ctx } = G;
    let grid = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        grid += ctx.blocked[i] ? '⬛' : ROOM_EMOJI[puz.rooms[puz.room[i]].color % 8];
      }
      grid += '\n';
    }
    const used = G.hints + G.checks;
    return `Murdoku · ${label} · ${d.label}\n⏱ ${fmtTime(G.elapsed)} ${'⭐'.repeat(G.stars || 1)}${used ? ` 💡${used}` : ''}\n${grid.trim()}`;
  }

  function openStats(result) {
    const st = store.get('stats', {});
    const d = store.get('daily', { last: '', streak: 0, best: 0 });
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = d.last === todayStr() || d.last === todayStr(y) ? d.streak : 0;
    let played = 0, won = 0;
    DIFFS.forEach(k => { if (st[k]) { played += st[k].played; won += st[k].won; } });
    const dist = store.get('stars', { 1: 0, 2: 0, 3: 0 });
    const max = Math.max(1, dist[1] || 0, dist[2] || 0, dist[3] || 0);
    const showResult = result && G && G.solved && !G.revealed;
    let hero = '';
    if (showResult) {
      const pz = G.puz, N = G.N;
      const room = pz.rooms[pz.room[pz.solution[N - 1]]];
      hero = `<div class="result-hero">
        <h2 class="big">${esc(G.praise || pick(PRAISE[G.stars || 1]))}</h2>
        <div class="who">${avatarHTML(pz.murderer)}
          <span><b>${esc(personName(pz.murderer, true))}</b> estuvo a solas con ${esc(personName(N - 1))} en ${esc(room.art + ' ' + room.name)}.</span></div>
        <p class="muted">${fmtTime(G.elapsed)}${G.record ? ' (¡récord!)' : ''} · ${G.hints + G.checks} pistas · ${G.mistakes} fallos</p>
      </div>`;
    }
    const dailyNext = showResult ? `<div class="result-foot">
        <div class="next"><span>Siguiente caso del día</span><b id="countdown">--:--:--</b></div>
        <div><button class="btn green pill" data-share type="button">Compartir <svg><use href="#i-share"/></svg></button></div>
      </div>` : '';
    let tick = null;
    openModal(`
      ${closeBtn()}${hero}
      <h2>Estadísticas</h2>
      <div class="statrow">
        <div><b>${played}</b><span>Jugados</span></div>
        <div><b>${played ? Math.round((won / played) * 100) : 0}</b><span>% Resueltos</span></div>
        <div><b>${streak}</b><span>Racha diaria</span></div>
        <div><b>${d.best || 0}</b><span>Mejor racha</span></div>
      </div>
      <h2>Tus estrellas</h2>
      <div class="dist">${[3, 2, 1].map(n => `<div class="dist-row"><span class="stars-lbl">${'★'.repeat(n)}</span>
        <span class="bar${showResult && G.stars === n ? ' now' : ''}" style="--w:${Math.max(7, ((dist[n] || 0) / max) * 100)}%">${dist[n] || 0}</span></div>`).join('')}</div>
      <h2>Mejores tiempos</h2>
      <div class="dist">${DIFFS.map(k => {
        const s = st[k];
        return `<div class="dist-row" style="grid-template-columns:90px 1fr"><span>${E.DIFF[k].label}</span><span class="muted" style="font-variant-numeric:tabular-nums">${s && s.best ? fmtTime(s.best) + ` · ${s.won} resuelto${s.won === 1 ? '' : 's'}` : '—'}</span></div>`;
      }).join('')}</div>
      ${dailyNext}
      ${showResult ? '' : '<p class="muted center" style="font-size:12px">Todo se guarda solo en este navegador.</p>'}
    `, m => {
      const sh = $('[data-share]', m);
      if (sh) sh.addEventListener('click', () => copyText(shareText(), 'Resultado copiado. ¡Pégalo donde quieras!'));
      const cd = $('#countdown', m);
      if (cd) {
        const upd = () => {
          const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
          const s = Math.floor((mid - now) / 1000);
          cd.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
        };
        upd(); tick = setInterval(upd, 1000);
      }
    }, () => clearInterval(tick));
  }

  function openSettings() {
    const sw = (id, label, sub) => `<label class="setting"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="switch"><input type="checkbox" id="${id}" ${settings[id] ? 'checked' : ''}><i></i></span></label>`;
    openModal(`
      ${closeBtn()}<h2>Ajustes</h2>
      <div>
        <div class="setting"><span>Tema</span>
          <div class="theme-seg" role="group" aria-label="Tema">${[['system', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) =>
            `<button type="button" data-theme-v="${v}" aria-pressed="${settings.theme === v}">${l}</button>`).join('')}</div></div>
        ${sw('sound', 'Sonidos')}
        ${sw('shade', 'Apagar filas y columnas ocupadas', 'Las casillas donde ya no cabe nadie se ven en gris.')}
        ${sw('status', 'Marcar declaraciones', '✓ verde si se cumple, ✕ roja si no.')}
        ${sw('cands', 'Modo ayuda', 'Al elegir a alguien, marca dónde podría estar según lo que dice.')}
      </div>
    `, m => {
      m.querySelectorAll('[data-theme-v]').forEach(b => b.addEventListener('click', () => {
        settings.theme = b.dataset.themeV;
        m.querySelectorAll('[data-theme-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        saveSettings();
      }));
      ['sound', 'shade', 'status', 'cands'].forEach(id => $('#' + id, m).addEventListener('change', e => { settings[id] = e.target.checked; saveSettings(); }));
    });
  }

  function openHelp() {
    const furn = Object.keys(E.OBJ).map(k => {
      const o = E.OBJ[k];
      return `<div><span class="sw ${o.occ ? '' : 'blocked'}"><svg aria-hidden="true"><use href="#i-${k}"/></svg></span><span>${cap(o.name)}<small>${o.occ ? 'Se puede estar' : 'No cabe nadie'}</small></span></div>`;
    }).join('');
    openModal(`
      ${closeBtn()}<h2>Cómo se juega</h2>
      <p style="font: 400 22px/1.2 var(--font-title)">Alguien ha muerto. Averigua quién lo hizo.</p>
      <ul class="rules">
        <li>Cada <b>fila</b> y cada <b>columna</b> tiene exactamente <b>una persona</b> (la víctima también cuenta).</li>
        <li>Coloca a cada uno según lo que declara. Todo lo que dicen es verdad.</li>
        <li>El asesino es el único que estuvo <b>a solas con la víctima</b> en una habitación.</li>
      </ul>
      <h3>Ejemplos</h3>
      <div class="example"><span style="background:var(--r0)"><svg><use href="#i-silla"/></svg></span><span style="background:var(--p0)">${window.MurdokuFaces.face({ name: 'Adela', g: 'f', role: 'suspect' }, 0)}</span></div>
      <p><b>Adela estaba sentada en una silla</b>: su ficha va en una casilla con silla.</p>
      <div class="example"><span style="background:var(--r1);box-shadow:inset 0 0 0 100vmax var(--block-shade)"><svg><use href="#i-mesa"/></svg></span><span style="background:var(--r1)"><svg style="color:var(--icon)"><use href="#i-x"/></svg></span></div>
      <p>Las casillas oscuras tienen muebles donde <b>no cabe nadie</b>. Tacha con clic derecho (o mantén pulsado en el móvil) lo que vayas descartando.</p>
      <div class="example"><span style="background:var(--victim)">${window.MurdokuFaces.face({ name: 'Conde', g: 'm', role: 'victim' }, 0)}</span><span style="background:var(--red)">${window.MurdokuFaces.face({ name: 'Bruno', g: 'm', role: 'suspect' }, 1)}</span><span style="background:var(--r2)"></span></div>
      <p>Si Bruno es el único que estaba en la habitación de la víctima, <b>fue Bruno</b>.</p>
      <h3>«Junto a», «al norte de»…</h3>
      <p class="muted">«Junto a» es en una casilla pegada (arriba, abajo, izquierda o derecha). «Justo al norte de» es la casilla de encima. «Más al norte que» es cualquier fila más arriba.</p>
      <h3>Muebles</h3>
      <div class="furn">${furn}</div>
      <h3>Atajos</h3>
      <div class="kbd-list">
        <kbd>1–9 · 0</kbd><span>Elegir sospechoso · víctima</span>
        <kbd>Flechas</kbd><span>Mover el cursor. <kbd>Espacio</kbd> colocar, <kbd>X</kbd> tachar, <kbd>N</kbd> apuntar, <kbd>Supr</kbd> vaciar</span>
        <kbd>Ctrl+Z</kbd><span>Deshacer (<kbd>Ctrl+Y</kbd> rehacer) · <kbd>H</kbd> pista</span>
      </div>
      <div class="modal-foot"><button class="btn green pill" data-close autofocus>¡A investigar!</button></div>
    `);
  }

  /* ---------- Teclado ---------- */
  document.addEventListener('keydown', e => {
    if (!G || modalDepth > 0) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
    if (ctrl || e.altKey) return;
    const N = G.N;
    if (/^[0-9]$/.test(k)) {
      const d = +k;
      if (d === 0) select(N - 1);
      else if (d <= N - 1) select(d - 1);
      return;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      document.body.classList.add('kbd');
      const r = Math.floor(G.cursor / N), c = G.cursor % N;
      let nr = r, nc = c;
      if (k === 'ArrowUp') nr = Math.max(0, r - 1);
      if (k === 'ArrowDown') nr = Math.min(N - 1, r + 1);
      if (k === 'ArrowLeft') nc = Math.max(0, c - 1);
      if (k === 'ArrowRight') nc = Math.min(N - 1, c + 1);
      G.cursor = nr * N + nc;
      hoverCell = -1;
      updateBoard();
      cells[G.cursor].focus({ preventScroll: true });
      return;
    }
    const onCell = t && t.classList && t.classList.contains('cell');
    const onBoard = document.body.classList.contains('kbd') || onCell;
    if ((k === ' ' || k === 'Enter') && onCell) { e.preventDefault(); document.body.classList.add('kbd'); cellAction(G.cursor); return; }
    if (k === 'x' || k === 'X') { if (onBoard) toggleX(G.cursor); return; }
    if (k === 'n' || k === 'N') { if (onBoard && !G.solved) toggleNote(G.cursor); else setMode('note'); return; }
    if (k === 'p' || k === 'P') { setMode('place'); return; }
    if (k === 'm' || k === 'M') { const ms = ['place', 'x', 'note']; setMode(ms[(ms.indexOf(G.mode) + 1) % 3]); return; }
    if ((k === 'Backspace' || k === 'Delete') && onBoard) { e.preventDefault(); clearCell(G.cursor); return; }
    if (k === 'h' || k === 'H') { requestHint(); return; }
    if (k === 'Escape') { if (!hintPanel.hidden) closeHint(); else if (G.sel != null) select(G.sel); else if (G.roomHl != null) { G.roomHl = null; updateAll(); } }
  });
  board.addEventListener('focusin', e => {
    const c = e.target.closest('.cell');
    if (c && G) G.cursor = +c.dataset.i;
  });

  /* ---------- Confeti ---------- */
  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cx = cv.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const cols = ['--green', '--yellow', '--p2', '--p3', '--p4', '--p5'].map(v => css.getPropertyValue(v).trim() || '#6aaa64');
    const parts = Array.from({ length: 150 }, () => ({
      x: Math.random() * W, y: -20 * dpr - Math.random() * H * .4,
      vx: (Math.random() - .5) * 4 * dpr, vy: (Math.random() * 3 + 2) * dpr,
      s: (6 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3,
      c: cols[Math.floor(Math.random() * cols.length)]
    }));
    const t0 = performance.now();
    (function frame(t) {
      const el = t - t0;
      cx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += .06 * dpr; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.globalAlpha = Math.max(0, 1 - Math.max(0, el - 2200) / 1000);
        cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        cx.restore();
      }
      if (el < 3200) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* ---------- Arranque ---------- */
  applyTheme();
  const last = store.get('last', null);
  const savedLast = last && store.get('g:' + last, null);
  if (savedLast && !savedLast.solved && parseCode(last)) loadGame(last);
  else loadGame(dailyCode());
  if (!store.get('seenHelp', false)) { store.set('seenHelp', true); setTimeout(openHelp, 500); }
})();
