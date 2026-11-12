import sys
from playwright.sync_api import sync_playwright
def render(html, out, w, h, transparent=False):
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':w,'height':h})
        pg.set_content(html); pg.wait_for_timeout(400)
        pg.screenshot(path=out, omit_background=transparent); b.close()
if __name__=='__main__':
    icon=open('badge.svg').read()
    html=f'''<body style="margin:0;background:#efece4;display:flex;gap:40px;align-items:center;padding:30px">
    <div style="width:360px">{icon.replace('width="1024" height="1024"','width="360" height="360"',1)}</div>
    <div style="width:120px">{icon.replace('width="1024" height="1024"','width="120" height="120"',1)}</div>
    <div style="width:60px">{icon.replace('width="1024" height="1024"','width="60" height="60"',1)}</div>
    <div style="width:32px">{icon.replace('width="1024" height="1024"','width="32" height="32"',1)}</div></body>'''
    render(html,'sizes.png',700,420)
