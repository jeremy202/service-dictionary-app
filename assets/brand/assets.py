from render import render
import base64
fr=base64.b64encode(open('ss600.woff2','rb').read()).decode()
it=base64.b64encode(open('sans500.woff2','rb').read()).decode()
FONTS=f"""<style>@font-face{{font-family:F;src:url(data:font/woff2;base64,{fr}) format('woff2')}}
@font-face{{font-family:I;src:url(data:font/woff2;base64,{it}) format('woff2')}}
html,body{{margin:0;padding:0}}</style>"""
def sv(name,size): return open(name+'.svg').read().replace('width="1024" height="1024"',f'width="{size}" height="{size}"',1)
render(FONTS+f'<body>{sv("icon",1024)}</body>','icon-only.png',1024,1024)
render(FONTS+f'<body>{sv("fg",1024)}</body>','icon-foreground.png',1024,1024,transparent=True)
render(FONTS+f'<body>{sv("bg",1024)}</body>','icon-background.png',1024,1024)
def splash(bg, ink, sub, badge, out):
    b=open('badge.svg').read().replace('width="1024" height="1024"','width="300" height="300"',1)
    if badge: b=b.replace('fill="#1b1b1b"','fill="'+badge[0]+'"').replace('fill="#f5f2ea"','fill="'+badge[1]+'"')
    html=FONTS+f'''<body style="width:2732px;height:2732px;background:{bg};display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div>{b}</div>
    <div style="font-family:F;font-weight:600;font-size:104px;color:{ink};margin-top:64px">Service Dictionary</div>
    <div style="font-family:I;font-weight:500;font-size:34px;letter-spacing:2px;color:{sub};margin-top:22px">Terms · Abbreviations · Prowords</div>
    </body>'''
    render(html,out,2732,2732)
splash('#f5f2ea','#1b1b1b','#6a6a66',None,'splash.png')
splash('#161616','#ebebe8','#9a9a95',None,'splash-dark.png')
print('ok')
