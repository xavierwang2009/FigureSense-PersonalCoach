from pathlib import Path
import re,json,base64,zipfile
root=Path.cwd();s=(root/'FigureSense-Hero.html').read_text()
def data(path,mime):return 'data:'+mime+';base64,'+base64.b64encode((root/path).read_bytes()).decode()
s=s.replace('<html lang="en">','<html lang="en" data-start-demo="true">')
s=re.sub(r'<link[^>]*href="hero-assets/hero.css(?:\?v=[0-9a-f]+)?"[^>]*>',lambda _: '<style>'+Path('hero-assets/hero.css').read_text()+'</style>',s)
for js in ['hero-assets/hero.js','hero-assets/fx.js']:s=re.sub(r'<script[^>]*src="'+re.escape(js)+r'(?:\?v=[0-9a-f]+)?"[^>]*></script>',lambda _: '<script defer src="'+data(js,'text/javascript')+'"></script>',s)
s=re.sub(r'<link[^>]*href="https://fonts\.[^"]+"[^>]*>','',s)
s=re.sub(r"@import url\('https://fonts.googleapis.com/[^']+'\);",'',s)
for path,mime in [('figuresense-icon.png','image/png'),('hero-assets/xavier.png','image/png'),('hero-assets/xavier-avatar.jpg','image/jpeg'),('hero-assets/ballet-leg-human.png','image/png'),('demo-assets/xavier-ballet-leg-demo.mp4','video/mp4')]:s=s.replace(path,data(path,mime))
s=re.sub(r'<a class="download-demo"[^>]*>.*?</a>','<span>Portable demo · video included</span>',s)
assert 'hero-assets/' not in s, 'Missing embedded asset'
assert 'demo-assets/' not in s
out=root/'downloads/FigureSense-Demo.html';out.write_text(s)
readme='''FigureSense Demo\n\nUnzip this folder, then double-click FigureSense-Demo.html in a current desktop browser.\nIt opens straight into the review of Xavier’s Ballet Leg, with his video included and\nthe five checkpoints already found. No server or installation is needed.\n\nReview: pick a checkpoint, nudge its frame, drag the measuring dots, then Save.\nResults change only after you save. Open Results (tab 4) for the score, the measured\ncomparison with the figure's requirements, and what to work on, with a video of each drill.\nMove between steps with the tabs at the top; the FigureSense logo opens the home page.\n\nPose detection on other clips and the drill videos need an internet connection. If a\ndrill video does not play inside the page, use Open on YouTube on the drill card.\nVideo processing stays in your browser, and edits last for the current browser session.\nAngles are 2D estimates for practice, not official judging scores.\n'''
with zipfile.ZipFile(root/'downloads/FigureSense-Demo.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(out,'FigureSense-Demo/FigureSense-Demo.html')
 z.writestr('FigureSense-Demo/READ-ME.txt',readme)
with zipfile.ZipFile(root/'downloads/FigureSense-Demo.zip') as z:assert z.testzip() is None
print('Self-contained HTML:',out.stat().st_size,'bytes; ZIP:',(root/'downloads/FigureSense-Demo.zip').stat().st_size,'bytes')
