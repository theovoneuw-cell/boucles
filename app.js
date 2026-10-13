(function () {
  'use strict';

  /* ---------- stockage (peut être indisponible : navigation privée) ---------- */
  function load(k, d) { try { var v = localStorage.getItem('boucles:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('boucles:' + k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- notes et accords ---------- */
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var QUALS = ['maj7', 'm7', 'm9', 'sus2', 'sus4', 'add9', '7', '9', '5', 'm', ''];

  function parse(name) {
    var m = /^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(name);
    if (!m) return null;
    var pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
    var q = QUALS.indexOf(m[3]) >= 0 ? m[3] : (m[3].charAt(0) === 'm' ? 'm' : '');
    var bass = m[4] ? (PC[m[4][0]] + (m[4][1] === '#' ? 1 : m[4][1] === 'b' ? 11 : 0)) % 12 : null;
    return { pc: pc, q: q, bass: bass };
  }
  function simplify(c) {
    var q = c.q;
    if (q === 'm7' || q === 'm9') q = 'm';
    else if (q !== 'm' && q !== '5') q = '';
    return { pc: c.pc, q: q, bass: null };
  }
  function shift(c, n) {
    return { pc: (c.pc + n + 120) % 12, q: c.q, bass: c.bass === null ? null : (c.bass + n + 120) % 12 };
  }
  function name(c, flats) {
    var T = flats ? FLAT : SHARP;
    return T[c.pc] + c.q + (c.bass !== null ? '/' + T[c.bass] : '');
  }
  // Orthographe : bémols pour les tonalités de fa, si♭, mi♭, la♭, ré♭ (et leurs relatives).
  function useFlats(first) {
    var maj = first.q === 'm' || first.q === 'm7' || first.q === 'm9' ? (first.pc + 3) % 12 : first.pc;
    return [5, 10, 3, 8, 1].indexOf(maj) >= 0;
  }

  /* ---------- formes ----------
     6 cases, de mi grave à mi aigu ; -1 = corde étouffée.
     d : difficulté (1 accord ouvert, 2 petit barré ou accord de puissance, 3 barré). */
  var OPEN = {
    'C': [-1, 3, 2, 0, 1, 0], 'C7': [-1, 3, 2, 3, 1, 0], 'Cmaj7': [-1, 3, 2, 0, 0, 0], 'Cadd9': [-1, 3, 2, 0, 3, 0],
    'D': [-1, -1, 0, 2, 3, 2], 'Dm': [-1, -1, 0, 2, 3, 1], 'D7': [-1, -1, 0, 2, 1, 2], 'Dm7': [-1, -1, 0, 2, 1, 1],
    'Dmaj7': [-1, -1, 0, 2, 2, 2], 'Dsus2': [-1, -1, 0, 2, 3, 0], 'Dsus4': [-1, -1, 0, 2, 3, 3], 'D5': [-1, -1, 0, 2, 3, -1],
    'D9': [-1, -1, 0, 2, 1, 0], 'D/F#': [2, -1, 0, 2, 3, 2], 'Dm/A': [-1, 0, 0, 2, 3, 1],
    'E': [0, 2, 2, 1, 0, 0], 'Em': [0, 2, 2, 0, 0, 0], 'E7': [0, 2, 0, 1, 0, 0], 'Em7': [0, 2, 2, 0, 3, 0],
    'Esus4': [0, 2, 2, 2, 0, 0], 'E5': [0, 2, 2, -1, -1, -1],
    'F': [-1, -1, 3, 2, 1, 1], 'Fmaj7': [-1, -1, 3, 2, 1, 0],
    'G': [3, 2, 0, 0, 0, 3], 'G7': [3, 2, 0, 0, 0, 1], 'Gmaj7': [3, 2, 0, 0, 0, 2], 'G9': [3, -1, 3, 2, 0, 1], 'G/B': [-1, 2, 0, 0, 0, 3],
    'A': [-1, 0, 2, 2, 2, 0], 'Am': [-1, 0, 2, 2, 1, 0], 'A7': [-1, 0, 2, 0, 2, 0], 'Am7': [-1, 0, 2, 0, 1, 0],
    'Amaj7': [-1, 0, 2, 1, 2, 0], 'Asus2': [-1, 0, 2, 2, 0, 0], 'Asus4': [-1, 0, 2, 2, 3, 0], 'A5': [-1, 0, 2, 2, -1, -1],
    'B7': [-1, 2, 1, 2, 0, 2]
  };
  var HARDER = { 'F': 2, 'D/F#': 2, 'G9': 2 };
  // Formes mobiles : décalages depuis la case de la fondamentale (corde de mi grave ou de la).
  var EFORM = { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
    maj7: [0, null, 1, 1, 0, null], sus4: [0, 2, 2, 2, 0, 0], '5': [0, 2, 2, null, null, null] };
  var AFORM = { '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0],
    maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0], '5': [null, 0, 2, 2, null, null],
    '9': [null, 0, -1, 0, 0, 0], m9: [null, 0, -2, 0, 0, null] };

  var vcache = {};
  function voicing(c) {
    var key = name(c, false);
    if (vcache[key]) return vcache[key];
    var v = null, d = 1;
    var nm = [key, name(c, true)];
    for (var i = 0; i < 2 && !v; i++) if (OPEN[nm[i]]) { v = OPEN[nm[i]]; d = HARDER[nm[i]] || 1; }
    if (!v && c.bass !== null) { var b = voicing({ pc: c.pc, q: c.q, bass: null }); v = b.f; d = b.d; }
    if (!v) {
      var q = c.q;
      if (!EFORM[q] && !AFORM[q]) q = (q === 'm7' || q === 'm9') ? 'm' : '';
      var fe = (c.pc - 4 + 12) % 12, fa = (c.pc - 9 + 12) % 12;
      var cands = [];
      if (EFORM[q]) cands.push([fe, EFORM[q]]);
      if (AFORM[q]) cands.push([fa, AFORM[q]]);
      // forme qui descendrait sous le sillet (A9 en forme de la) : on la joue une octave plus haut
      cands.forEach(function (x) { if (x[0] + Math.min.apply(null, x[1].filter(function (o) { return o !== null; })) < 0) x[0] += 12; });
      cands.sort(function (x, y) { return x[0] - y[0]; });
      var f = cands[0][0], t = cands[0][1];
      v = t.map(function (o) { return o === null ? -1 : f + o; });
      d = q === '5' ? 2 : (f === 0 ? 1 : 3);
    }
    return (vcache[key] = { f: v, d: d });
  }

  /* ---------- morceaux ---------- */
  function slug(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // kind : 'main' (grilles vérifiées à la main), 'auto' (converties automatiquement), 'perso' (ajoutées sur ce téléphone).
  function build(s, kind) {
    var sections = s.s.split(' / ').map(function (part) {
      var i = part.indexOf(':');
      var bars = part.slice(i + 1).trim().split('|').map(function (b) {
        return b.trim().split(/\s+/).map(parse).filter(Boolean);
      }).filter(function (b) { return b.length; });
      return { n: part.slice(0, i).trim(), bars: bars };
    }).filter(function (sec) { return sec.bars.length; });
    if (!sections.length) return null;
    var uniq = [], seen = {};
    sections.forEach(function (sec) { sec.bars.forEach(function (b) { b.forEach(function (c) {
      var k = name(c, false); if (!seen[k]) { seen[k] = 1; uniq.push(c); } }); }); });
    var song = { id: (kind === 'perso' ? 'perso-' : '') + slug(s.a + ' ' + s.t), t: s.t, a: s.a, capo: s.capo || 0, r: s.r || 'ballade',
      sections: sections, uniq: uniq, kind: kind, src: s.src || (kind === 'main' ? 'bac' : ''), u: s.u || '', d: s.d || '' };
    var k = bestCapo(song, 0, false);
    song.easyCapo = k;
    song.noBarre = score(song, song.capo - k, false).max <= 2;
    return song;
  }
  var SONGS = [], BY = {};
  function rebuild() {
    SONGS = []; BY = {};
    var add = function (kind) { return function (s) { var x = build(s, kind); if (x && !BY[x.id]) { SONGS.push(x); BY[x.id] = x; } }; };
    (window.SONGS || []).forEach(add('main'));
    (window.SONGS_AUTO || []).forEach(add('auto'));
    load('perso', []).forEach(add('perso'));
  }

  // Score de difficulté pour un décalage de formes donné.
  function score(song, delta, simple) {
    var tot = 0, max = 0;
    song.uniq.forEach(function (c) {
      var x = shift(simple ? simplify(c) : c, delta);
      var d = voicing(x).d; tot += d; if (d > max) max = d;
    });
    return { tot: tot, max: max };
  }
  // Capo qui donne les formes les plus simples sans changer la hauteur réelle.
  function bestCapo(song, shiftT, simple) {
    var best = 0, bs = Infinity;
    for (var k = 0; k <= 7; k++) {
      var sc = score(song, song.capo + shiftT - k, simple);
      var v = sc.tot * 10 + sc.max * 3 + k * 0.5;
      if (v < bs) { bs = v; best = k; }
    }
    return best;
  }
  rebuild();

  /* ---------- rythmiques ----------
     8 croches par mesure. B = bas, H = haut, X = étouffé (coup de paume), - = rien. */
  var RYTHMES = [
    { id: 'noires', nom: 'Noires', p: 'B-B-B-B-', bpm: 70 },
    { id: 'ballade', nom: 'Ballade', p: 'B-BH-HBH', bpm: 80 },
    { id: 'pose', nom: 'Posé', p: 'B---B-BH', bpm: 72 },
    { id: 'boombap', nom: 'Boom bap', p: 'B-XH-HXH', bpm: 88 },
    { id: 'afro', nom: 'Afro', p: 'B--B--BH', bpm: 100 },
    { id: 'croches', nom: 'Croches', p: 'BHBHBHBH', bpm: 90 }
  ];
  var RBY = {}; RYTHMES.forEach(function (r) { RBY[r.id] = r; });

  /* ---------- diagrammes ---------- */
  function svgChord(c) {
    var v = voicing(c).f;
    var played = v.filter(function (x) { return x > 0; });
    var mx = Math.max.apply(null, played.concat([1])), mn = Math.min.apply(null, played.concat([99]));
    var start = mx <= 4 ? 1 : mn;
    var NF = 4, L = 13, T = 16, G = 9.4, H = 12.5, W = L + 6 + G * 5;
    var s = '<svg viewBox="0 0 ' + W + ' ' + (T + NF * H + 6) + '" aria-hidden="true">';
    s += start === 1
      ? '<rect x="' + L + '" y="' + (T - 2.6) + '" width="' + (G * 5) + '" height="2.6" class="nut"/>'
      : '<text x="' + (L - 6) + '" y="' + (T + H * 0.5 + 3) + '" class="fr" text-anchor="end">' + start + '</text>';
    for (var i = 0; i < 6; i++) s += '<line x1="' + (L + i * G) + '" y1="' + T + '" x2="' + (L + i * G) + '" y2="' + (T + NF * H) + '" class="st"/>';
    for (var j = 0; j <= NF; j++) s += '<line x1="' + L + '" y1="' + (T + j * H) + '" x2="' + (L + 5 * G) + '" y2="' + (T + j * H) + '" class="fl"/>';
    // barré : même case la plus basse sur plusieurs cordes, jusqu'au mi aigu
    var bf = played.length ? mn : 0, from = -1, cnt = 0;
    if (bf > 0 && v[5] === bf) { for (i = 0; i < 6; i++) if (v[i] === bf) { cnt++; if (from < 0) from = i; } }
    var barre = cnt >= 2;
    for (i = from; barre && i < 6; i++) if (v[i] === 0) barre = false;   // pas de barré sur une corde à vide
    if (barre) {
      var y = T + (bf - start + 0.5) * H;
      s += '<rect x="' + (L + from * G - 3.6) + '" y="' + (y - 3.6) + '" width="' + ((5 - from) * G + 7.2) + '" height="7.2" rx="3.6" class="dot"/>';
    }
    for (i = 0; i < 6; i++) {
      var x = L + i * G;
      if (v[i] < 0) s += '<text x="' + x + '" y="' + (T - 5) + '" class="mk" text-anchor="middle">×</text>';
      else if (v[i] === 0) s += '<circle cx="' + x + '" cy="' + (T - 7.4) + '" r="2.6" class="op"/>';
      else if (!(barre && v[i] === bf)) s += '<circle cx="' + x + '" cy="' + (T + (v[i] - start + 0.5) * H) + '" r="3.7" class="dot"/>';
    }
    return s + '</svg>';
  }

  /* ---------- audio ---------- */
  var ac = null, master = null, ksCache = {}, muteBuf = null, ring = [];
  function audio() {
    if (!ac) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      ac = new (window.AudioContext || window.webkitAudioContext)();
      var comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  // Corde pincée (Karplus-Strong), mise en cache par hauteur.
  function ks(midi) {
    if (ksCache[midi]) return ksCache[midi];
    var sr = ac.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), N = Math.round(sr / f);
    var len = Math.floor(sr * 1.6), buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    var prev = 0;
    for (var i = 0; i < N; i++) { var w = Math.random() * 2 - 1; prev = prev * 0.5 + w * 0.5; d[i] = prev; }
    var decay = midi < 52 ? 0.997 : 0.995;
    for (i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N + 1]);
    return (ksCache[midi] = buf);
  }
  function mutedBuf() {
    if (muteBuf) return muteBuf;
    var sr = ac.sampleRate, len = Math.floor(sr * 0.07), b = ac.createBuffer(1, len, sr), d = b.getChannelData(0), p = 0;
    for (var i = 0; i < len; i++) { p = p * 0.7 + (Math.random() * 2 - 1) * 0.3; d[i] = p * Math.exp(-i / (sr * 0.012)); }
    return (muteBuf = b);
  }
  var OPEN_MIDI = [40, 45, 50, 55, 59, 64];
  function strum(frets, capo, t, dir) {
    var order = dir === 'H' ? [5, 4, 3, 2] : [0, 1, 2, 3, 4, 5];
    var k = 0;
    order.forEach(function (sIdx) {
      var fr = frets[sIdx];
      if (fr < 0) return;
      var when = t + (k++) * (dir === 'H' ? 0.009 : 0.012);
      if (ring[sIdx]) { try { ring[sIdx].gain.setTargetAtTime(0, when, 0.015); } catch (e) {} }
      var src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = dir === 'X' ? mutedBuf() : ks(OPEN_MIDI[sIdx] + fr + capo);
      g.gain.value = dir === 'H' ? 0.22 : dir === 'X' ? 0.5 : 0.3;
      src.connect(g); g.connect(master); src.start(when); src.stop(when + (dir === 'X' ? 0.08 : 1.6));
      if (dir !== 'X') ring[sIdx] = g;
    });
  }
  function click(t, accent) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = accent ? 1760 : 1180;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.05);
  }

  /* ---------- vues ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app');
  var favs = load('favs', {});
  var listState = load('list', { q: '', f: 'tout' });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function route() {
    stop();
    var h = location.hash.replace(/^#\/?/, '');
    if (h === 'ajouter') renderAdd();
    else if (h && BY[h]) renderSong(BY[h]); else renderList();
  }

  /* ----- répertoire ----- */
  function renderList() {
    document.title = 'Boucles';
    app.innerHTML =
      '<header class="top"><div class="toprow"><h1><svg class="mark" viewBox="0 0 130 250" aria-hidden="true"><rect width="36" height="250" rx="3"/><rect x="50" width="12" height="250" rx="2"/><circle cx="111" cy="81" r="19" class="ac"/><circle cx="111" cy="169" r="19" class="ac"/></svg>Boucles</h1>' +
      '<button class="icon" id="refresh" aria-label="Actualiser le catalogue"><svg viewBox="0 0 20 20"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2"/></svg></button>' +
      '<a class="icon" href="#/ajouter" aria-label="Ajouter un morceau"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg></a></div>' +
      '<p class="sub" id="count"></p><p class="status" id="status" aria-live="polite"></p></header>' +
      '<div class="tools"><label class="search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>' +
      '<input type="search" id="q" placeholder="Titre ou artiste" autocomplete="off" autocorrect="off" spellcheck="false"></label>' +
      '<div class="seg" id="f" role="tablist">' +
      ['tout:Tout', 'nouveaux:Nouveaux', 'facile:Faciles', 'favoris:Favoris', 'perso:Ajoutés'].map(function (x) {
        var p = x.split(':'); return '<button data-f="' + p[0] + '" role="tab">' + p[1] + '</button>';
      }).join('') + '</div></div><div id="list" class="list"></div>';
    var q = $('#q'); q.value = listState.q;
    q.addEventListener('input', function () { listState.q = q.value; save('list', listState); fillList(); });
    $('#f').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      listState.f = b.dataset.f; save('list', listState); fillList();
    });
    $('#refresh').onclick = refresh;
    paintCount();
    fillList();
    var y = load('scroll', 0); if (y) window.scrollTo(0, y);
  }
  function paintCount() {
    var el = $('#count'); if (!el) return;
    var m = load('autoMeta', null);
    el.textContent = SONGS.length.toLocaleString('fr-FR') + ' morceaux de rap français en accords grattés' +
      (m && m.updated ? ' · catalogue du ' + new Date(m.updated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '');
  }
  // Le catalogue est rafraîchi chaque jour par le robot du dépôt (GitHub Actions) ;
  // ce bouton va chercher la dernière version publiée.
  function refresh() {
    var b = $('#refresh'), st = $('#status');
    if (b.classList.contains('spin')) return;
    b.classList.add('spin'); st.textContent = 'Recherche des nouveaux morceaux…';
    var before = {}; SONGS.forEach(function (x) { before[x.id] = 1; });
    loadAuto(true).then(function () {
      var fresh = SONGS.filter(function (x) { return !before[x.id]; });
      var m = load('autoMeta', {});
      st.textContent = fresh.length
        ? fresh.length + (fresh.length > 1 ? ' nouveaux morceaux.' : ' nouveau morceau.')
        : 'Rien de neuf depuis la dernière fois. Le robot repasse sur les sites toutes les 6 heures' +
          (m.updated ? ' (dernier passage le ' + new Date(m.updated).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ')' : '') + '.';
      if (fresh.length) { listState.f = 'nouveaux'; save('list', listState); }
      paintCount(); fillList();
    }, function (e) {
      if (window.console) console.error(e);
      st.textContent = 'Pas de connexion : le catalogue enregistré reste disponible.';
    }).then(function () { b.classList.remove('spin'); });
  }
  function fillList() {
    [].forEach.call(document.querySelectorAll('#f button'), function (b) { b.setAttribute('aria-selected', b.dataset.f === listState.f); });
    var q = fold(listState.q.trim());
    var rows = SONGS.filter(function (s) {
      if (listState.f === 'facile' && !s.noBarre) return false;
      if (listState.f === 'favoris' && !favs[s.id]) return false;
      if (listState.f === 'perso' && s.kind !== 'perso') return false;
      if (listState.f === 'nouveaux' && !s.d) return false;
      return !q || q.split(/\s+/).every(function (w) { return fold(s.t + ' ' + s.a).indexOf(w) >= 0; });
    }).sort(function (x, y) {
      return (listState.f === 'nouveaux' ? y.d.localeCompare(x.d) : 0) || x.a.localeCompare(y.a, 'fr') || x.t.localeCompare(y.t, 'fr');
    });
    var html = '', last = '';
    rows.forEach(function (s) {
      var group = listState.f === 'nouveaux' ? 'Ajouté le ' + new Date(s.d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : s.a;
      if (group !== last) { html += '<h2 class="artist">' + esc(group) + '</h2>'; last = group; }
      var easy = listState.f === 'facile';
      var delta = easy ? s.capo - s.easyCapo : 0;
      var fl = useFlats(shift(s.uniq[0], delta + (easy ? s.easyCapo : s.capo)));
      var ch = s.uniq.slice(0, 4).map(function (c) { return name(shift(c, delta), fl); }).join(' ') + (s.uniq.length > 4 ? ' …' : '');
      var k = easy ? s.easyCapo : s.capo;
      html += '<a class="row" href="#/' + s.id + '"><span class="tt">' + esc(s.t) + (listState.f === 'nouveaux' ? '<small>' + esc(s.a) + '</small>' : '') + (favs[s.id] ? ' <i class="star" aria-label="favori">★</i>' : '') + '</span>' +
        '<span class="ch">' + esc(ch) + (k ? '<em>capo ' + k + '</em>' : '') + '</span></a>';
    });
    var empty = { favoris: 'Aucun favori pour l’instant. Touchez l’étoile d’un morceau pour le garder ici.',
      nouveaux: 'Pas encore de nouveautés. Le robot passe toutes les 6 heures sur les sites d’accords ; touchez ↻ pour aller les chercher.',
      perso: 'Aucun morceau ajouté. Le bouton + en haut permet d’en importer un depuis n’importe quel site d’accords.' }[listState.f] || 'Aucun morceau ne correspond.';
    $('#list').innerHTML = (html || '<p class="empty">' + empty + '</p>') + elsewhere(listState.q.trim());
  }
  /* Recherche sur les gros sites d'accords. Ils ne laissent pas une autre app lire leurs pages :
     on ouvre la recherche dans Safari, puis on importe le morceau par copier-coller. */
  var SITES = [
    { nom: 'Ultimate Guitar', d: 'le plus gros catalogue, beaucoup de rap actuel', u: 'https://www.ultimate-guitar.com/search.php?search_type=title&value=' },
    { nom: 'Chordify', d: 'accords détectés sur n’importe quel son de YouTube', u: 'https://chordify.net/search/' },
    { nom: 'La Boîte à chansons', d: 'relevés en français', u: 'https://www.google.com/search?q=site%3Aboiteachansons.net+' },
    { nom: 'Google', d: 'toutes les pages « accords guitare »', u: 'https://www.google.com/search?q=accords+guitare+' }
  ];
  function siteLinks(q) {
    return SITES.map(function (x) {
      return '<a class="site" target="_blank" rel="noopener" href="' + x.u + encodeURIComponent(q).replace(/%20/g, '+') + '"><b>' + x.nom + '</b><span>' + x.d + '</span>' +
        '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4L5 15"/></svg></a>';
    }).join('');
  }
  function elsewhere(q) {
    return '<section class="away"><h2>' + (q ? 'Chercher « ' + esc(q) + ' » ailleurs' : 'Pas dans la liste ?') + '</h2>' +
      (q ? siteLinks(q) : '<p class="muted">Tapez un titre ou un artiste : la recherche s’étend aussi aux sites d’accords.</p>') +
      '<a class="tog wide" href="#/ajouter' + '">Importer un morceau trouvé sur un site</a></section>';
  }
  window.addEventListener('scroll', function () { if (!location.hash.slice(2)) save('scroll', window.scrollY); }, { passive: true });

  /* ----- import par copier-coller ----- */
  function renderAdd() {
    document.title = 'Ajouter · Boucles';
    window.scrollTo(0, 0);
    var d = load('draft', { t: '', a: '', txt: '' });
    app.innerHTML =
      '<nav class="bar"><a href="#/" class="back"><svg viewBox="0 0 20 20"><path d="M12.5 4l-6 6 6 6"/></svg>Répertoire</a></nav>' +
      '<header class="song"><h1>Ajouter un morceau</h1><p class="sub">Depuis n’importe quel site d’accords</p></header>' +
      '<section class="form">' +
      '<label><span>Titre</span><input id="ft" autocomplete="off" value="' + esc(d.t) + '"></label>' +
      '<label><span>Artiste</span><input id="fa" autocomplete="off" value="' + esc(d.a) + '"></label>' +
      '<h2>1. Trouver les accords</h2><div id="sites"></div>' +
      '<h2>2. Coller la page</h2>' +
      '<p class="muted small">Sur le site, sélectionnez tout le morceau, copiez, puis collez ici. Les paroles peuvent rester : seuls les accords sont gardés.</p>' +
      '<textarea id="fx" rows="8" placeholder="Collez ici…" autocomplete="off" autocorrect="off" spellcheck="false">' + esc(d.txt) + '</textarea>' +
      '<div id="prev"></div></section>';
    var t = $('#ft'), a = $('#fa'), x = $('#fx');
    function upd() {
      save('draft', { t: t.value, a: a.value, txt: x.value });
      var q = (t.value + ' ' + a.value).trim();
      $('#sites').innerHTML = q ? siteLinks(q) : '<p class="muted small">Indiquez le titre et l’artiste pour chercher sur les sites.</p>';
      var r = x.value.trim() ? window.Convert.convert(x.value) : null;
      var pv = $('#prev');
      if (!x.value.trim()) { pv.innerHTML = ''; return; }
      if (!r) { pv.innerHTML = '<p class="warn">Aucun accord reconnu dans ce texte.</p>'; return; }
      var song = build({ t: t.value || 'Sans titre', a: a.value || 'Inconnu', capo: r.capo, s: r.s }, 'perso');
      var fl = useFlats(shift(song.uniq[0], song.capo));
      pv.innerHTML = '<h2>3. Vérifier</h2>' + (r.capo ? '<p class="small">Capo ' + r.capo + '</p>' : '') +
        song.sections.map(function (sec) {
          return '<div class="sec"><h2>' + esc(sec.n) + '</h2><div class="bars">' + sec.bars.map(function (b) {
            return '<div class="m' + (b.length > 1 ? ' two' : '') + '">' + b.map(function (c) { return '<span>' + esc(name(c, fl)) + '</span>'; }).join('') + '</div>';
          }).join('') + '</div></div>';
        }).join('') +
        '<button class="go-wide" id="save"' + (t.value.trim() && a.value.trim() ? '' : ' disabled') + '>Ajouter au répertoire</button>' +
        (t.value.trim() && a.value.trim() ? '' : '<p class="muted small">Titre et artiste nécessaires pour enregistrer.</p>');
      var b = $('#save');
      if (b) b.onclick = function () {
        var list = load('perso', []).filter(function (o) { return slug(o.a + ' ' + o.t) !== slug(a.value + ' ' + t.value); });
        list.push({ t: t.value.trim(), a: a.value.trim(), capo: r.capo, s: r.s, r: 'ballade' });
        save('perso', list); save('draft', { t: '', a: '', txt: '' });
        rebuild(); location.hash = '#/perso-' + slug(a.value.trim() + ' ' + t.value.trim());
      };
    }
    [t, a, x].forEach(function (el) { el.addEventListener('input', upd); });
    upd();
  }

  /* ----- morceau ----- */
  var cur = null; // { song, st, flat }
  function songState(s) {
    var st = load('m:' + s.id, null) || {};
    return { capo: st.capo != null ? st.capo : s.capo, shift: st.shift || 0, simple: !!st.simple,
      r: st.r || s.r, bpm: st.bpm || 0, guide: st.guide || 'tout', loop: !!st.loop };
  }
  function delta() { return cur.song.capo + cur.st.shift - cur.st.capo; }
  function shape(c) { return shift(cur.st.simple ? simplify(c) : c, delta()); }

  function renderSong(s) {
    cur = { song: s, st: songState(s) };
    document.title = s.t + ' · Boucles';
    window.scrollTo(0, 0);
    app.innerHTML =
      '<nav class="bar"><a href="#/" class="back" aria-label="Retour au répertoire"><svg viewBox="0 0 20 20"><path d="M12.5 4l-6 6 6 6"/></svg>Répertoire</a>' +
      '<button class="fav" id="fav" aria-label="Favori"></button></nav>' +
      '<header class="song"><h1>' + esc(s.t) + '</h1><p class="sub">' + esc(s.a) + '</p></header>' +
      '<section class="ctl" id="ctl"></section>' +
      '<section class="block"><h2>Accords</h2><div class="chords" id="chords"></div></section>' +
      '<section class="block"><h2>Rythmique</h2><div class="rhythm" id="rhythm"></div><div class="seg small" id="rsel"></div>' +
      '<div class="guide"><span>Guide sonore</span><div class="seg small" id="gsel"></div></div></section>' +
      '<section class="block" id="grid"></section>' +
      '<p class="note">' + sourceNote(s) + ' Touchez une mesure pour lancer la lecture à partir d’elle.</p>' +
      (s.kind === 'perso' ? '<button class="tog ghost wide" id="del">Supprimer ce morceau</button>' : '') +
      '<div class="play" id="play"></div>';
    $('#fav').addEventListener('click', function () {
      if (favs[s.id]) delete favs[s.id]; else favs[s.id] = 1;
      save('favs', favs); paintFav();
    });
    paintFav(); paintAll(); paintPlayer();
    if ($('#del')) $('#del').onclick = function () {
      if (!confirm('Supprimer « ' + s.t + ' » de vos morceaux ?')) return;
      save('perso', load('perso', []).filter(function (x) { return 'perso-' + slug(x.a + ' ' + x.t) !== s.id; }));
      rebuild(); location.hash = '#/';
    };
  }
  function sourceNote(s) {
    if (s.kind === 'main') return 'Grille vérifiée, établie d’après les relevés de La Boîte à chansons et ramenée à ses boucles.';
    if (s.kind === 'perso') return 'Morceau importé sur ce téléphone. Les accords ont été repérés automatiquement dans le texte collé.';
    var site = s.src === 'ug' ? 'Ultimate Guitar' : 'La Boîte à chansons';
    return 'Grille générée automatiquement à partir d’un relevé ' + site + (s.u ? ' (<a href="' + esc(s.u) + '" target="_blank" rel="noopener">voir l’original</a>)' : '') +
      '. Les boucles peuvent différer un peu du morceau : fiez-vous à l’oreille.';
  }
  function persist() { save('m:' + cur.song.id, cur.st); }
  function paintFav() {
    var on = !!favs[cur.song.id], b = $('#fav');
    b.setAttribute('aria-pressed', on);
    b.innerHTML = '<svg viewBox="0 0 20 20"><path d="M10 2.6l2.3 4.7 5.1.7-3.7 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1L2.6 8l5.1-.7z"/></svg>';
  }
  function paintAll() { paintCtl(); paintChords(); paintRhythm(); paintGrid(); }

  function paintCtl() {
    var s = cur.song, st = cur.st;
    var best = bestCapo(s, st.shift, st.simple);
    $('#ctl').innerHTML =
      '<div class="stepper"><span class="lab">Capo</span><button data-a="capo-" aria-label="Capo plus bas">−</button><output>' + (st.capo ? st.capo : 'sans') + '</output><button data-a="capo+" aria-label="Capo plus haut">+</button></div>' +
      '<div class="stepper"><span class="lab">Tonalité</span><button data-a="ton-" aria-label="Descendre d’un demi-ton">−</button><output>' + (st.shift > 0 ? '+' : '') + st.shift + '</output><button data-a="ton+" aria-label="Monter d’un demi-ton">+</button></div>' +
      (st.capo ? '<p class="key"><span class="muted">À l’oreille :</span> ' + sounding() + '</p>' : '') +
      '<div class="opts"><button class="tog" data-a="simple" aria-pressed="' + st.simple + '">Accords simples</button>' +
      (best !== st.capo ? '<button class="tog" data-a="easy">Formes faciles : capo ' + best + '</button>' : '') +
      ((st.capo !== s.capo || st.shift || st.simple) ? '<button class="tog ghost" data-a="reset">Réglages d’origine</button>' : '') + '</div>';
    $('#ctl').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'capo+' && st.capo < 9) st.capo++;
      if (a === 'capo-' && st.capo > 0) st.capo--;
      if (a === 'ton+') st.shift = st.shift >= 6 ? -5 : st.shift + 1;
      if (a === 'ton-') st.shift = st.shift <= -5 ? 6 : st.shift - 1;
      if (a === 'simple') st.simple = !st.simple;
      if (a === 'easy') st.capo = best;
      if (a === 'reset') { st.capo = s.capo; st.shift = 0; st.simple = false; }
      persist(); paintCtl(); paintChords(); paintGrid();
    };
  }
  // Les accords tels qu'on les entend (formes + capo), pour jouer avec quelqu'un sans capo.
  function sounding() {
    var fl = useFlats(shift(shape(cur.song.uniq[0]), cur.st.capo)), seen = {}, out = [];
    cur.song.uniq.forEach(function (c) { var n = name(shift(shape(c), cur.st.capo), fl); if (!seen[n]) { seen[n] = 1; out.push(n); } });
    return '<span class="mono">' + esc(out.join(' ')) + '</span>';
  }
  function flats() { return useFlats(shift(shape(cur.song.uniq[0]), cur.st.capo)); }

  function paintChords() {
    var fl = flats(), seen = {}, html = '';
    cur.song.uniq.forEach(function (c) {
      var x = shape(c), n = name(x, fl);
      if (seen[n]) return; seen[n] = 1;
      html += '<button class="chord" data-n="' + esc(n) + '"><b>' + esc(n) + '</b>' + svgChord(x) + '</button>';
    });
    var el = $('#chords'); el.innerHTML = html;
    el.onclick = function (e) {
      var b = e.target.closest('.chord'); if (!b) return;
      audio(); strum(voicing(parse(b.dataset.n)).f, cur.st.capo, ac.currentTime + 0.02, 'B');
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    };
  }

  function paintRhythm() {
    var r = RBY[cur.st.r] || RYTHMES[1];
    var lab = ['1', 'et', '2', 'et', '3', 'et', '4', 'et'];
    $('#rhythm').innerHTML = r.p.split('').map(function (ch, i) {
      var g = ch === 'B' ? '<svg viewBox="0 0 20 28"><path d="M10 3v20M4 17l6 6 6-6"/></svg>'
        : ch === 'H' ? '<svg viewBox="0 0 20 28"><path d="M10 25V5M4 11l6-6 6 6"/></svg>'
        : ch === 'X' ? '<svg viewBox="0 0 20 28"><path d="M5 9l10 10M15 9L5 19"/></svg>' : '';
      return '<div class="step' + (i % 2 ? ' off' : '') + '" data-i="' + i + '"><span class="g">' + g + '</span><span class="c">' + lab[i] + '</span></div>';
    }).join('');
    $('#rsel').innerHTML = RYTHMES.map(function (x) {
      return '<button data-r="' + x.id + '" aria-selected="' + (x.id === r.id) + '">' + x.nom + '</button>';
    }).join('');
    $('#rsel').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      cur.st.r = b.dataset.r; cur.st.bpm = 0; persist(); paintRhythm(); paintPlayer();
    };
    $('#gsel').innerHTML = [['tout', 'Clic et guitare'], ['clic', 'Clic'], ['guitare', 'Guitare']].map(function (x) {
      return '<button data-g="' + x[0] + '" aria-selected="' + (cur.st.guide === x[0]) + '">' + x[1] + '</button>';
    }).join('');
    $('#gsel').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      cur.st.guide = b.dataset.g; persist(); paintRhythm();
    };
  }

  function paintGrid() {
    var fl = flats(), html = '', idx = 0;
    cur.song.sections.forEach(function (sec, si) {
      var reps = repsOf(sec);
      html += '<div class="sec"><h2>' + esc(sec.n) + '<span class="muted"> · ' + sec.bars.length + ' mesure' + (sec.bars.length > 1 ? 's' : '') + ', en boucle</span></h2><div class="bars">';
      sec.bars.forEach(function (b, bi) {
        html += '<button class="m' + (b.length > 1 ? ' two' : '') + '" data-s="' + si + '" data-b="' + bi + '">' +
          b.map(function (c) { return '<span>' + esc(name(shape(c), fl)) + '</span>'; }).join('') + '</button>';
        idx++;
      });
      html += '</div><p class="reps">× ' + reps + ' à la lecture</p></div>';
    });
    var g = $('#grid'); g.innerHTML = html;
    g.onclick = function (e) {
      var m = e.target.closest('.m'); if (!m) return;
      start(+m.dataset.s, +m.dataset.b);
    };
  }
  function repsOf(sec) { return Math.max(2, Math.ceil(8 / sec.bars.length)); }

  /* ----- lecteur ----- */
  var P = null; // état de lecture
  function bpm() { return cur.st.bpm || (RBY[cur.st.r] || RYTHMES[1]).bpm; }
  function paintPlayer() {
    var el = $('#play'); if (!el) return;
    var on = !!P;
    el.className = 'play' + (on ? ' on' : '');
    el.innerHTML =
      '<div class="now" aria-live="polite"><b id="nowc"></b><span id="nextc" class="muted"></span><span class="mini" id="mini">' +
      (RBY[cur.st.r] || RYTHMES[1]).p.split('').map(function (ch) { return '<i>' + ({ B: '↓', H: '↑', X: '×', '-': '·' })[ch] + '</i>'; }).join('') + '</span></div>' +
      '<div class="ctrls"><button class="go" id="go" aria-label="' + (on ? 'Arrêter' : 'Lancer') + '">' +
      (on ? '<svg viewBox="0 0 20 20"><rect x="5" y="5" width="10" height="10" rx="1"/></svg>' : '<svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z"/></svg>') + '</button>' +
      '<div class="stepper tempo"><button data-t="-5" aria-label="Plus lent">−</button><output>' + bpm() + '<small> bpm</small></output><button data-t="5" aria-label="Plus rapide">+</button></div>' +
      '<button class="tog loop" id="loop" aria-pressed="' + cur.st.loop + '">Boucler la partie</button></div>';
    $('#go').onclick = function () { if (P) stop(); else start(0, 0); };
    $('#loop').onclick = function () { cur.st.loop = !cur.st.loop; persist(); this.setAttribute('aria-pressed', cur.st.loop); };
    el.querySelector('.tempo').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      cur.st.bpm = Math.min(160, Math.max(40, bpm() + +b.dataset.t)); persist();
      this.querySelector('output').innerHTML = bpm() + '<small> bpm</small>';
    };
  }

  var wake = null;
  function start(si, bi) {
    stop(true);
    audio();
    var t0 = ac.currentTime + 0.15;
    P = { si: si, bi: bi, rep: 0, step: -8, next: t0, queue: [], timer: 0, raf: 0 };
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {}); } catch (e) {}
    paintPlayer();
    P.timer = setInterval(schedule, 25); schedule();
    P.raf = requestAnimationFrame(draw);
  }
  function stop(silent) {
    if (P) { clearInterval(P.timer); cancelAnimationFrame(P.raf); P = null; }
    ring.forEach(function (g) { try { g.gain.setTargetAtTime(0, ac.currentTime, 0.03); } catch (e) {} });
    ring = [];
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    [].forEach.call(document.querySelectorAll('.m.cur, .step.cur'), function (x) { x.classList.remove('cur'); });
    if (!silent) paintPlayer();
  }
  function advanceBar() {
    var secs = cur.song.sections, sec = secs[P.si];
    P.bi++;
    if (P.bi >= sec.bars.length) {
      P.bi = 0; P.rep++;
      if (!cur.st.loop && P.rep >= repsOf(sec)) { P.rep = 0; P.si = (P.si + 1) % secs.length; }
    }
  }
  function schedule() {
    var r = RBY[cur.st.r] || RYTHMES[1], dt = 60 / bpm() / 2;
    while (P && P.next < ac.currentTime + 0.12) {
      var t = P.next;
      if (P.step < 0) { // décompte : une mesure de clics
        var k = P.step + 8;
        if (k % 2 === 0) click(t, k === 0);
        P.queue.push({ t: t, count: k / 2 + 1, beat: k % 2 === 0 ? k / 2 : -1 });
      } else {
        var bar = cur.song.sections[P.si].bars[P.bi];
        var half = P.step < 4 || bar.length < 2 ? 0 : 1;
        var c = shape(bar[half]), ch = r.p[P.step];
        if (cur.st.guide !== 'guitare' && P.step % 2 === 0) click(t, P.step === 0);
        if (cur.st.guide !== 'clic' && ch !== '-') strum(voicing(c).f, cur.st.capo, t, ch);
        P.queue.push({ t: t, si: P.si, bi: P.bi, rep: P.rep, step: P.step, half: half, beat: P.step % 2 === 0 ? P.step / 2 : -1 });
      }
      P.next += dt;
      P.step++;
      if (P.step === 8) { P.step = 0; advanceBar(); }
    }
  }
  function nextBar(si, bi, rep) {
    var secs = cur.song.sections, sec = secs[si];
    bi++;
    if (bi >= sec.bars.length) { bi = 0; if (!cur.st.loop && rep + 1 >= repsOf(sec)) si = (si + 1) % secs.length; }
    return secs[si].bars[bi];
  }
  function draw() {
    if (!P) return;
    var now = ac.currentTime, ev = null;
    while (P.queue.length && P.queue[0].t <= now) ev = P.queue.shift();
    if (ev) {
      var stepNow = ev.count ? (ev.beat >= 0 ? ev.beat * 2 : -1) : ev.step;
      if (stepNow >= 0) [].forEach.call(document.querySelectorAll('#mini i'), function (b, i) { b.classList.toggle('on', i === stepNow); });
      if (ev.count) {
        if (ev.beat >= 0) { $('#nowc').textContent = ev.count; $('#nextc').textContent = 'décompte'; }
      } else {
        var fl = flats();
        var bar = cur.song.sections[ev.si].bars[ev.bi];
        var m = document.querySelector('.m[data-s="' + ev.si + '"][data-b="' + ev.bi + '"]');
        if (m && !m.classList.contains('cur')) {
          [].forEach.call(document.querySelectorAll('.m.cur'), function (x) { x.classList.remove('cur'); });
          m.classList.add('cur');
          var rc = m.getBoundingClientRect(), bottom = window.innerHeight - $('#play').offsetHeight;
          if (rc.top < 60 || rc.bottom > bottom - 8) window.scrollBy({ top: rc.top - (bottom / 2) + rc.height / 2, behavior: 'smooth' });
        }
        [].forEach.call(document.querySelectorAll('.step'), function (s) { s.classList.toggle('cur', +s.dataset.i === ev.step); });
        $('#nowc').textContent = name(shape(bar[ev.half]), fl);
        var nxt = ev.half === 0 && bar.length > 1 ? bar[1] : nextBar(ev.si, ev.bi, ev.rep)[0];
        $('#nextc').textContent = 'puis ' + name(shape(nxt), fl);
      }
    }
    P.raf = requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && P) stop(); });

  function loadAuto(fresh) {
    return fetch('data-auto.json' + (fresh ? '?t=' + Date.now() : ''), { cache: fresh ? 'no-store' : 'default' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        window.SONGS_AUTO = j.songs || [];
        save('autoMeta', { updated: j.updated, count: (j.songs || []).length });
        rebuild();
      });
  }

  window.addEventListener('hashchange', route);
  route();
  loadAuto(false).then(function () {
    var h = location.hash.replace(/^#\/?/, '');
    if (!h) { paintCount(); fillList(); } else if (!cur || cur.song.id !== h) route();
  }, function () {});

  if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
