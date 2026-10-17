/* Murdoku · caras de los personajes
 * Cada cara sale del nombre: el mismo personaje tiene siempre el mismo aspecto.
 * Lienzo de 40×40; el fondo lo pone la ficha (color de la persona). */
(function (root) {
  'use strict';

  function hash(s) {
    let h = 2166136261;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed || 1;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SKIN = [['#f7d7bd', '#deb092'], ['#efc29c', '#d29d76'], ['#dca47c', '#bb825b'], ['#b97d55', '#965f3c'], ['#8f5b3a', '#704428'], ['#f3cba8', '#d8a882']];
  const HAIR = ['#2b2018', '#4a3020', '#7a4b27', '#b0743a', '#e0bd72', '#c9572f', '#1d1d22', '#a3a3a3'];
  const ACCENT = ['#e2685a', '#5b8fd1', '#e9c25a', '#9b6bd1', '#2fa898', '#26262b'];
  const INK = '#2a1d17';
  const MOUTH = '#7a3b2e';

  const M_STYLES = ['short', 'side', 'bald', 'curly', 'quiff', 'buzz'];
  const F_STYLES = ['long', 'bob', 'bun', 'pony', 'curlylong', 'pixie'];

  const circles = (list, fill) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

  function backHair(style, c) {
    switch (style) {
      case 'long': return `<path fill="${c}" d="M10 18.5C9.4 10 14 6.8 20 6.8s10.6 3.2 10 11.7l.8 12.5c-3.6 1.4-18 1.4-21.6 0z"/>`;
      case 'bob': return `<path fill="${c}" d="M10.8 19C10.2 10.6 14.4 7.4 20 7.4s9.8 3.2 9.2 11.6l.4 6.6c-3 1.2-16.2 1.2-19.2 0z"/>`;
      case 'curlylong': return circles([[11, 14, 3.2], [10.6, 19, 3.2], [11.2, 24, 3], [29, 14, 3.2], [29.4, 19, 3.2], [28.8, 24, 3], [13.6, 9.6, 3.4], [18, 7.4, 3.4], [22.4, 7.4, 3.4], [26.4, 9.6, 3.4]], c);
      case 'pony': return `<path fill="${c}" d="M27.2 11.5c4.6.4 5.6 6.4 3.6 12.6-.6-4.2-1.6-7.4-4.4-9.6z"/>`;
      case 'bun': return `<circle cx="20" cy="6.6" r="3.9" fill="${c}"/>`;
      default: return '';
    }
  }
  function frontHair(style, c) {
    switch (style) {
      case 'short': return `<path fill="${c}" d="M11.6 17.5C11 10.5 14.8 8 20 8s9 2.5 8.4 9.5c-1-3.4-3.6-5.4-8.4-5.4s-7.4 2-8.4 5.4z"/>`;
      case 'side': return `<path fill="${c}" d="M11.6 18C10.6 10.8 14.6 7.6 20.4 7.6c5.6 0 9 3 8 10.4-.6-3.6-2.2-5.6-5.6-6.4-2.6 2.2-7 3.2-11.2 6.4z"/>`;
      case 'bald': return `<path fill="${c}" d="M11.5 19.8c-.2-3 .4-5.2 1.6-6.4l.5 6.4zM28.5 19.8c.2-3-.4-5.2-1.6-6.4l-.5 6.4z"/><ellipse cx="17" cy="11.6" rx="2.4" ry="1.1" fill="#fff" opacity=".35"/>`;
      case 'curly': return circles([[12.6, 14.4, 2.6], [14.2, 10.8, 3], [17.6, 8.8, 3.1], [21.6, 8.4, 3.1], [25.4, 10, 3], [27.6, 13.8, 2.7]], c);
      case 'quiff': return `<path fill="${c}" d="M11.6 17C11 10 14 7.4 18 6.6c2-1.6 6-1.8 7.8.4 2.6 1.6 3.4 4.8 2.6 10-.8-3-3-5-6.4-5.2-4 .2-8.6 1.6-10.4 5.2z"/>`;
      case 'buzz': return `<path fill="${c}" opacity=".85" d="M11.7 16.5C11.8 10.6 15.4 8.4 20 8.4s8.2 2.2 8.3 8.1c-2-2.4-5-3.4-8.3-3.4s-6.3 1-8.3 3.4z"/>`;
      case 'long': return `<path fill="${c}" d="M11.6 17C12 11 15.4 8.4 20 8.4s8 2.6 8.4 8.6c-2.2-2.6-4.6-4-8.6-4.2-2.4 1.8-5.2 2.8-8.2 4.2z"/>`;
      case 'bob': return `<path fill="${c}" d="M11.8 15.8c.8-4.6 3.8-7.2 8.2-7.2s7.4 2.6 8.2 7.2z"/>`;
      case 'bun':
      case 'pony': return `<path fill="${c}" d="M11.6 17C11.8 11 15.4 8.6 20 8.6s8.2 2.4 8.4 8.4c-1.8-2.8-4.6-4.2-8.4-4.2s-6.6 1.4-8.4 4.2z"/>`;
      case 'curlylong': return circles([[14.6, 11.2, 2.5], [18.6, 9.8, 2.6], [22.6, 10.2, 2.5], [25.8, 12.4, 2.2]], c);
      case 'pixie': return `<path fill="${c}" d="M11.6 18C11 11 14.6 7.6 20 7.6c5.6 0 9 3 8.4 9.4-1.4-2.6-3-3.8-5.6-4.2-2.6 2.6-6.6 3.6-11.2 5.2z"/>`;
    }
    return '';
  }

  const BROWS = {
    normal: 'M14.9 16.5q1.7-1 3.4-.1M21.7 16.4q1.7-.9 3.4.1',
    suspicious: 'M14.9 16.6q1.7-.6 3.4 0M21.6 15.2q1.9-1.2 3.6.2',
    angry: 'M14.9 15.6l3.4 1.2M25.1 15.6l-3.4 1.2',
    worried: 'M14.9 16.9l3.4-1.1M25.1 16.9l-3.4-1.1'
  };
  function mouth(kind, color, y) {
    const d = y - 23.2;
    const t = `transform="translate(0 ${d.toFixed(2)})"`;
    switch (kind) {
      case 'smile': return `<path ${t} d="M17.4 23.2q2.6 2 5.2 0" stroke="${color}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
      case 'smirk': return `<path ${t} d="M17.8 23.8q2.8.8 4.6-1.1" stroke="${color}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
      case 'flat': return `<path ${t} d="M18.2 23.7h3.6" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'o': return `<ellipse ${t} cx="20" cy="23.9" rx=".95" ry="1.15" fill="${MOUTH}"/>`;
      case 'grin': return `<g ${t}><path d="M17.2 22.9h5.6q-.4 2.7-2.8 2.7t-2.8-2.7z" fill="${MOUTH}"/><path d="M17.6 22.9h4.8v.9h-4.8z" fill="#fff"/></g>`;
      case 'wavy': return `<path ${t} d="M17.4 23.6q1.3-1 2.6 0t2.6 0" stroke="${color}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    }
    return '';
  }

  function face(person, slot) {
    const victim = person.role === 'victim';
    const fem = person.g === 'f';
    const r = rng(hash(person.name) + 7);
    const pick = arr => arr[Math.floor(r() * arr.length)];
    const chance = p => r() < p;

    const styles = fem ? F_STYLES : M_STYLES;
    let style = styles[(Math.floor(r() * styles.length) + (slot || 0)) % styles.length];
    let [skin, skinD] = pick(SKIN);
    let hair = pick(HAIR);
    const accent = pick(ACCENT);
    let brows = pick(['normal', 'normal', 'suspicious', 'angry', 'worried']);
    let expr = pick(['smile', 'smirk', 'flat', 'o', 'grin', 'smile']);
    let glasses = chance(.25), monocle = !fem && !glasses && chance(.1), hat = !fem && chance(.16), beret = fem && chance(.12);
    let mustache = !fem && chance(.35), beard = !fem && !mustache && chance(.25), goatee = !fem && !mustache && !beard && chance(.15);
    const earrings = fem && chance(.45), pearls = fem && chance(.3), lips = fem && chance(.45), blush = chance(fem ? .6 : .25);
    const sweat = chance(.18), tie = !fem && chance(.6);

    if (victim) {
      skin = '#ece3d9'; skinD = '#cdbfb2'; hair = '#b8b8b8';
      style = fem ? 'bun' : 'bald';
      brows = 'normal'; expr = pick(['o', 'wavy']);
      glasses = false; beret = false; hat = false; beard = false; goatee = false;
      mustache = !fem; monocle = !fem;
    }

    const hairD = hair;
    let s = '<svg class="face" viewBox="3 2 34 34" aria-hidden="true">';
    s += backHair(style, hair);
    // ropa
    s += victim
      ? '<path d="M3 41C3 32 10 29 20 29s17 3 17 12z" fill="#5a4a66"/><path d="M15.4 28.6l4.6 2.4-2.2 3zM24.6 28.6L20 31l2.2 3z" fill="#fff"/>'
      : '<path d="M3 41C3 32 10 29 20 29s17 3 17 12z" fill="rgba(0,0,0,.26)"/>';
    s += `<rect x="16.6" y="23.5" width="6.8" height="7" rx="2.4" fill="${skinD}"/>`;
    if (!victim && !fem) {
      s += '<path d="M15.4 28.6l4.6 2.2-2.2 2.6zM24.6 28.6L20 30.8l2.2 2.6z" fill="#fff" opacity=".9"/>';
      s += tie ? `<path d="M19 30.4h2l.6 1.1-1.6 5.5-1.6-5.5z" fill="${accent}"/>` : `<path d="M16.8 30l3.2 1.5 3.2-1.5v3l-3.2-1.5-3.2 1.5z" fill="${accent}"/>`;
    }
    if (pearls || (victim && fem)) s += circles([[15, 30.2, .8], [16.6, 31.1, .8], [18.3, 31.6, .8], [20, 31.8, .8], [21.7, 31.6, .8], [23.4, 31.1, .8], [25, 30.2, .8]], '#fbfaf6');
    // cabeza
    s += `<circle cx="12.1" cy="19.4" r="1.9" fill="${skin}"/><circle cx="27.9" cy="19.4" r="1.9" fill="${skin}"/>`;
    s += `<ellipse cx="20" cy="18.2" rx="8" ry="9.2" fill="${skin}"/>`;
    if (beard) s += `<path fill="${hairD}" d="M11.8 19.5c0 6.6 3.8 9.4 8.2 9.4s8.2-2.8 8.2-9.4c-1 3.6-3.6 5.6-8.2 5.6s-7.2-2-8.2-5.6z"/>`;
    s += frontHair(style, hair);
    if (earrings) s += `<circle cx="12" cy="21.8" r="1" fill="#e9c25a"/><circle cx="28" cy="21.8" r="1" fill="#e9c25a"/>`;
    // cara
    if (blush) s += '<circle cx="15.1" cy="22" r="1.5" fill="#ff7a6b" opacity=".3"/><circle cx="24.9" cy="22" r="1.5" fill="#ff7a6b" opacity=".3"/>';
    s += `<path d="${BROWS[brows]}" stroke="${victim ? '#9a9a9a' : hairD}" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;
    if (victim) {
      s += `<path d="M15.4 18.1l2.4 2.4M17.8 18.1l-2.4 2.4M22.2 18.1l2.4 2.4M24.6 18.1l-2.4 2.4" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`;
    } else {
      s += `<circle cx="16.6" cy="19.3" r="1.25" fill="${INK}"/><circle cx="23.4" cy="19.3" r="1.25" fill="${INK}"/>`;
      s += '<circle cx="17" cy="18.9" r=".38" fill="#fff"/><circle cx="23.8" cy="18.9" r=".38" fill="#fff"/>';
      if (fem) s += `<path d="M15.1 18.6l-1-.6M24.9 18.6l1-.6" stroke="${INK}" stroke-width=".8" stroke-linecap="round"/>`;
    }
    s += `<path d="M20 19.8v2.3c0 .5.4.8.9.8" stroke="${skinD}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    const mouthY = mustache ? 24.4 : 23.2;
    s += mouth(expr, lips ? '#c2475a' : MOUTH, mouthY);
    if (mustache) s += `<path fill="${hairD}" d="M16.4 22.6c1.4-1.4 2.9-1.1 3.6-.3.7-.8 2.2-1.1 3.6.3-1.4.9-2.7.8-3.6.2-.9.6-2.2.7-3.6-.2z"/>`;
    if (goatee) s += `<path fill="${hairD}" d="M18 25.6c.6 1.6 1.2 2.3 2 2.3s1.4-.7 2-2.3c-1.2.6-2.8.6-4 0z"/>`;
    if (glasses) s += '<g fill="rgba(255,255,255,.2)" stroke="#1d1d22" stroke-width="1"><circle cx="16.6" cy="19.3" r="2.7"/><circle cx="23.4" cy="19.3" r="2.7"/></g><path d="M19.3 19.1h1.4M13.9 18.8l-1.6-.6M26.1 18.8l1.6-.6" stroke="#1d1d22" stroke-width="1"/>';
    if (monocle) s += '<circle cx="23.4" cy="19.3" r="2.8" fill="rgba(255,255,255,.2)" stroke="#e9c25a" stroke-width="1.1"/><path d="M26 20.6q1.6 4-.4 8.4" stroke="#e9c25a" stroke-width=".6" fill="none"/>';
    if (sweat && !victim) s += '<path d="M28.6 12.6c.8 1.2 1.3 2 1.3 2.7a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.5 1.3-2.7z" fill="#8fd0f5"/>';
    if (hat) s += `<path d="M12.4 11.4C12.4 4.4 27.6 4.4 27.6 11.4z" fill="#26262b"/><rect x="9" y="10.6" width="22" height="2.2" rx="1.1" fill="#26262b"/><rect x="12.5" y="9.2" width="15" height="1.6" fill="${accent === '#26262b' ? '#e2685a' : accent}"/>`;
    if (beret) s += `<ellipse cx="17.6" cy="9.4" rx="9" ry="3.6" fill="${accent}"/><circle cx="17.6" cy="5.9" r="1" fill="${accent}"/>`;
    if (victim && !fem) s += '<rect x="13.4" y="1.6" width="13.2" height="8.8" rx="1" fill="#26262b"/><rect x="10" y="9.8" width="20" height="2.3" rx="1.15" fill="#26262b"/><rect x="13.4" y="7.8" width="13.2" height="1.6" fill="#b8434f"/>';
    if (victim && fem) s += '<path d="M14.2 10.6l1.9-3.2 2 2.2 1.9-3.6 1.9 3.6 2-2.2 1.9 3.2z" fill="#e9c25a"/>';
    return s + '</svg>';
  }

  root.MurdokuFaces = { face };
})(typeof self !== 'undefined' ? self : this);
