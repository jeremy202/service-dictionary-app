from render import render
import base64
fr=base64.b64encode(open('fraunces-latin-wght-normal.woff2','rb').read()).decode()
it=base64.b64encode(open('inter-latin-wght-normal.woff2','rb').read()).decode()
def sv(name,size): return open(name+'.svg').read().replace('width="1024" height="1024"',f'width="{size}" height="{size}"',1)
def img(path): return 'data:image/png;base64,'+base64.b64encode(open(path,'rb').read()).decode()
sw=[('Field Green','#2E5C45'),('Deep Green','#16332A'),('Brass','#D4AD5C'),('Parchment','#F5F2EA'),('Ink','#1B211E')]
chips=''.join(f'<div><div style="height:88px;border-radius:16px;background:{c};box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)"></div><div style="margin-top:10px;font-weight:600;font-size:15px">{n}</div><div style="font-size:13px;color:#69716b;font-family:monospace">{c}</div></div>' for n,c in sw)
phone='width:300px;height:600px;object-fit:cover;border-radius:36px;box-shadow:0 0 0 8px #1b211e,0 30px 60px rgba(0,0,0,.25)'
html=f'''<style>@font-face{{font-family:F;src:url(data:font/woff2;base64,{fr})}}@font-face{{font-family:I;src:url(data:font/woff2;base64,{it})}}
body{{margin:0;background:#f5f2ea;font-family:I;color:#1b211e}} .lbl{{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#b48a3a;font-weight:600;margin-bottom:18px}}</style>
<body><div style="padding:64px 72px;width:1456px">
 <div class="lbl">Brand identity</div>
 <div style="display:flex;align-items:center;gap:28px">
   <div style="filter:drop-shadow(0 14px 28px rgba(22,51,42,.3))">{sv("badge",120)}</div>
   <div><div style="font-family:F;font-weight:600;font-size:76px;letter-spacing:-1.5px;line-height:1">Service Dictionary</div>
   <div style="margin-top:12px;font-size:16px;letter-spacing:6px;text-transform:uppercase;color:#b48a3a;font-weight:600">Terms · Abbreviations · Prowords</div></div>
 </div>
 <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:56px;margin-top:64px">
   <div>
     <div class="lbl">The mark</div>
     <p style="margin:0 0 26px;font-size:17px;line-height:1.6;color:#3b423e;max-width:560px">An open book beneath a double rank chevron: the knowledge of the service, ranked and ready. Brass on field green, with parchment pages.</p>
     <div style="display:flex;gap:26px;align-items:flex-end">
       <div style="filter:drop-shadow(0 18px 36px rgba(22,51,42,.3))">{sv("badge",200)}</div>
       <div style="filter:drop-shadow(0 10px 20px rgba(22,51,42,.3))">{sv("badge",96)}</div>
       <div>{sv("badge",48)}</div>
       <div style="background:#1b211e;border-radius:28px;padding:22px"><div style="filter:drop-shadow(0 10px 20px rgba(0,0,0,.4))">{sv("badge",96)}</div></div>
     </div>
     <div class="lbl" style="margin-top:52px">Colour</div>
     <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px">{chips}</div>
     <div class="lbl" style="margin-top:52px">Type</div>
     <div style="display:flex;gap:48px;align-items:baseline">
       <div><div style="font-family:F;font-weight:600;font-size:54px">Aa</div><div style="font-size:14px;color:#69716b">Fraunces: titles and headwords</div></div>
       <div><div style="font-family:I;font-weight:600;font-size:54px">Aa</div><div style="font-size:14px;color:#69716b">Inter: meanings and interface</div></div>
     </div>
   </div>
   <div>
     <div class="lbl">Splash screens</div>
     <div style="display:flex;gap:22px"><img src="{img('splash.png')}" style="{phone}"><img src="{img('splash-dark.png')}" style="{phone}"></div>
   </div>
 </div>
</div></body>'''
render(html,'brand-board.png',1600,1180)
