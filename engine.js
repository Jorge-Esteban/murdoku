/* Murdoku · motor del juego
 * Genera planos, coloca a las personas, redacta pistas y resuelve por lógica
 * (el mismo razonador sirve para graduar la dificultad y para dar pistas). */
(function (root) {
  'use strict';

  function createEngine() {
    const LETTERS = 'ABCDEFGHI';

    /* ---------- Azar con semilla ---------- */
    function hashSeed(s) {
      let h = 1779033703 ^ s.length;
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    }
    function makeRng(seed) {
      let a = hashSeed(String(seed));
      const next = () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return {
        next,
        int: n => Math.floor(next() * n),
        pick: arr => arr[Math.floor(next() * arr.length)],
        shuffle(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
          }
          return arr;
        },
        weighted(items, w) {
          let s = 0;
          const ws = items.map(x => { const v = Math.max(0, w(x)); s += v; return v; });
          if (s <= 0) return null;
          let t = next() * s;
          for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; }
          return items[items.length - 1];
        }
      };
    }

    /* ---------- Datos del mundo ---------- */
    const OBJ = {
      silla:      { name: 'silla',      g: 'f', occ: true,  on: a => `sentad${a} en una silla` },
      sofa:       { name: 'sofá',       g: 'm', occ: true,  on: a => `sentad${a} en un sofá` },
      cama:       { name: 'cama',       g: 'f', occ: true,  on: a => `tumbad${a} en una cama` },
      alfombra:   { name: 'alfombra',   g: 'f', occ: true,  on: () => 'de pie sobre una alfombra' },
      mesa:       { name: 'mesa',       g: 'f', occ: false },
      planta:     { name: 'planta',     g: 'f', occ: false },
      estanteria: { name: 'estantería', g: 'f', occ: false },
      piano:      { name: 'piano',      g: 'm', occ: false },
      banera:     { name: 'bañera',     g: 'f', occ: false }
    };
    const indef = o => (OBJ[o].g === 'f' ? 'una ' : 'un ') + OBJ[o].name;

    const ROOM_TYPES = [
      { key: 'cocina',      name: 'Cocina',            art: 'la', objs: { mesa: 3, silla: 3, planta: 1 } },
      { key: 'comedor',     name: 'Comedor',           art: 'el', objs: { mesa: 3, silla: 4, planta: 1 } },
      { key: 'salon',       name: 'Salón',             art: 'el', objs: { sofa: 3, alfombra: 2, piano: 1, planta: 1 } },
      { key: 'dormitorio',  name: 'Dormitorio',        art: 'el', objs: { cama: 3, alfombra: 1, estanteria: 1, planta: 1 } },
      { key: 'bano',        name: 'Baño',              art: 'el', objs: { banera: 3, planta: 1, alfombra: 2 } },
      { key: 'biblioteca',  name: 'Biblioteca',        art: 'la', objs: { estanteria: 4, silla: 2, alfombra: 1, sofa: 1 } },
      { key: 'estudio',     name: 'Estudio',           art: 'el', objs: { mesa: 2, silla: 2, estanteria: 2 } },
      { key: 'invernadero', name: 'Invernadero',       art: 'el', objs: { planta: 5, silla: 2 } },
      { key: 'vestibulo',   name: 'Vestíbulo',         art: 'el', objs: { alfombra: 3, planta: 2, sofa: 1 } },
      { key: 'musica',      name: 'Sala de música',    art: 'la', objs: { piano: 2, silla: 3, alfombra: 1 } },
      { key: 'suite',       name: 'Suite',             art: 'la', objs: { cama: 3, sofa: 1, planta: 1, banera: 1 } },
      { key: 'despensa',    name: 'Despensa',          art: 'la', objs: { estanteria: 3, mesa: 1 } }
    ];

    const SUSPECTS = [
      ['Adela', 'f'], ['Bruno', 'm'], ['Celia', 'f'], ['Darío', 'm'], ['Elvira', 'f'], ['Fermín', 'm'],
      ['Greta', 'f'], ['Hugo', 'm'], ['Inés', 'f'], ['Julián', 'm'], ['Lola', 'f'], ['Mateo', 'm'],
      ['Noelia', 'f'], ['Óscar', 'm'], ['Paula', 'f'], ['Rodrigo', 'm'], ['Sara', 'f'], ['Tomás', 'm'],
      ['Vera', 'f'], ['Leandro', 'm'], ['Marina', 'f'], ['Ramiro', 'm'], ['Olga', 'f'], ['Gael', 'm'],
      ['Ruth', 'f'], ['Simón', 'm'], ['Clemente', 'm'], ['Beatriz', 'f'], ['Ernesto', 'm'], ['Nuria', 'f'],
      ['Ulises', 'm'], ['Ivana', 'f'], ['Kevin', 'm'], ['Zoe', 'f'], ['Wilfredo', 'm'], ['Yolanda', 'f']
    ];
    const VICTIMS = [
      { name: 'Conde Valverde', art: 'el', g: 'm' }, { name: 'Baronesa Montalbán', art: 'la', g: 'f' },
      { name: 'Doctor Saavedra', art: 'el', g: 'm' }, { name: 'Marquesa de Lis', art: 'la', g: 'f' },
      { name: 'Don Aurelio Quintana', art: '', g: 'm' }, { name: 'Doña Remedios Cifuentes', art: '', g: 'f' },
      { name: 'Comodoro Ibarra', art: 'el', g: 'm' }, { name: 'Duquesa de Alhama', art: 'la', g: 'f' },
      { name: 'Profesor Lindqvist', art: 'el', g: 'm' }, { name: 'Señora Bellamy', art: 'la', g: 'f' },
      { name: 'Notario Gálvez', art: 'el', g: 'm' }, { name: 'Condesa de Arnedo', art: 'la', g: 'f' }
    ];
    const MANSIONS = ['Villa Corvina', 'la Mansión Altamira', 'Casa Valdemar', 'la Finca Los Cipreses',
      'el Palacete Montenegro', 'la Quinta del Ciervo', 'la Hacienda San Telmo', 'el Castillo de Peñagrís',
      'Villa Salinas', 'el Caserón de Brumal', 'la Torre de Hierro Viejo', 'el Pazo de las Lilas'];
    const EVENTS = ['la cena de aniversario', 'una noche de tormenta', 'la lectura del testamento',
      'el baile de máscaras', 'la fiesta de fin de año', 'una partida de bridge', 'la cacería de otoño',
      'la presentación de un cuadro robado', 'una velada de espiritismo', 'el banquete de bodas'];
    const NUM = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const NUMM = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const DIRN = { N: 'norte', S: 'sur', E: 'este', W: 'oeste' };

    const DIFF = {
      facil:   { key: 'facil',   label: 'Fácil',   N: 5, rooms: [4, 4], maxLevel: 2, minLevel: 1, attempts: 4, density: 0.44, pref: 'strong',
                 w: { room: 5, notroom: 1, on: 4, floor: 1.5, adj: 2.5, dir: 1.5, corner: 1, edge: 1, inner: 0.6, row: 2, col: 2, same: 1, diff: 0.4, north: 0.6, west: 0.6, alone: 1, count: 1 } },
      normal:  { key: 'normal',  label: 'Normal',  N: 6, rooms: [5, 5], maxLevel: 3, minLevel: 2, attempts: 4, density: 0.44, pref: 'mid',
                 w: { room: 4, notroom: 1.5, on: 3, floor: 1.5, adj: 3, dir: 2, corner: 1, edge: 1, inner: 1, row: 0.6, col: 0.6, same: 1.5, diff: 0.8, north: 1, west: 1, alone: 1.2, count: 1.2 } },
      dificil: { key: 'dificil', label: 'Difícil', N: 7, rooms: [5, 6], maxLevel: 3, minLevel: 3, attempts: 5, density: 0.42, pref: 'weak',
                 w: { room: 3, notroom: 2, on: 2.5, floor: 1.5, adj: 3, dir: 2.5, corner: 1, edge: 1.2, inner: 1.2, row: 0, col: 0, same: 2, diff: 1, north: 1.5, west: 1.5, alone: 1.5, count: 1.5 } },
      experto: { key: 'experto', label: 'Experto', N: 8, rooms: [6, 7], maxLevel: 3, minLevel: 3, attempts: 3, density: 0.4, pref: 'weak',
                 w: { room: 2.5, notroom: 2, on: 2.5, floor: 1.5, adj: 3, dir: 2.5, corner: 1, edge: 1.2, inner: 1.2, row: 0, col: 0, same: 2, diff: 1, north: 1.5, west: 1.5, alone: 1.5, count: 1.5 } },
      maestro: { key: 'maestro', label: 'Maestro', N: 9, rooms: [7, 8], maxLevel: 4, minLevel: 4, attempts: 2, density: 0.4, pref: 'weak',
                 w: { room: 2, notroom: 2, on: 2.5, floor: 1.5, adj: 3, dir: 2.5, corner: 1, edge: 1.2, inner: 1.2, row: 0, col: 0, same: 2, diff: 1.2, north: 1.8, west: 1.8, alone: 1.5, count: 1.5 } }
    };

    const UNARY = new Set(['room', 'notroom', 'on', 'floor', 'adj', 'dir', 'corner', 'edge', 'inner', 'row', 'col']);
    const RELATIONAL = new Set(['same', 'diff', 'north', 'west']);

    /* ---------- Utilidades ---------- */
    const cellName = (N, i) => LETTERS[i % N] + (Math.floor(i / N) + 1);
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    function joinY(arr) {
      if (arr.length <= 1) return arr.join('');
      return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
    }
    function popc(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }
    function lowBit(m) { return 31 - Math.clz32(m & -m); }
    function bitList(m) { const r = []; for (let b = 0; m; b++, m >>>= 1) if (m & 1) r.push(b); return r; }
    function onlyBit(m) { return m && !(m & (m - 1)) ? lowBit(m) : -1; }

    function personRef(people, p, capital) {
      const pe = people[p];
      const s = pe.art ? pe.art + ' ' + pe.name : pe.name;
      return capital ? cap(s) : s;
    }
    const gEnd = (people, p) => (people[p].g === 'f' ? 'a' : 'o');

    /* ---------- Contexto ---------- */
    function prepare(puz) {
      const N = puz.N, NN = N * N;
      const ctx = {
        N, NN, V: N - 1,
        room: puz.room, obj: puz.obj, rooms: puz.rooms, people: puz.people,
        solution: puz.solution || null,
        rowOf: new Int8Array(NN), colOf: new Int8Array(NN), blocked: new Uint8Array(NN),
        nb: [], roomCells: puz.rooms.map(() => [])
      };
      for (let i = 0; i < NN; i++) {
        const r = Math.floor(i / N), c = i % N;
        ctx.rowOf[i] = r; ctx.colOf[i] = c;
        ctx.blocked[i] = puz.obj[i] && !OBJ[puz.obj[i]].occ ? 1 : 0;
        const nb = [];
        if (r > 0) nb.push(i - N);
        if (r < N - 1) nb.push(i + N);
        if (c > 0) nb.push(i - 1);
        if (c < N - 1) nb.push(i + 1);
        ctx.nb.push(nb);
        ctx.roomCells[puz.room[i]].push(i);
      }
      return withClues(ctx, puz.clues || []);
    }
    function withClues(base, clues) {
      const ctx = Object.assign({}, base, { clues });
      ctx.cRel = []; ctx.cAlone = []; ctx.cCount = [];
      clues.forEach((cl, k) => {
        if (RELATIONAL.has(cl.t)) ctx.cRel.push(k);
        else if (cl.t === 'alone') ctx.cAlone.push(k);
        else if (cl.t === 'count') ctx.cCount.push(k);
      });
      return ctx;
    }
    const roomRef = (ctx, k) => ctx.rooms[k].art + ' ' + ctx.rooms[k].name;
    const cn = (ctx, i) => cellName(ctx.N, i);
    const nm = (ctx, p, c) => personRef(ctx.people, p, c);
    const fixEs = t => t.replace(/\bde el /g, 'del ').replace(/\ba el /g, 'al ');

    function dirTarget(ctx, i, dir) {
      const N = ctx.N, r = ctx.rowOf[i], c = ctx.colOf[i];
      // "P estaba justo al norte de X" → X está en la casilla de abajo
      if (dir === 'N') return r < N - 1 ? i + N : -1;
      if (dir === 'S') return r > 0 ? i - N : -1;
      if (dir === 'E') return c > 0 ? i - 1 : -1;
      if (dir === 'W') return c < N - 1 ? i + 1 : -1;
      return -1;
    }
    function isEdge(ctx, i) { const N = ctx.N, r = ctx.rowOf[i], c = ctx.colOf[i]; return r === 0 || c === 0 || r === N - 1 || c === N - 1; }
    function isCorner(ctx, i) { const N = ctx.N, r = ctx.rowOf[i], c = ctx.colOf[i]; return (r === 0 || r === N - 1) && (c === 0 || c === N - 1); }

    function testU(ctx, cl, i) {
      switch (cl.t) {
        case 'room': return ctx.room[i] === cl.room;
        case 'notroom': return ctx.room[i] !== cl.room;
        case 'on': return ctx.obj[i] === cl.obj;
        case 'floor': return !ctx.obj[i];
        case 'adj': return ctx.nb[i].some(j => ctx.obj[j] === cl.obj);
        case 'dir': { const j = dirTarget(ctx, i, cl.dir); return j >= 0 && ctx.obj[j] === cl.obj; }
        case 'corner': return isCorner(ctx, i);
        case 'edge': return isEdge(ctx, i);
        case 'inner': return !isEdge(ctx, i);
        case 'row': return ctx.rowOf[i] === cl.r;
        case 'col': return ctx.colOf[i] === cl.c;
      }
      return true;
    }
    function testRel(ctx, cl, i, j) { // p en i, q en j
      switch (cl.t) {
        case 'same': return ctx.room[i] === ctx.room[j];
        case 'diff': return ctx.room[i] !== ctx.room[j];
        case 'north': return ctx.rowOf[i] < ctx.rowOf[j];
        case 'west': return ctx.colOf[i] < ctx.colOf[j];
      }
      return true;
    }

    /* ---------- Texto de las pistas ---------- */
    function clueText(ctx, cl) {
      const P = cl.p != null ? nm(ctx, cl.p, true) : '';
      const a = cl.p != null ? gEnd(ctx.people, cl.p) : 'o';
      switch (cl.t) {
        case 'room': return `${P} estaba en ${roomRef(ctx, cl.room)}.`;
        case 'notroom': return `${P} no estaba en ${roomRef(ctx, cl.room)}.`;
        case 'on': return `${P} estaba ${OBJ[cl.obj].on(a)}.`;
        case 'floor': return `${P} no estaba sobre ningún mueble.`;
        case 'adj': return `${P} estaba junto a ${indef(cl.obj)}.`;
        case 'dir': return `${P} estaba justo al ${DIRN[cl.dir]} de ${indef(cl.obj)}.`;
        case 'corner': return `${P} estaba en una esquina de la casa.`;
        case 'edge': return `${P} estaba junto a un muro exterior.`;
        case 'inner': return `${P} no estaba junto a ningún muro exterior.`;
        case 'row': return `${P} estaba en la fila ${cl.r + 1}.`;
        case 'col': return `${P} estaba en la columna ${LETTERS[cl.c]}.`;
        case 'same': return `${P} estaba en la misma habitación que ${nm(ctx, cl.q)}.`;
        case 'diff': return `${P} y ${nm(ctx, cl.q)} estaban en habitaciones distintas.`;
        case 'north': return `${P} estaba más al norte que ${nm(ctx, cl.q)}.`;
        case 'west': return `${P} estaba más al oeste que ${nm(ctx, cl.q)}.`;
        case 'alone': return `${P} estaba sol${a} en su habitación.`;
        case 'count': {
          const rr = roomRef(ctx, cl.room);
          if (cl.k === 0) return `${cap(rr)} estaba vací${ctx.rooms[cl.room].art === 'la' ? 'a' : 'o'}.`;
          if (cl.k === 1) return `En ${rr} había exactamente una persona.`;
          return `En ${rr} había exactamente ${NUM[cl.k]} personas.`;
        }
      }
      return '';
    }

    /* ---------- Estado del razonador ---------- */
    function newState(ctx) {
      const cand = [];
      for (let p = 0; p < ctx.N; p++) {
        const a = new Uint8Array(ctx.NN);
        for (let i = 0; i < ctx.NN; i++) a[i] = ctx.blocked[i] ? 0 : 1;
        cand.push(a);
      }
      return { cand, appliedU: new Uint8Array(ctx.clues.length), singleDone: new Int16Array(ctx.N).fill(-1) };
    }
    function cloneState(st) {
      return { cand: st.cand.map(a => a.slice()), appliedU: st.appliedU.slice(), singleDone: st.singleDone.slice() };
    }
    function count(a) { let n = 0; for (let i = 0; i < a.length; i++) n += a[i]; return n; }
    function cellsOf(a) { const r = []; for (let i = 0; i < a.length; i++) if (a[i]) r.push(i); return r; }
    function maskBy(ctx, a, key) { let m = 0; const arr = ctx[key]; for (let i = 0; i < ctx.NN; i++) if (a[i]) m |= 1 << arr[i]; return m; }
    const rowMask = (ctx, a) => maskBy(ctx, a, 'rowOf');
    const colMask = (ctx, a) => maskBy(ctx, a, 'colOf');
    const roomMask = (ctx, a) => maskBy(ctx, a, 'room');
    function cellsTxt(ctx, list) {
      const names = list.slice(0, 6).map(i => cn(ctx, i));
      return joinY(names) + (list.length > 6 ? '…' : '');
    }
    function pluralCas(n) { return n === 1 ? '1 casilla' : n + ' casillas'; }

    /* ---------- Técnicas de deducción ---------- */
    function tUnary(ctx, st) {
      for (let k = 0; k < ctx.clues.length; k++) {
        if (st.appliedU[k]) continue;
        const cl = ctx.clues[k];
        if (UNARY.has(cl.t)) {
          const p = cl.p, a = st.cand[p], el = [];
          for (let i = 0; i < ctx.NN; i++) if (a[i] && !testU(ctx, cl, i)) el.push([p, i]);
          if (!el.length) { st.appliedU[k] = 1; continue; }
          return { elims: el, markU: k, focusP: [p], clue: k,
            text: `«${cl.text}» Descarta para ${nm(ctx, p)} las ${pluralCas(el.length)} que no cumplen esta pista.` };
        }
        if (cl.t === 'count' && cl.k === 0) {
          const el = [];
          for (let p = 0; p < ctx.N; p++) for (const i of ctx.roomCells[cl.room]) if (st.cand[p][i]) el.push([p, i]);
          if (!el.length) { st.appliedU[k] = 1; continue; }
          return { elims: el, markU: k, clue: k, focusCells: ctx.roomCells[cl.room].slice(),
            text: `«${cl.text}» Nadie puede estar en ${roomRef(ctx, cl.room)}: tacha todas sus casillas.` };
        }
        st.appliedU[k] = 1;
      }
      return null;
    }

    function tSingle(ctx, st) {
      const N = ctx.N;
      for (let p = 0; p < N; p++) {
        if (st.singleDone[p] >= 0) continue;
        const a = st.cand[p];
        if (count(a) !== 1) continue;
        const x = a.indexOf(1), r = ctx.rowOf[x], c = ctx.colOf[x];
        const el = [];
        for (let q = 0; q < N; q++) {
          if (q === p) continue;
          const b = st.cand[q];
          for (let i = 0; i < ctx.NN; i++) if (b[i] && (ctx.rowOf[i] === r || ctx.colOf[i] === c)) el.push([q, i]);
        }
        if (!el.length) { st.singleDone[p] = x; continue; }
        return { elims: el, single: [p, x], focusP: [p], focusCells: [x], place: [p, x],
          text: `${nm(ctx, p, true)} solo puede estar en ${cn(ctx, x)}. Nadie más puede estar en la fila ${r + 1} ni en la columna ${LETTERS[c]}.` };
      }
      return null;
    }

    function tLine(ctx, st) {
      const N = ctx.N;
      for (let p = 0; p < N; p++) {
        const a = st.cand[p];
        if (count(a) < 2) continue;
        for (const kind of ['row', 'col']) {
          const m = kind === 'row' ? rowMask(ctx, a) : colMask(ctx, a);
          const b = onlyBit(m);
          if (b < 0) continue;
          const arr = kind === 'row' ? ctx.rowOf : ctx.colOf;
          const el = [];
          for (let q = 0; q < N; q++) {
            if (q === p) continue;
            const s = st.cand[q];
            for (let i = 0; i < ctx.NN; i++) if (s[i] && arr[i] === b) el.push([q, i]);
          }
          if (!el.length) continue;
          const lbl = kind === 'row' ? `la fila ${b + 1}` : `la columna ${LETTERS[b]}`;
          return { elims: el, focusP: [p], focusCells: cellsOf(a),
            text: `Todas las casillas posibles de ${nm(ctx, p)} están en ${lbl}. Esa línea es suya: nadie más puede estar en ella.` };
        }
      }
      return null;
    }

    function tHidden(ctx, st) {
      const N = ctx.N;
      for (const kind of ['row', 'col']) {
        const arr = kind === 'row' ? ctx.rowOf : ctx.colOf;
        for (let b = 0; b < N; b++) {
          let who = -1, many = false;
          for (let p = 0; p < N && !many; p++) {
            const a = st.cand[p];
            for (let i = 0; i < ctx.NN; i++) if (a[i] && arr[i] === b) { if (who >= 0) many = true; else who = p; break; }
          }
          if (many || who < 0) continue;
          const a = st.cand[who], el = [];
          for (let i = 0; i < ctx.NN; i++) if (a[i] && arr[i] !== b) el.push([who, i]);
          if (!el.length) continue;
          const lbl = kind === 'row' ? `la fila ${b + 1}` : `la columna ${LETTERS[b]}`;
          return { elims: el, focusP: [who],
            text: `En ${lbl} solo puede estar ${nm(ctx, who)}. Como cada ${kind === 'row' ? 'fila' : 'columna'} tiene exactamente una persona, ${nm(ctx, who)} está en ${lbl}.` };
        }
      }
      return null;
    }

    function relElims(ctx, st, cl) {
      // devuelve [{who, el}] por cada orientación
      const out = [];
      for (const [A, B, flip] of [[cl.p, cl.q, false], [cl.q, cl.p, true]]) {
        const a = st.cand[A], b = st.cand[B], el = [];
        const bc = cellsOf(b);
        for (let x = 0; x < ctx.NN; x++) {
          if (!a[x]) continue;
          let ok = false;
          for (const y of bc) {
            if (y === x || ctx.rowOf[y] === ctx.rowOf[x] || ctx.colOf[y] === ctx.colOf[x]) continue;
            if (flip ? testRel(ctx, cl, y, x) : testRel(ctx, cl, x, y)) { ok = true; break; }
          }
          if (!ok) el.push([A, x]);
        }
        if (el.length) out.push({ A, B, el });
      }
      return out;
    }
    function tRel(ctx, st) {
      for (const k of ctx.cRel) {
        const cl = ctx.clues[k];
        const res = relElims(ctx, st, cl);
        if (!res.length) continue;
        const { A, B, el } = res[0];
        const cells = el.map(e => e[1]);
        let why;
        if (cl.t === 'same') why = `allí ${nm(ctx, B)} no podría estar en la misma habitación`;
        else if (cl.t === 'diff') why = `${nm(ctx, B)} tendría que estar en esa misma habitación`;
        else why = `${nm(ctx, B)} no tendría ninguna casilla compatible`;
        return { elims: el, focusP: [A, B], clue: k,
          text: `«${cl.text}» ${nm(ctx, A, true)} no puede estar en ${cellsTxt(ctx, cells)}: ${why}.` };
      }
      return null;
    }

    function tRoom(ctx, st) {
      const N = ctx.N, V = ctx.V, cand = st.cand;
      const rm = cand.map(a => roomMask(ctx, a));
      const cellsIn = (p, R) => ctx.roomCells[R].filter(i => cand[p][i]);
      const cellsOut = (p, R) => cellsOf(cand[p]).filter(i => ctx.room[i] !== R);

      for (const k of ctx.cAlone) {
        const cl = ctx.clues[k], p = cl.p, a = gEnd(ctx.people, p);
        const R = onlyBit(rm[p]);
        if (R >= 0) {
          const el = [];
          for (let q = 0; q < N; q++) if (q !== p) for (const i of cellsIn(q, R)) el.push([q, i]);
          if (el.length) return { elims: el, focusP: [p], clue: k, focusCells: ctx.roomCells[R].slice(),
            text: `${nm(ctx, p, true)} estaba sol${a} y tiene que estar en ${roomRef(ctx, R)}: nadie más puede estar allí.` };
        }
        for (let q = 0; q < N; q++) {
          if (q === p) continue;
          const Rq = onlyBit(rm[q]);
          if (Rq >= 0 && (rm[p] >> Rq) & 1) {
            const el = cellsIn(p, Rq).map(i => [p, i]);
            return { elims: el, focusP: [p, q], clue: k,
              text: `${nm(ctx, q, true)} tiene que estar en ${roomRef(ctx, Rq)}. Como ${nm(ctx, p)} estaba sol${a}, no puede estar allí.` };
          }
        }
      }

      for (const k of ctx.cCount) {
        const cl = ctx.clues[k];
        if (cl.k === 0) continue;
        const R = cl.room, must = [], can = [];
        for (let p = 0; p < N; p++) if ((rm[p] >> R) & 1) { can.push(p); if (rm[p] === 1 << R) must.push(p); }
        if (must.length === cl.k && can.length > cl.k) {
          const el = [];
          for (const p of can) if (!must.includes(p)) for (const i of cellsIn(p, R)) el.push([p, i]);
          return { elims: el, focusP: must, clue: k,
            text: `«${cl.text}» ${joinY(must.map(p => nm(ctx, p)))} ya ${must.length === 1 ? 'tiene' : 'tienen'} que estar allí, así que nadie más puede estar en ${roomRef(ctx, R)}.` };
        }
        if (can.length === cl.k && can.some(p => rm[p] !== 1 << R)) {
          const el = [];
          for (const p of can) for (const i of cellsOut(p, R)) el.push([p, i]);
          return { elims: el, focusP: can, clue: k,
            text: `«${cl.text}» Solo ${joinY(can.map(p => nm(ctx, p)))} ${can.length === 1 ? 'puede' : 'pueden'} estar allí, así que ${can.length === 1 ? 'tiene' : 'tienen'} que estar en ${roomRef(ctx, R)}.` };
        }
      }

      const susp = [];
      for (let s = 0; s < N - 1; s++) susp.push(s);
      const RV = onlyBit(rm[V]);
      const vic = nm(ctx, V);
      if (RV >= 0) {
        const must = susp.filter(s => rm[s] === 1 << RV), can = susp.filter(s => (rm[s] >> RV) & 1);
        if (must.length === 1 && can.length > 1) {
          const el = [];
          for (const s of can) if (s !== must[0]) for (const i of cellsIn(s, RV)) el.push([s, i]);
          return { elims: el, focusP: [V, must[0]], focusCells: ctx.roomCells[RV].slice(),
            text: `${cap(vic)} estaba en ${roomRef(ctx, RV)} y ${nm(ctx, must[0])} también tiene que estar allí. El asesino estuvo a solas con la víctima, así que ningún otro sospechoso estaba en esa habitación.` };
        }
        if (can.length === 1 && rm[can[0]] !== 1 << RV) {
          const el = cellsOut(can[0], RV).map(i => [can[0], i]);
          return { elims: el, focusP: [V, can[0]], focusCells: ctx.roomCells[RV].slice(),
            text: `${cap(vic)} estaba en ${roomRef(ctx, RV)} y el asesino estaba con la víctima. Solo ${nm(ctx, can[0])} puede estar en esa habitación, así que tiene que estar allí.` };
        }
      } else {
        for (const R of bitList(rm[V])) {
          const must = susp.filter(s => rm[s] === 1 << R), can = susp.filter(s => (rm[s] >> R) & 1);
          if (must.length >= 2) {
            return { elims: cellsIn(V, R).map(i => [V, i]), focusP: must, focusCells: ctx.roomCells[R].slice(),
              text: `${joinY(must.map(s => nm(ctx, s, true)))} tienen que estar en ${roomRef(ctx, R)}. Si la víctima hubiera estado allí, no habría estado a solas con su asesino: ${vic} no estaba en esa habitación.` };
          }
          if (can.length === 0) {
            return { elims: cellsIn(V, R).map(i => [V, i]), focusP: [V], focusCells: ctx.roomCells[R].slice(),
              text: `Ningún sospechoso puede estar en ${roomRef(ctx, R)}. La víctima estaba con su asesino, así que ${vic} no estaba allí.` };
          }
        }
      }
      return null;
    }

    function tPinch(ctx, st) {
      const N = ctx.N;
      const lists = st.cand.map(cellsOf);
      const order = [...Array(N).keys()].filter(p => lists[p].length > 1).sort((a, b) => lists[a].length - lists[b].length);
      for (const p of order) {
        const bad = []; let reason = null;
        for (const x of lists[p]) {
          const rx = ctx.rowOf[x], cx = ctx.colOf[x];
          let fail = null;
          for (let q = 0; q < N && !fail; q++) {
            if (q === p) continue;
            if (!lists[q].some(i => ctx.rowOf[i] !== rx && ctx.colOf[i] !== cx)) fail = `${nm(ctx, q)} se quedaría sin ninguna casilla`;
          }
          for (let b = 0; b < N && !fail; b++) {
            if (b !== rx) {
              let ok = false;
              for (let q = 0; q < N && !ok; q++) if (q !== p && lists[q].some(i => ctx.rowOf[i] === b && ctx.colOf[i] !== cx)) ok = true;
              if (!ok) fail = `nadie podría ocupar la fila ${b + 1}`;
            }
            if (!fail && b !== cx) {
              let ok = false;
              for (let q = 0; q < N && !ok; q++) if (q !== p && lists[q].some(i => ctx.colOf[i] === b && ctx.rowOf[i] !== rx)) ok = true;
              if (!ok) fail = `nadie podría ocupar la columna ${LETTERS[b]}`;
            }
          }
          if (fail) { bad.push(x); if (!reason) reason = { x, fail }; }
        }
        if (bad.length) {
          return { elims: bad.map(x => [p, x]), focusP: [p], focusCells: bad,
            text: `Si ${nm(ctx, p)} estuviera en ${cn(ctx, reason.x)}, ${reason.fail} (su fila y su columna quedarían ocupadas). ` +
              (bad.length > 1 ? `Lo mismo pasa en ${cellsTxt(ctx, bad.filter(x => x !== reason.x))}. ` : '') +
              `Descarta ${bad.length > 1 ? 'esas casillas' : 'esa casilla'} para ${nm(ctx, p)}.` };
        }
      }
      return null;
    }

    function tHall(ctx, st) {
      const N = ctx.N;
      for (const kind of ['row', 'col']) {
        const arr = kind === 'row' ? ctx.rowOf : ctx.colOf;
        const masks = st.cand.map(a => (kind === 'row' ? rowMask(ctx, a) : colMask(ctx, a)));
        const ps = [...Array(N).keys()].filter(p => popc(masks[p]) >= 2);
        const m = ps.length;
        if (m < 3) continue;
        let best = null;
        for (let sub = 1; sub < (1 << m) - 1; sub++) {
          const k = popc(sub);
          if (k < 2 || k > m - 1) continue;
          if (best && k >= best.k) continue;
          let U = 0;
          for (let j = 0; j < m; j++) if ((sub >> j) & 1) U |= masks[ps[j]];
          if (popc(U) !== k) continue;
          const group = ps.filter((_, j) => (sub >> j) & 1);
          const el = [];
          for (let q = 0; q < N; q++) {
            if (group.includes(q)) continue;
            const a = st.cand[q];
            for (let i = 0; i < ctx.NN; i++) if (a[i] && (U >> arr[i]) & 1) el.push([q, i]);
          }
          if (el.length) best = { k, group, U, el };
        }
        if (best) {
          const lines = bitList(best.U).map(b => (kind === 'row' ? String(b + 1) : LETTERS[b]));
          const w = kind === 'row' ? 'filas' : 'columnas';
          return { elims: best.el, focusP: best.group,
            text: `${joinY(best.group.map(p => nm(ctx, p, true)))} solo pueden estar en las ${w} ${joinY(lines)}. Entre ${NUM[best.k]} personas ocupan esas ${NUM[best.k]} ${w}, así que nadie más puede estar en ellas.` };
        }
      }
      return null;
    }

    function tTrial(ctx, st) {
      const N = ctx.N;
      const lists = st.cand.map(cellsOf);
      const order = [...Array(N).keys()].filter(p => lists[p].length > 1 && lists[p].length <= 8)
        .sort((a, b) => lists[a].length - lists[b].length);
      for (const p of order) {
        for (const x of lists[p]) {
          const s2 = cloneState(st);
          const a = s2.cand[p];
          a.fill(0); a[x] = 1;
          const res = solve(ctx, 3, s2, { inner: true, maxSteps: 400 });
          if (res.status === 'contradiction') {
            return { elims: [[p, x]], focusP: [p], focusCells: [x],
              text: `Supón que ${nm(ctx, p)} estuviera en ${cn(ctx, x)}. Siguiendo las deducciones, ${res.reason}. Es imposible, así que ${nm(ctx, p)} no estaba en ${cn(ctx, x)}.` };
          }
        }
      }
      return null;
    }

    const TECHS = [
      { id: 'unary', lvl: 0, fn: tUnary },
      { id: 'single', lvl: 1, fn: tSingle },
      { id: 'line', lvl: 1, fn: tLine },
      { id: 'hidden', lvl: 1, fn: tHidden },
      { id: 'rel', lvl: 2, fn: tRel },
      { id: 'room', lvl: 2, fn: tRoom },
      { id: 'pinch', lvl: 3, fn: tPinch },
      { id: 'hall', lvl: 3, fn: tHall },
      { id: 'trial', lvl: 4, fn: tTrial }
    ];
    const WEIGHT = [0.15, 1, 2, 4, 12];

    function contradiction(ctx, st) {
      const N = ctx.N, cand = st.cand;
      for (let p = 0; p < N; p++) if (count(cand[p]) === 0) return `${nm(ctx, p)} se quedaría sin ningún sitio posible`;
      let rows = 0, cols = 0;
      for (let p = 0; p < N; p++) { rows |= rowMask(ctx, cand[p]); cols |= colMask(ctx, cand[p]); }
      const full = (1 << N) - 1;
      if (rows !== full) return `nadie podría ocupar la fila ${lowBit(~rows & full) + 1}`;
      if (cols !== full) return `nadie podría ocupar la columna ${LETTERS[lowBit(~cols & full)]}`;
      const rm = cand.map(a => roomMask(ctx, a));
      const V = ctx.V;
      const RV = onlyBit(rm[V]);
      if (RV >= 0) {
        let must = 0, can = 0;
        for (let s = 0; s < N - 1; s++) { if (rm[s] === 1 << RV) must++; if ((rm[s] >> RV) & 1) can++; }
        if (must >= 2) return `habría más de un sospechoso con la víctima en ${roomRef(ctx, RV)}`;
        if (can === 0) return `nadie podría haber estado con la víctima en ${roomRef(ctx, RV)}`;
      }
      for (const k of ctx.cAlone) {
        const p = ctx.clues[k].p, R = onlyBit(rm[p]);
        if (R < 0) continue;
        for (let q = 0; q < N; q++) if (q !== p && rm[q] === 1 << R) return `${nm(ctx, p)} no habría estado sol${gEnd(ctx.people, p)}`;
      }
      for (const k of ctx.cCount) {
        const cl = ctx.clues[k];
        let must = 0, can = 0;
        for (let p = 0; p < N; p++) { if (rm[p] === 1 << cl.room) must++; if ((rm[p] >> cl.room) & 1) can++; }
        if (must > cl.k) return `en ${roomRef(ctx, cl.room)} habría demasiadas personas`;
        if (can < cl.k) return `en ${roomRef(ctx, cl.room)} no cabrían ${NUM[cl.k]} personas`;
      }
      return null;
    }

    function verify(ctx, pos) {
      const N = ctx.N;
      let rows = 0, cols = 0;
      for (let p = 0; p < N; p++) {
        const i = pos[p];
        if (i < 0 || ctx.blocked[i]) return false;
        rows |= 1 << ctx.rowOf[i]; cols |= 1 << ctx.colOf[i];
      }
      if (rows !== (1 << N) - 1 || cols !== (1 << N) - 1) return false;
      for (const cl of ctx.clues) if (evalClueFull(ctx, cl, pos) === false) return false;
      return murderOk(ctx, pos);
    }
    function murderOk(ctx, pos) {
      const R = ctx.room[pos[ctx.V]];
      let n = 0;
      for (let s = 0; s < ctx.N - 1; s++) if (ctx.room[pos[s]] === R) n++;
      return n === 1;
    }
    // evalúa una pista con posiciones parciales: true / false / null (aún no se sabe)
    function evalClueFull(ctx, cl, pos) {
      const N = ctx.N;
      if (UNARY.has(cl.t)) return pos[cl.p] < 0 ? null : testU(ctx, cl, pos[cl.p]);
      if (RELATIONAL.has(cl.t)) return pos[cl.p] < 0 || pos[cl.q] < 0 ? null : testRel(ctx, cl, pos[cl.p], pos[cl.q]);
      if (cl.t === 'alone') {
        if (pos[cl.p] < 0) return null;
        const R = ctx.room[pos[cl.p]];
        let unknown = false;
        for (let q = 0; q < N; q++) {
          if (q === cl.p) continue;
          if (pos[q] < 0) unknown = true;
          else if (ctx.room[pos[q]] === R) return false;
        }
        return unknown ? null : true;
      }
      if (cl.t === 'count') {
        let n = 0, unknown = 0;
        for (let p = 0; p < N; p++) { if (pos[p] < 0) unknown++; else if (ctx.room[pos[p]] === cl.room) n++; }
        if (n > cl.k) return false;
        if (unknown === 0) return n === cl.k;
        if (n + unknown < cl.k) return false;
        return null;
      }
      return null;
    }

    function allSingle(st) { for (const a of st.cand) if (count(a) !== 1) return false; return true; }
    function applyStep(st, step) {
      for (const [p, i] of step.elims) st.cand[p][i] = 0;
      if (step.markU != null) st.appliedU[step.markU] = 1;
      if (step.single) st.singleDone[step.single[0]] = step.single[1];
    }
    function findStep(ctx, st, maxLevel, inner) {
      for (const t of TECHS) {
        if (t.lvl > maxLevel) break;
        if (inner && t.id === 'trial') break;
        const s = t.fn(ctx, st);
        if (s) { s.tech = t.id; s.lvl = t.lvl; if (!inner) s.text = fixEs(s.text); return s; }
      }
      return null;
    }

    function solve(ctx, maxLevel, state, opts) {
      opts = opts || {};
      const st = state || newState(ctx);
      const steps = [];
      let maxUsed = 0, score = 0, n = 0;
      const limit = opts.maxSteps || 5000;
      while (n++ < limit) {
        const bad = contradiction(ctx, st);
        if (bad) return { status: 'contradiction', reason: bad, steps, maxUsed, score, state: st };
        const step = findStep(ctx, st, maxLevel, opts.inner);
        if (!step) {
          if (allSingle(st)) {
            const pos = st.cand.map(a => a.indexOf(1));
            if (verify(ctx, pos)) return { status: 'solved', steps, maxUsed, score, state: st, pos };
            return { status: 'contradiction', reason: 'las posiciones resultantes no cumplen todas las pistas', steps, maxUsed, score, state: st };
          }
          return { status: 'stuck', steps, maxUsed, score, state: st };
        }
        applyStep(st, step);
        if (opts.record !== false && !opts.inner) steps.push(step);
        if (step.lvl > maxUsed) maxUsed = step.lvl;
        score += WEIGHT[step.lvl];
      }
      return { status: 'stuck', steps, maxUsed, score, state: st };
    }

    /* ---------- Fuerza bruta (verificación de unicidad) ---------- */
    function countSolutions(ctx, limit) {
      limit = limit || 2;
      const N = ctx.N;
      const cands = [];
      for (let p = 0; p < N; p++) {
        const list = [];
        for (let i = 0; i < ctx.NN; i++) {
          if (ctx.blocked[i]) continue;
          let ok = true;
          for (const cl of ctx.clues) if (cl.p === p && UNARY.has(cl.t) && !testU(ctx, cl, i)) { ok = false; break; }
          if (ok) list.push(i);
        }
        cands.push(list);
      }
      const order = [...Array(N).keys()].sort((a, b) => cands[a].length - cands[b].length);
      const pos = new Array(N).fill(-1);
      const rels = ctx.cRel.map(k => ctx.clues[k]);
      let found = 0;
      const sols = [];
      (function rec(k, rows, cols) {
        if (found >= limit) return;
        if (k === N) { if (verify(ctx, pos)) { found++; sols.push(pos.slice()); } return; }
        const p = order[k];
        for (const i of cands[p]) {
          const r = ctx.rowOf[i], c = ctx.colOf[i];
          if ((rows >> r) & 1 || (cols >> c) & 1) continue;
          pos[p] = i;
          let ok = true;
          for (const cl of rels) {
            if (cl.p !== p && cl.q !== p) continue;
            if (pos[cl.p] >= 0 && pos[cl.q] >= 0 && !testRel(ctx, cl, pos[cl.p], pos[cl.q])) { ok = false; break; }
          }
          if (ok) rec(k + 1, rows | (1 << r), cols | (1 << c));
          pos[p] = -1;
          if (found >= limit) return;
        }
      })(0, 0, 0);
      return { count: found, solutions: sols };
    }

    /* ---------- Generación ---------- */
    function makeRooms(rng, N, R) {
      const NN = N * N;
      for (let tries = 0; tries < 300; tries++) {
        const room = new Array(NN).fill(-1);
        const size = new Array(R).fill(1);
        const seeds = rng.shuffle([...Array(NN).keys()]).slice(0, R);
        seeds.forEach((s, k) => (room[s] = k));
        let filled = R;
        while (filled < NN) {
          const opts = [];
          for (let i = 0; i < NN; i++) {
            if (room[i] >= 0) continue;
            const r = Math.floor(i / N), c = i % N;
            const nbs = [];
            if (r > 0) nbs.push(i - N);
            if (r < N - 1) nbs.push(i + N);
            if (c > 0) nbs.push(i - 1);
            if (c < N - 1) nbs.push(i + 1);
            const seen = new Set();
            for (const j of nbs) if (room[j] >= 0 && !seen.has(room[j])) {
              seen.add(room[j]);
              // favorece formas compactas: cuenta vecinos de la misma sala
              const same = nbs.filter(t => room[t] === room[j]).length;
              opts.push({ i, k: room[j], w: Math.pow(1 / size[room[j]], 1.3) * (same * same) });
            }
          }
          const ch = rng.weighted(opts, o => o.w);
          room[ch.i] = ch.k; size[ch.k]++; filled++;
        }
        const minS = Math.max(2, Math.floor(NN / R * 0.4)), maxS = Math.ceil(NN / R * 2);
        if (size.every(s => s >= minS && s <= maxS)) return room;
      }
      return null;
    }

    function colorRooms(N, room, R) {
      const adj = Array.from({ length: R }, () => new Set());
      for (let i = 0; i < N * N; i++) {
        const r = Math.floor(i / N), c = i % N;
        if (c < N - 1 && room[i] !== room[i + 1]) { adj[room[i]].add(room[i + 1]); adj[room[i + 1]].add(room[i]); }
        if (r < N - 1 && room[i] !== room[i + N]) { adj[room[i]].add(room[i + N]); adj[room[i + N]].add(room[i]); }
      }
      const col = new Array(R).fill(-1);
      const used = new Array(8).fill(0);
      for (let k = 0; k < R; k++) {
        const taken = new Set([...adj[k]].map(j => col[j]));
        let best = -1;
        for (let c = 0; c < 8; c++) if (!taken.has(c) && (best < 0 || used[c] < used[best])) best = c;
        col[k] = best < 0 ? k % 8 : best;
        used[col[k]]++;
      }
      return col;
    }

    function placeObjects(rng, N, room, types, density) {
      const NN = N * N, obj = new Array(NN).fill(null);
      types.forEach((t, k) => {
        const cells = rng.shuffle([...Array(NN).keys()].filter(i => room[i] === k));
        let n = Math.round(cells.length * density * (0.75 + rng.next() * 0.5));
        n = Math.max(1, Math.min(cells.length - 1, n));
        const kinds = Object.keys(t.objs);
        for (let j = 0; j < n; j++) obj[cells[j]] = rng.weighted(kinds, o => t.objs[o]);
      });
      return obj;
    }

    function makeSolution(rng, N, room, obj) {
      const cols = new Array(N), used = new Array(N).fill(false);
      let calls = 0;
      function bt(r) {
        if (++calls > 20000) return false;
        if (r === N) return true;
        const order = rng.shuffle([...Array(N).keys()]);
        // un poco más de probabilidad de estar sobre un mueble ocupable
        order.sort((a, b) => {
          const oa = obj[r * N + a] ? 1 : 0, ob = obj[r * N + b] ? 1 : 0;
          return (ob - oa) * (rng.next() < 0.35 ? 1 : 0);
        });
        for (const c of order) {
          if (used[c]) continue;
          const i = r * N + c;
          if (obj[i] && !OBJ[obj[i]].occ) continue;
          used[c] = true; cols[r] = c;
          if (bt(r + 1)) return true;
          used[c] = false;
        }
        return false;
      }
      if (!bt(0)) return null;
      const cells = cols.map((c, r) => r * N + c);
      const cnt = {};
      for (const i of cells) cnt[room[i]] = (cnt[room[i]] || 0) + 1;
      const vc = cells.filter(i => cnt[room[i]] === 2);
      if (!vc.length) return null;
      const vcell = rng.pick(vc);
      const others = rng.shuffle(cells.filter(i => i !== vcell));
      return others.concat([vcell]); // índice N-1 = víctima
    }

    function pickPeople(rng, N) {
      const pool = rng.shuffle(SUSPECTS.slice());
      const seen = new Set(), out = [];
      for (const [name, g] of pool) {
        const ini = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0);
        if (seen.has(ini)) continue;
        seen.add(ini);
        out.push({ name, g, art: '', role: 'suspect', initial: ini });
        if (out.length === N - 1) break;
      }
      const v = rng.pick(VICTIMS);
      out.push({ name: v.name, g: v.g, art: v.art, role: 'victim', initial: '✝' });
      return out;
    }

    function buildPool(ctx, sol) {
      const N = ctx.N, pool = [];
      const roomCount = {};
      sol.forEach(i => (roomCount[ctx.room[i]] = (roomCount[ctx.room[i]] || 0) + 1));
      for (let p = 0; p < N; p++) {
        const x = sol[p], rm = ctx.room[x];
        pool.push({ t: 'room', p, room: rm });
        for (let k = 0; k < ctx.rooms.length; k++) if (k !== rm) pool.push({ t: 'notroom', p, room: k });
        if (ctx.obj[x]) pool.push({ t: 'on', p, obj: ctx.obj[x] });
        else pool.push({ t: 'floor', p });
        const adjSeen = new Set();
        for (const j of ctx.nb[x]) if (ctx.obj[j] && !adjSeen.has(ctx.obj[j])) { adjSeen.add(ctx.obj[j]); pool.push({ t: 'adj', p, obj: ctx.obj[j] }); }
        for (const dir of ['N', 'S', 'E', 'W']) {
          const j = dirTarget(ctx, x, dir);
          if (j >= 0 && ctx.obj[j]) pool.push({ t: 'dir', p, obj: ctx.obj[j], dir });
        }
        if (isCorner(ctx, x)) pool.push({ t: 'corner', p });
        if (isEdge(ctx, x)) pool.push({ t: 'edge', p }); else pool.push({ t: 'inner', p });
        pool.push({ t: 'row', p, r: ctx.rowOf[x] });
        pool.push({ t: 'col', p, c: ctx.colOf[x] });
        for (let q = 0; q < N; q++) {
          if (q === p) continue;
          const y = sol[q];
          if (p < q) {
            if (ctx.room[x] === ctx.room[y]) pool.push({ t: 'same', p, q });
            else pool.push({ t: 'diff', p, q });
          }
          if (ctx.rowOf[x] < ctx.rowOf[y]) pool.push({ t: 'north', p, q });
          if (ctx.colOf[x] < ctx.colOf[y]) pool.push({ t: 'west', p, q });
        }
        if (roomCount[rm] === 1) pool.push({ t: 'alone', p });
      }
      for (let k = 0; k < ctx.rooms.length; k++) pool.push({ t: 'count', room: k, k: roomCount[k] || 0 });
      return pool;
    }

    function estimateElims(ctx, st, cl) {
      if (UNARY.has(cl.t)) {
        const a = st.cand[cl.p];
        let e = 0, n = 0;
        for (let i = 0; i < ctx.NN; i++) if (a[i]) { n++; if (!testU(ctx, cl, i)) e++; }
        return { e, frac: n ? e / n : 0 };
      }
      if (RELATIONAL.has(cl.t)) {
        const res = relElims(ctx, st, cl);
        const e = res.reduce((s, r) => s + r.el.length, 0);
        const n = count(st.cand[cl.p]) + count(st.cand[cl.q]);
        return { e, frac: n ? e / n : 0 };
      }
      if (cl.t === 'count') {
        let e = 0, n = 0;
        for (let p = 0; p < ctx.N; p++) for (const i of ctx.roomCells[cl.room]) if (st.cand[p][i]) n++;
        e = cl.k === 0 ? n : Math.min(2, n);
        return { e, frac: 0.3 };
      }
      if (cl.t === 'alone') return { e: 1, frac: 0.2 };
      return { e: 0, frac: 0 };
    }

    function clueKey(cl) { return [cl.t, cl.p, cl.q, cl.room, cl.obj, cl.dir, cl.r, cl.c, cl.k].join('|'); }

    function selectClues(rng, base, pool, cfg) {
      const N = base.N;
      const allowed = pool.filter(cl => (cfg.w[cl.t] || 0) > 0);
      const chosen = [];
      const has = new Set();
      const add = cl => { chosen.push(cl); has.add(clueKey(cl)); };
      const prefW = frac => cfg.pref === 'strong' ? 0.25 + frac * 1.6 : cfg.pref === 'mid' ? 0.6 + frac * 0.6 : Math.max(0.15, 1.25 - frac);

      // una pista inicial por sospechoso
      const st0 = newState(base);
      for (let p = 0; p < N - 1; p++) {
        const opts = allowed.filter(cl => cl.p === p && cl.t !== 'count');
        const ch = rng.weighted(opts, cl => cfg.w[cl.t] * prefW(estimateElims(base, st0, cl).frac));
        if (ch) add(ch);
      }
      let res;
      for (let iter = 0; iter < 70; iter++) {
        const ctx = withClues(base, chosen);
        res = solve(ctx, cfg.maxLevel, null, { record: false });
        if (res.status === 'solved') break;
        if (res.status === 'contradiction') return null;
        const st = res.state;
        const opts = [];
        for (const cl of allowed) {
          if (has.has(clueKey(cl))) continue;
          const subj = cl.p != null ? cl.p : -1;
          if (subj >= 0 && chosen.filter(c => c.p === subj).length >= 4) continue;
          const { e, frac } = estimateElims(ctx, st, cl);
          if (e <= 0) continue;
          opts.push({ cl, w: cfg.w[cl.t] * prefW(frac) });
        }
        let ch = rng.weighted(opts, o => o.w);
        if (!ch) {
          // último recurso: cualquier pista verdadera que aporte algo
          const extra = [];
          for (const cl of pool) {
            if (has.has(clueKey(cl))) continue;
            if (estimateElims(ctx, st, cl).e > 0) extra.push({ cl, w: cfg.w[cl.t] || 0.3 });
          }
          ch = rng.weighted(extra, o => o.w);
        }
        if (!ch) return null;
        add(ch.cl);
      }
      if (!res || res.status !== 'solved') return null;

      // poda: quita pistas sobrantes manteniendo al menos una por sospechoso
      const order = rng.shuffle(chosen.slice());
      let cur = chosen.slice();
      for (const cl of order) {
        if (cl.p != null && cl.p < N - 1 && cur.filter(c => c.p === cl.p).length <= 1) continue;
        const trial = cur.filter(c => c !== cl);
        const r = solve(withClues(base, trial), cfg.maxLevel, null, { record: false });
        if (r.status === 'solved') cur = trial;
      }
      return cur;
    }

    function generate(diffKey, seed) {
      const cfg = DIFF[diffKey] || DIFF.normal;
      const rng = makeRng(diffKey + ':' + seed);
      const N = cfg.N;
      let best = null;
      for (let attempt = 0; attempt < cfg.attempts * 3 && (!best || attempt < cfg.attempts || best.grade.maxUsed < cfg.minLevel); attempt++) {
        const R = cfg.rooms[0] + rng.int(cfg.rooms[1] - cfg.rooms[0] + 1);
        const room = makeRooms(rng, N, R);
        if (!room) continue;
        const types = rng.shuffle(ROOM_TYPES.slice()).slice(0, R);
        const obj = placeObjects(rng, N, room, types, cfg.density);
        const blockedN = obj.filter(o => o && !OBJ[o].occ).length;
        if (blockedN > N * N * 0.34) continue;
        const sol = makeSolution(rng, N, room, obj);
        if (!sol) continue;
        const people = pickPeople(rng, N);
        const colors = colorRooms(N, room, R);
        const rooms = types.map((t, k) => ({ key: t.key, name: t.name, art: t.art, color: k, tone: colors[k] }));
        const base = prepare({ N, room, obj, rooms, people, clues: [], solution: sol });
        const pool = buildPool(base, sol);
        const clues = selectClues(rng, base, pool, cfg);
        if (!clues) continue;
        // orden de lectura: por persona, luego notas generales
        clues.sort((a, b) => (a.p == null ? 99 : a.p) - (b.p == null ? 99 : b.p));
        const ctx = withClues(base, clues);
        clues.forEach(cl => (cl.text = fixEs(clueText(ctx, cl))));
        const res = solve(ctx, cfg.maxLevel, null, { record: false });
        if (res.status !== 'solved') continue;
        const grade = { maxUsed: res.maxUsed, score: Math.round(res.score * 10) / 10, clues: clues.length };
        const fit = (grade.maxUsed >= cfg.minLevel ? 1000 : 0) + (cfg.pref === 'strong' ? -grade.score : grade.score) - clues.length * 0.5;
        if (!best || fit > best.fit) best = { fit, grade, N, room, obj, rooms, people, clues, sol, rng };
      }
      if (!best) return null;
      const { room, obj, rooms, people, clues, sol, grade } = best;
      const murdererCell = sol.find((i, p) => p < N - 1 && room[i] === room[sol[N - 1]]);
      const murderer = sol.indexOf(murdererCell);
      const vic = people[N - 1];
      const vref = vic.art ? vic.art + ' ' + vic.name : vic.name;
      const mansion = rng.pick(MANSIONS), ev = rng.pick(EVENTS);
      const story = `Durante ${ev} en ${mansion}, ${vref} acabó en el suelo, y no precisamente echándose la siesta. Hay ${NUM[N - 1].replace('una', 'un')} sospechosos y todos juran que no han sido. Pero solo uno estuvo a solas con la víctima.`;
      return {
        v: 3, diff: cfg.key, seed: String(seed), N, room, obj, rooms, people, clues,
        solution: sol, murderer, story, title: cap(mansion), grade
      };
    }

    /* ---------- Pistas para el jugador ---------- */
    const NUDGE = {
      unary: 'Lee con calma su declaración y descarta las casillas que no encajan.',
      single: 'Mira qué filas y columnas quedan libres.',
      line: 'Mira en qué filas y columnas puede estar cada persona.',
      hidden: 'Cada fila y cada columna tiene exactamente una persona. ¿Hay alguna fila que solo pueda ocupar una persona?',
      rel: 'Relaciona las pistas que hablan de dos personas a la vez.',
      room: 'Piensa en quién puede estar en cada habitación (y recuerda que el asesino estuvo a solas con la víctima).',
      pinch: 'Comprueba qué casillas dejarían sin sitio a otra persona al bloquear su fila y su columna.',
      hall: 'Busca un grupo de personas que solo puedan repartirse las mismas filas o columnas.',
      trial: 'Prueba a suponer una posición y sigue las consecuencias hasta encontrar una contradicción.'
    };
    function hint(ctx, pos) {
      const N = ctx.N;
      const wrong = [];
      for (let p = 0; p < N; p++) if (pos[p] >= 0 && ctx.solution && pos[p] !== ctx.solution[p]) wrong.push(p);
      if (wrong.length) return { type: 'wrong', persons: wrong };
      const st = newState(ctx);
      for (let p = 0; p < N; p++) if (pos[p] >= 0) { const a = st.cand[p]; const keep = pos[p]; a.fill(0); a[keep] = 1; }
      const steps = [];
      for (let n = 0; n < 4000; n++) {
        const bad = contradiction(ctx, st);
        if (bad) return { type: 'none' };
        const step = findStep(ctx, st, 4);
        if (!step) break;
        applyStep(st, step);
        const givenSingle = step.tech === 'single' && pos[step.single[0]] >= 0;
        if (!givenSingle) steps.push({ tech: step.tech, lvl: step.lvl, text: step.text, focusP: step.focusP || [], focusCells: step.focusCells || [], clue: step.clue });
        for (let p = 0; p < N; p++) {
          if (pos[p] >= 0) continue;
          if (count(st.cand[p]) === 1) {
            const cell = st.cand[p].indexOf(1);
            const last = steps[steps.length - 1] || { tech: 'single' };
            return { type: 'place', p, cell, steps: compactSteps(ctx, steps, p), nudge: NUDGE[last.tech], tech: last.tech };
          }
        }
      }
      return { type: 'none' };
    }
    function compactSteps(ctx, steps, target) {
      const out = [];
      const direct = [];
      for (const s of steps) {
        if (s.tech === 'unary' && !(s.focusP || []).includes(target) && s.clue != null && ctx.clues[s.clue].p != null) {
          direct.push(ctx.clues[s.clue].p);
          continue;
        }
        out.push(s);
      }
      if (direct.length) {
        const names = [...new Set(direct)].map(p => nm(ctx, p));
        out.unshift({ tech: 'unary', lvl: 0, text: `Aplica las pistas directas de ${joinY(names)}.`, focusP: [], focusCells: [] });
      }
      return out;
    }

    function candidatesFor(ctx, pos, p) {
      // casillas que siguen siendo posibles para p según las pistas directas y las personas ya colocadas
      const out = [];
      for (let i = 0; i < ctx.NN; i++) {
        if (ctx.blocked[i]) continue;
        let ok = true;
        for (const cl of ctx.clues) if (cl.p === p && UNARY.has(cl.t) && !testU(ctx, cl, i)) { ok = false; break; }
        if (!ok) continue;
        for (let q = 0; q < ctx.N && ok; q++) if (q !== p && pos[q] >= 0 && (ctx.rowOf[pos[q]] === ctx.rowOf[i] || ctx.colOf[pos[q]] === ctx.colOf[i])) ok = false;
        if (ok) out.push(i);
      }
      return out;
    }

    return {
      DIFF, OBJ, LETTERS, generate, prepare, solve, hint, verify, countSolutions, cellName,
      evalClue: (ctx, k, pos) => evalClueFull(ctx, ctx.clues[k], pos),
      murderOk, candidatesFor, makeRng
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = createEngine;
  else root.createMurdokuEngine = createEngine;
})(typeof self !== 'undefined' ? self : this);
