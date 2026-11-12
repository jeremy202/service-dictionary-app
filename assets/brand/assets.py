from render import render
import base64
fr=base64.b64encode(open('bc700.woff2','rb').read()).decode()
it=base64.b64encode(open('plex500.woff2','rb').read()).decode()
FONTS=f"""<style>@font-face{{font-family:F;src:url(data:font/woff2;base64,{fr}) format('woff2');font-weight:100 900}}
@font-face{{font-family:I;src:url(data:font/woff2;base64,{it}) format('woff2');font-weight:100 900}}
html,body{{margin:0;padding:0}}</style>"""
def sv(name,size): return open(name+'.svg').read().replace('width="1024" height="1024"',f'width="{size}" height="{size}"',1)

# icons
render(FONTS+f'<body>{sv("icon",1024)}</body>','icon-only.png',1024,1024)
render(FONTS+f'<body>{sv("fg",1024)}</body>','icon-foreground.png',1024,1024,transparent=True)
render(FONTS+f'<body>{sv("bg",1024)}</body>','icon-background.png',1024,1024)

def splash(bg, ink, sub, out):
    html=FONTS+f'''<body style="width:2732px;height:2732px;background:{bg};display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div>{sv("badge",360)}</div>
    <div style="font-family:F;font-weight:700;font-size:128px;letter-spacing:8px;color:{ink};margin-top:70px;text-transform:uppercase">Service Dictionary</div>
    <div style="font-family:I;font-weight:500;font-size:30px;letter-spacing:9px;color:{sub};margin-top:26px;text-transform:uppercase">Terms · Abbreviations · Prowords</div>
    </body>'''
    render(html,out,2732,2732)
splash('#f5f2ea','#1d2016','#8a6a3a','splash.png')
splash('#14160f','#e6e3d4','#c6a46c','splash-dark.png')
print('ok')
