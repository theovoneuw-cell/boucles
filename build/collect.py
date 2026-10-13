#!/usr/bin/env python3
"""Robot de collecte : cherche les grilles d'accords de rap français sur Ultimate Guitar
et La Boîte à chansons, et écrit build/nouveaux.json pour build/merge.js.

Ne garde que les accords et les titres de parties : aucune parole ne sort de ce script.
Usage : python3 build/collect.py [--max N] [--sans-ug] [--sans-bac] [--tous]  (depuis la racine du dépôt)

Ultimate Guitar limite vite le nombre de requêtes : à chaque passage, le robot ne vérifie
qu'un groupe de 30 artistes (à tour de rôle, --tous pour tout le monde) et télécharge au plus
--max grilles. Les morceaux repérés mais pas encore téléchargés attendent dans build/file.json.
"""
import datetime, html, json, os, re, subprocess, sys, time, unicodedata, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Safari/605.1.15")
MAX = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 400
PAUSE = 2.0
PAUSE_BAC = 0.5  # La Boîte à chansons tolère un rythme plus soutenu
UG = '--sans-ug' not in sys.argv
BAC = '--sans-bac' not in sys.argv


BLOCKED = set()   # sites qui ont répondu 429 pendant ce passage : on n'insiste pas


def curl(url, data=None):
    """Page en texte. Au premier « trop de requêtes » (429), le site est laissé de côté jusqu'au prochain passage."""
    host = url.split('/')[2]
    site = 'ug' if 'ultimate-guitar' in host else host
    if site in BLOCKED:
        return ''
    cmd = ['curl', '-sL', '--max-time', '25', '-A', UA, '-w', '\n%{http_code}', url]
    if data:
        cmd[1:1] = ['-X', 'POST', '--data-urlencode', data]
    for _ in range(3):
        r = subprocess.run(cmd, capture_output=True)
        body, _, code = r.stdout.decode('utf-8', 'replace').rpartition('\n')
        if code == '200' and body:
            return body
        if code == '429':
            print('429 sur', site, ': pause jusqu\'au prochain passage', flush=True)
            BLOCKED.add(site)
            return ''
        time.sleep(5)
    return ''


def norm(s):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode())


ARTISTS = [l.strip() for l in open(os.path.join(ROOT, 'build/artistes.txt'), encoding='utf-8') if l.strip()]
KNOWN = {norm(a) for a in ARTISTS}


def ours(artist_name):
    """Vrai si l'un des artistes crédités est dans la liste (comparaison exacte, pas « Jul » dans « Julia »)."""
    parts = re.split(r'\s*(?:&|,|\bfeat\.?|\bft\.?|\bx\b|\bet\b|\band\b|/)\s*', artist_name, flags=re.I)
    return norm(artist_name) in KNOWN or any(norm(p) in KNOWN for p in parts if p)


def ug_store(url):
    s = curl(url)
    m = re.search(r'class="js-store" data-content="([^"]*)"', s)
    return json.loads(html.unescape(m.group(1))) if m else None


HEAD = re.compile(r'^\s*\[(intro|verse|chorus|bridge|pre-chorus|outro|hook|refrain|couplet|pont|interlude|break|instrumental)[^\]]*\]\s*$', re.I)


def ug_chords_only(content):
    """Contenu Ultimate Guitar → une ligne d'accords par ligne de la page ; paroles écartées."""
    out = []
    for line in content.replace('\r', '').replace('[tab]', '').replace('[/tab]', '').split('\n'):
        ch = re.findall(r'\[ch\]([^\[]+)\[/ch\]', line)
        if ch:
            out.append(' '.join(c.strip() for c in ch))
        elif HEAD.match(line):
            out.append(line.strip())
        elif not line.strip():
            out.append('')
    return '\n'.join(out)


def bac_chords_only(page):
    i = page.find('id="divPartition"')
    blocks = re.split(r'<div class="(pL\w*|c1)"[^>]*>', page[i:i + 150000])
    out = []
    for k in range(1, len(blocks), 2):
        cls, body = blocks[k], blocks[k + 1]
        ch = re.findall(r'data-a="([^"]+)"', body)
        txt = html.unescape(re.sub(r'<[^>]+>', '', body)).strip()
        m = re.match(r'[\[(]?\s*(intro|refrain|couplet|pont|outro|bridge|chorus|verse|pr[ée]-?refrain|instru\w*|break)\b', txt, re.I)
        if m:
            out.append('[' + m.group(1) + ']')
        if ch:
            out.append(' '.join(ch))
        elif cls == 'pLVV':
            out.append('')
    return '\n'.join(out)


def main():
    auto = json.load(open(os.path.join(ROOT, 'data-auto.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'data-auto.json')) else {'songs': []}
    rej_path = os.path.join(ROOT, 'build/rejets.json')
    rejets = set(json.load(open(rej_path))) if os.path.exists(rej_path) else set()
    seen = {s['u'] for s in auto['songs'] if s.get('u')} | rejets
    file_path = os.path.join(ROOT, 'build/file.json')
    queue = json.load(open(file_path, encoding='utf-8')) if os.path.exists(file_path) else []
    todo = {}
    for q in queue:
        todo.setdefault(norm(q['a']) + '|' + norm(q['t'] or q['u']), dict(q, sc=q.get('sc', 0)))

    # 1. Ultimate Guitar : derniers ajouts (les sorties récentes arrivent là en premier)
    for page in range(1, 9 if UG else 1):
        d = ug_store(f'https://www.ultimate-guitar.com/explore?order=date_desc&type[]=Chords&page={page}')
        if not d:
            break
        for r in d['store']['page']['data'].get('data', {}).get('tabs', []) or []:
            url = f"https://tabs.ultimate-guitar.com/tab/{r['id']}"
            if r.get('type') == 'Chords' and ours(r.get('artist_name', '')):
                todo.setdefault(norm(r['artist_name']) + '|' + norm(r['song_name']),
                                {'src': 'ug', 'a': r['artist_name'], 't': r['song_name'], 'u': url, 'sc': (r.get('votes') or 0) * (r.get('rating') or 0)})
        time.sleep(PAUSE)
    print('nouveautés UG :', len(todo), flush=True)

    # 2. Ultimate Guitar : recherche artiste par artiste (meilleure version de chaque titre)
    now = datetime.datetime.utcnow()
    turn = now.timetuple().tm_yday * 4 + now.hour // 6
    k0 = (turn * 30) % len(ARTISTS)
    group = ARTISTS if '--tous' in sys.argv else (ARTISTS + ARTISTS)[k0:k0 + 30]
    for a in (group if UG else []):
        d = ug_store('https://www.ultimate-guitar.com/search.php?search_type=title&value=' + urllib.parse.quote(a))
        for r in (d['store']['page']['data'].get('results', []) or []) if d else []:
            if r.get('type') != 'Chords' or not ours(r.get('artist_name', '')):
                continue
            k = norm(r['artist_name']) + '|' + norm(r['song_name'])
            sc = (r.get('votes') or 0) * (r.get('rating') or 0)
            if k not in todo or sc > todo[k]['sc']:
                todo[k] = {'src': 'ug', 'a': r['artist_name'], 't': r['song_name'], 'u': f"https://tabs.ultimate-guitar.com/tab/{r['id']}", 'sc': sc}
        time.sleep(PAUSE)
    print('après recherche UG :', len(todo), flush=True)

    # 3. La Boîte à chansons : fiches artistes
    for a in (ARTISTS if BAC else []):
        raw = curl('https://www.boiteachansons.net/recherche/xhrGetResultats', 'recherche=' + a).strip()
        try:
            res = json.loads(raw or '[]')
        except ValueError:
            res = []
        for o in res:
            if o.get('typeResult') != 'a' or not ours(o.get('titre', '')):
                continue
            page = curl('https://www.boiteachansons.net/artistes/' + o['fichierAuteur'])
            for slug in sorted(set(re.findall(r'/partitions/' + re.escape(o['fichierAuteur']) + r'/([a-z0-9-]+)', page))):
                k = norm(o['titre']) + '|' + norm(slug)
                todo.setdefault(k, {'src': 'bac', 'a': o['titre'], 't': None, 'u': f"https://www.boiteachansons.net/partitions/{o['fichierAuteur']}/{slug}", 'sc': 0})
            time.sleep(PAUSE_BAC)
        time.sleep(PAUSE_BAC)
    print('après Boîte à chansons :', len(todo), flush=True)

    # 4. Téléchargement des grilles encore inconnues ; le reste attend le prochain passage
    out, left = [], []
    for k, v in todo.items():
        if v['u'] in seen:
            continue
        if len(out) >= MAX:
            left.append({x: v[x] for x in ('src', 'a', 't', 'u', 'sc')})
            continue
        if v['src'] == 'ug':
            d = ug_store(v['u'])
            tv = (d or {}).get('store', {}).get('page', {}).get('data', {}).get('tab_view', {}) if d else {}
            if not tv:
                left.append({x: v[x] for x in ('src', 'a', 't', 'u', 'sc')})
                continue
            text = ug_chords_only((tv.get('wiki_tab') or {}).get('content', ''))
            capo = (tv.get('meta') or {}).get('capo') or 0
            t = v['t']
        else:
            page = curl(v['u'])
            text = bac_chords_only(page)
            m = re.search(r'name="capo" value="(\d*)"', page)
            capo = int(m.group(1)) if m and m.group(1) else 0
            tm = re.search(r'<title[^>]*>([^<]*)', page)
            t = html.unescape(tm.group(1)).split(' - ')[0].strip() if tm else v['u'].rsplit('/', 1)[-1]
        out.append({'t': t, 'a': v['a'], 'src': v['src'], 'u': v['u'], 'capo': capo, 'text': text})
        time.sleep(PAUSE if v['src'] == 'ug' else PAUSE_BAC)
    json.dump(out, open(os.path.join(ROOT, 'build/nouveaux.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(left, open(file_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('à convertir :', len(out), '· en attente :', len(left), flush=True)


if __name__ == '__main__':
    main()
