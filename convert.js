/* Convertisseur : une page d'accords (paroles comprises) → grille en boucles.
   Sert à l'import par copier-coller dans l'app, et à la génération de data.js
   (node build/…). Ne garde que les accords : les paroles sont ignorées.
   Sortie : { capo, s: "Couplet: Am | F | C | G / Refrain: …" } ou null. */
(function (root) {
  'use strict';

  var FR = { do: 'C', re: 'D', ré: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
  var QUAL = { '': '', m: 'm', min: 'm', '-': 'm', maj: '', M: '', '7': '7', m7: 'm7', min7: 'm7', '-7': 'm7',
    maj7: 'maj7', M7: 'maj7', '7M': 'maj7', Δ: 'maj7', m9: 'm9', '9': '9', add9: 'add9', add2: 'add9', '2': 'sus2',
    sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '4': 'sus4', '5': '5', '6': '', m6: 'm', '11': '', '13': '7',
    '7sus4': '7', dim: 'm', '°': 'm', m7b5: 'm', 'ø': 'm', aug: '', '+': '', mmaj7: 'm', '9sus4': 'sus4' };

  // Un mot → nom d'accord normalisé (« Am », « F#m7 », « D/F# »), ou null.
  function chord(tok) {
    tok = tok.replace(/^[(\[{]+|[)\]}.,;:*]+$/g, '');
    var m = /^(do|r[eé]|mi|fa|sol|la|si|[A-G])([#♯b♭]?)([^/]*)(?:\/(do|r[eé]|mi|fa|sol|la|si|[A-G])([#♯b♭]?))?$/i.exec(tok);
    if (!m) return null;
    var root = m[1], fr = root.length > 1;
    if (!fr && root !== root.toUpperCase()) return null;          // « a », « e » : des mots
    if (fr && root[0] !== root[0].toUpperCase()) return null;     // « la », « si » : des mots
    root = fr ? FR[root.toLowerCase()] : root;
    var q = m[3].replace(/[()]/g, '');
    if (!(q in QUAL)) return null;
    var acc = m[2].replace('♯', '#').replace('♭', 'b');
    var bass = '';
    if (m[4]) {
      var b = m[4].length > 1 ? FR[m[4].toLowerCase()] : m[4];
      if (!b || (m[4].length === 1 && m[4] !== m[4].toUpperCase())) return null;
      bass = '/' + b + m[5].replace('♯', '#').replace('♭', 'b');
    }
    return root + acc + QUAL[q] + bass;
  }

  var LABELS = [
    [/^(intro|introduction)/i, 'Intro'], [/^(pr[eé][- ]?(refrain|chorus)|pre)/i, 'Pré-refrain'],
    [/^(couplet|verse|verset|cplt)/i, 'Couplet'], [/^(refrain|chorus|hook|ref)/i, 'Refrain'],
    [/^(pont|bridge|break|interlude|instru)/i, 'Pont'], [/^(outro|fin|coda|ending)/i, 'Outro']
  ];
  function label(line) {
    var t = line.trim().replace(/^[\[(]\s*|\s*[\])]\s*:?$|:$/g, '').trim();
    if (!t || t.length > 30) return null;
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i][0].test(t)) return LABELS[i][1];
    return null;
  }
  var NOISE = /^(\|+|-+|%|\/+|x\d+|\(?x\s?\d+\)?|\d+x|\(\d+\)|n\.?c\.?|→|\.\.\.|…|:\|\|?|\|\|?:)$/i;

  function lineChords(line) {
    var inline = [], m, re = /\[([^\]\s]{1,10})\]/g;
    while ((m = re.exec(line))) { var c = chord(m[1]); if (c) inline.push(c); }
    if (inline.length) return inline;                               // format ChordPro : [Am]paroles
    var toks = line.replace(/[|]/g, ' ').split(/\s+/).filter(function (t) { return t && !NOISE.test(t); });
    if (!toks.length) return null;
    var out = [];
    toks.forEach(function (t) { var c = chord(t); if (c) out.push(c); });
    return out.length && out.length / toks.length >= 0.7 ? out : null;
  }

  // Plus courte période qui explique la suite (tolère 12 % d'écarts).
  function loopOf(seq) {
    var n = seq.length;
    for (var p = 1; p <= Math.min(8, n); p++) {
      if (p > n / 1.5 && p !== n) continue;
      var bad = 0;
      for (var i = p; i < n; i++) if (seq[i] !== seq[i % p]) bad++;
      if (bad <= Math.floor(n * 0.12)) return seq.slice(0, p);
    }
    return n <= 8 ? seq : null;
  }
  function canon(loop) {
    var best = null;
    for (var i = 0; i < loop.length; i++) {
      var r = loop.slice(i).concat(loop.slice(0, i)).join(' ');
      if (best === null || r < best) best = r;
    }
    return best;
  }
  // Une suite qui se répète elle-même (« Em Am Em Am ») se réduit à sa période.
  function periodic(w) {
    for (var p = 1; p < w.length; p++) {
      if (w.length % p) continue;
      var ok = true;
      for (var i = p; i < w.length && ok; i++) ok = w[i] === w[i - p];
      if (ok) return true;
    }
    return false;
  }
  // Boucles qui couvrent le plus de morceau, choisies l'une après l'autre (3 au plus).
  function findLoops(seq) {
    var n = seq.length, covered = new Array(n), out = [];
    var single = {}; seq.forEach(function (c) { single[c] = 1; });
    if (Object.keys(single).length === 1) return [{ loop: [seq[0]], at: [0], n: n }];
    for (var round = 0; round < 3; round++) {
      var cands = [];
      for (var p = 2; p <= 8; p++) {
        var seen = {};
        for (var i = 0; i + p <= n; i++) {
          var blocked = false;
          for (var j = i; j < i + p; j++) if (covered[j]) { blocked = true; break; }
          if (blocked) continue;
          var w = seq.slice(i, i + p), k = w.join(' ');
          var e = seen[k] || (seen[k] = { w: w, count: 0, end: 0, at: [] });
          if (i >= e.end) { e.count++; e.end = i + p; e.at.push(i); }
        }
        Object.keys(seen).forEach(function (k) {
          var e = seen[k];
          if (e.count >= 2 && !periodic(e.w)) cands.push({ w: e.w, at: e.at, cov: e.count * e.w.length });
        });
      }
      // La plus couvrante ; à 10 % près, la plus courte, puis la plus tôt dans le morceau.
      var max = 0; cands.forEach(function (c) { if (c.cov > max) max = c.cov; });
      var best = null;
      cands.forEach(function (c) {
        if (c.cov < max * 0.9) return;
        if (!best || c.w.length < best.w.length || (c.w.length === best.w.length && (c.cov > best.cov || (c.cov === best.cov && c.at[0] < best.at[0])))) best = c;
      });
      if (!best || best.cov < Math.max(4, n * (round ? 0.15 : 0))) break;
      best.at.forEach(function (i) { for (var j = i; j < i + best.w.length; j++) covered[j] = true; });
      out.push({ loop: best.w, at: best.at, n: best.cov });
    }
    if (!out.length && n <= 8) out.push({ loop: seq, at: [0], n: n });
    return out;
  }

  // Quand deux passages partagent la même boucle, « Couplet » ou « Refrain » parlent plus qu'« Intro ».
  function better(a, b) {
    var rank = { Refrain: 5, Couplet: 4, 'Pré-refrain': 3, Pont: 2, Intro: 1, Outro: 1 };
    return (rank[b] || 0) > (rank[a] || 0) ? b : a;
  }

  function convert(text) {
    text = String(text).replace(/\[\/?tab\]/g, '').replace(/\[ch\]([^\[]*)\[\/ch\]/g, ' $1 ').replace(/\r/g, '');
    var capo = 0, cm = /capo(?:dastre)?\s*(?:[:=à]|sur|en|case|fret)?\s*(\d{1,2}|I{1,3}|IV|V|VI{0,3}|IX)\b/i.exec(text);
    if (cm) {
      var rom = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
      capo = rom[cm[1].toUpperCase()] || parseInt(cm[1], 10) || 0;
      if (capo > 9) capo = 0;
    }
    var paras = [], cur = null, curLabel = null;
    text.split('\n').forEach(function (line) {
      var lb = label(line);
      if (lb) { cur = null; curLabel = lb; return; }
      var ch = lineChords(line);
      if (ch) {
        if (!cur) { cur = { label: curLabel, seq: [] }; paras.push(cur); curLabel = null; }
        cur.seq = cur.seq.concat(ch);
      } else if (!line.trim()) { cur = null; }
    });
    // Chaque paragraphe de la page est en général une partie : on cherche sa période.
    var found = [];
    paras.forEach(function (p, pi) {
      var seq = p.seq.filter(function (c, i) { return i === 0 || c !== p.seq[i - 1]; });
      if (!seq.length) return;
      var loop = loopOf(seq);
      if (loop && loop.length <= 8) { found.push({ loop: loop, n: seq.length, first: pi, label: p.label }); return; }
      findLoops(seq).forEach(function (l) { found.push({ loop: l.loop, n: l.n, first: pi + l.at[0] / 1000, label: p.label }); });
    });
    // Fusion : même boucle à une rotation près, ou même longueur à un accord près.
    var secs = [];
    found.forEach(function (f) {
      var k = canon(f.loop), twin = null;
      secs.forEach(function (s) {
        if (twin) return;
        if (s.key === k) { twin = s; return; }
        if (s.loop.length === f.loop.length && f.loop.length >= 3) {
          var diff = 0; for (var i = 0; i < f.loop.length; i++) if (s.loop[i] !== f.loop[i]) diff++;
          if (diff <= 1) twin = s;
        }
      });
      if (twin) {
        twin.n += f.n; twin.label = better(twin.label, f.label);
        if (f.n > twin.best) { twin.best = f.n; twin.loop = f.loop; }
        return;
      }
      secs.push({ key: k, loop: f.loop, n: f.n, best: f.n, first: f.first, label: f.label });
    });
    if (!secs.length) return null;
    // Une boucle contenue dans une autre : la courte disparaît si elle est marginale ;
    // la longue disparaît si elle n'est que la courte répétée avec un accord de passage.
    function count(small, big) {
      var b = ' ' + big.concat(big.slice(0, small.length - 1)).join(' ') + ' ', sm = ' ' + small.join(' ') + ' ', c = 0, i = 0;
      while ((i = b.indexOf(sm, i)) >= 0) { c++; i += sm.length - 1; }
      return small.length < big.length ? c : 0;
    }
    for (var changed = true; changed;) {
      changed = false;
      for (var x = 0; x < secs.length && !changed; x++) for (var y = 0; y < secs.length && !changed; y++) {
        if (x === y) continue;
        var sm = secs[x], bg = secs[y], c = count(sm.loop, bg.loop);
        if (!c) continue;
        var drop = c >= 2 ? bg : (sm.n < bg.n * 0.35 ? sm : null);
        if (!drop) continue;
        var keep = drop === sm ? bg : sm;
        keep.n += drop.n; keep.first = Math.min(keep.first, drop.first); keep.label = better(keep.label, drop.label);
        secs.splice(secs.indexOf(drop), 1); changed = true;
      }
    }
    var total = secs.reduce(function (t, s) { return t + s.n; }, 0);
    secs = secs.filter(function (s) { return s.n >= total * 0.08 && (s.loop.length > 1 || secs.length === 1); });
    secs = secs.sort(function (a, b) { return b.n - a.n; }).slice(0, 3).sort(function (a, b) { return a.first - b.first; });
    if (!secs.length) return null;
    var used = {}, letters = 'ABCDE', li = 0;
    var parts = secs.map(function (s) {
      var nm = secs.length === 1 ? 'Tout le morceau' : (s.label || 'Partie ' + letters[li++]);
      if (used[nm]) { used[nm]++; nm += ' ' + used[nm]; } else used[nm] = 1;
      return nm + ': ' + s.loop.join(' | ');
    });
    return { capo: capo, s: parts.join(' / '), nsec: secs.length, maxLoop: Math.max.apply(null, secs.map(function (s) { return s.loop.length; })) };
  }

  var api = { convert: convert, chord: chord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Convert = api;
})(this);
