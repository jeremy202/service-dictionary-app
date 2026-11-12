from render import render
import base64
fr=base64.b64encode(open('fraunces-latin-wght-normal.woff2','rb').read()).decode()
it=base64.b64encode(open('inter-latin-wght-normal.woff2','rb').read()).decode()
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
    <div style="filter:drop-shadow(0 30px 60px rgba(20,40,30,.25))">{sv("badge",380)}</div>
    <div style="font-family:F;font-weight:600;font-size:112px;letter-spacing:-1.5px;color:{ink};margin-top:70px;font-variation-settings:'opsz' 144">Service Dictionary</div>
    <div style="font-family:I;font-weight:600;font-size:32px;letter-spacing:10px;color:{sub};margin-top:34px;text-transform:uppercase">Terms · Abbreviations · Prowords</div>
    </body>'''
    render(html,out,2732,2732)
splash('#f5f2ea','#1b211e','#b48a3a','splash.png')
splash('#121513','#ece9e0','#d4ad5c','splash-dark.png')
print('ok')
