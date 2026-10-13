#!/usr/bin/env python3
"""Télécharge des polices Google et les intègre en base64 dans fonts.css.
Regroupe les @font-face qui pointent vers le même fichier (polices variables),
sinon le même base64 est dupliqué plusieurs fois."""
import re, io, os, sys, base64, subprocess, collections

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

url = sys.argv[1]
subprocess.run(['curl', '-sS', '-A', UA, url, '-o', '_gf.css'], check=True)
css = io.open('_gf.css', encoding='utf-8').read()

blocs = [b for (n, b) in re.findall(r'/\*\s*([\w\-\[\]]+)\s*\*/\s*(@font-face\s*\{.*?\})', css, re.S)
         if n == 'latin']
faces = []
for b in blocs:
    faces.append(dict(
        fam=re.search(r"font-family:\s*'([^']+)'", b).group(1),
        sty=re.search(r"font-style:\s*(\w+)", b).group(1),
        wgt=re.search(r"font-weight:\s*([\d\s]+);", b).group(1).strip(),
        url=re.search(r'url\((https://[^)]+\.woff2)\)', b).group(1),
        rng=(re.search(r'unicode-range:\s*([^;]+);', b) or [None, None])[1]
             if re.search(r'unicode-range:\s*([^;]+);', b) else None))

os.makedirs('fonts-woff2', exist_ok=True)
for f in os.listdir('fonts-woff2'):
    os.remove(os.path.join('fonts-woff2', f))
fichiers = {}
for i, u in enumerate(sorted({f['url'] for f in faces})):
    p = 'fonts-woff2/%d.woff2' % i
    subprocess.run(['curl', '-sS', '--retry', '3', u, '-o', p], check=True)
    fichiers[u] = p

groupes = collections.OrderedDict()
for f in faces:
    groupes.setdefault((f['fam'], f['sty'], f['url']), []).append(f)

out = []
for (fam, sty, u), fs in groupes.items():
    ws = sorted({int(w) for f in fs for w in f['wgt'].split()})
    wgt = str(ws[0]) if len(ws) == 1 else "%d %d" % (ws[0], ws[-1])
    b64 = base64.b64encode(open(fichiers[u], 'rb').read()).decode()
    rng = fs[0]['rng']
    out.append("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
               "src:url(data:font/woff2;base64,%s) format('woff2');%s}"
               % (fam, sty, wgt, b64, ("unicode-range:%s;" % rng) if rng else ""))

io.open('fonts.css', 'w', encoding='utf-8').write("".join(out))
os.remove('_gf.css')
brut = sum(os.path.getsize(v) for v in set(fichiers.values()))
print("familles  :", ", ".join(sorted({f['fam'] for f in faces})))
print("faces     : %d déclarations → %d après regroupement" % (len(faces), len(out)))
print("woff2     : %d Ko" % (brut // 1024))
print("fonts.css : %d Ko" % (os.path.getsize('fonts.css') // 1024))
