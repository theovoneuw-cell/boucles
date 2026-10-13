#!/usr/bin/env node
/* Convertit build/nouveaux.json (accords seuls) en grilles et les ajoute à data-auto.json.
   Les morceaux inexploitables vont dans build/rejets.json pour ne pas être retéléchargés.
   Usage : node build/merge.js [--initial]   (--initial : pas de date, donc pas « nouveau ») */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { convert } = require(path.join(ROOT, 'convert.js'));
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return d; } };
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

global.window = {}; require(path.join(ROOT, 'data.js'));
const main = new Set(window.SONGS.map((s) => slug(s.a + ' ' + s.t)));
const auto = read('data-auto.json', { songs: [] });
const rejets = new Set(read('build/rejets.json', []));
const have = new Set(auto.songs.map((s) => slug(s.a + ' ' + s.t)));
const nouveaux = read('build/nouveaux.json', []);
const today = new Date().toISOString().slice(0, 10);
const initial = process.argv.includes('--initial');

// Titres propres : « Meuda (ft. X) » garde ses crédits, mais plus de « (Chords) », « ver 2 »…
const cleanTitle = (t) => t.replace(/\s*\((chords|acoustic|official|ver\.?\s*\d+)\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();

let added = 0, rejected = 0;
for (const n of nouveaux) {
  const t = cleanTitle(n.t || ''), a = (n.a || '').trim(), id = slug(a + ' ' + t);
  if (!t || !a || main.has(id) || have.has(id)) { rejets.add(n.u); continue; }
  const r = convert(n.text || '');
  const ok = r && r.maxLoop <= 8 && new Set(r.s.split(/[|:\/\s]+/).filter((x) => /^[A-G]/.test(x))).size >= 2;
  if (!ok) { rejets.add(n.u); rejected++; continue; }
  const capo = Number(n.capo) || r.capo || 0;
  auto.songs.push({ t, a, capo: capo > 9 ? 0 : capo, s: r.s, src: n.src, u: n.u, d: initial ? '' : today });
  have.add(id); added++;
}
auto.songs.sort((x, y) => (y.d || '').localeCompare(x.d || '') || x.a.localeCompare(y.a, 'fr') || x.t.localeCompare(y.t, 'fr'));
auto.updated = new Date().toISOString();
auto.count = auto.songs.length;
fs.writeFileSync(path.join(ROOT, 'data-auto.json'), JSON.stringify(auto).replace(/\},\{/g, '},\n{'));
fs.writeFileSync(path.join(ROOT, 'build/rejets.json'), JSON.stringify([...rejets].sort(), null, 0));
try { fs.unlinkSync(path.join(ROOT, 'build/nouveaux.json')); } catch (e) {}
console.log(`ajoutés ${added}, écartés ${rejected}, catalogue auto ${auto.songs.length}`);
