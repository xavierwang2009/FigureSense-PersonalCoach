"""Bundle src/*.js into index.html and FigureSense-Hero.html.

The page loads its modules from an inline `sources` object; edit the files in
src/ and run this script instead of editing that line by hand.
`python3 scripts/build.py --check` exits non-zero if the pages are out of date.
"""
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parent.parent
# Dependencies first: the page's loader only rewrites imports of modules listed earlier.
MODULES=['figures.js','geometry.js','poses.js','autoscan.js','ballet-assist.js','app.js']
PAGES=['index.html','FigureSense-Hero.html']
sources={name:(root/'src'/name).read_text(encoding='utf-8') for name in MODULES}
line='const sources = '+json.dumps(sources,ensure_ascii=False)+';'
page=(root/PAGES[0]).read_text(encoding='utf-8')
pattern=re.compile(r'^const sources = \{.*\};$',re.M)
assert len(pattern.findall(page))==1,'Expected exactly one sources line in index.html'
built=pattern.sub(lambda _:line,page)
# Stamp the page's own CSS/JS with a content hash so browsers never mix a new page with old files.
import hashlib
for asset in ['hero-assets/hero.css','hero-assets/hero.js','hero-assets/fx.js']:
    digest=hashlib.sha256((root/asset).read_bytes()).hexdigest()[:10]
    built=re.sub(re.escape(asset)+r'(\?v=[0-9a-f]+)?"',lambda _:f'{asset}?v={digest}"',built)
stale=[p for p in PAGES if (root/p).read_text(encoding='utf-8')!=built]
if '--check' in sys.argv:
    if stale:sys.exit('Out of date: '+', '.join(stale)+'. Run python3 scripts/build.py')
    print('Pages match src/.')
else:
    for p in stale:(root/p).write_text(built,encoding='utf-8')
    print('Updated: '+(', '.join(stale) or 'nothing (already current)'))
