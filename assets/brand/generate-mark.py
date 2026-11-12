# Generates the Service Dictionary logo mark in a few lockups.
GREEN_TOP = '#2e5c45'; GREEN_BOT = '#2e5c45'; BRASS = '#d9d0b8'; BRASS_DEEP = '#d9d0b8'; CREAM = '#f5f2ea'

def emblem(cx=512, cy=540, s=1.0):
    """Open book with a rank chevron above it. Drawn on a 1024 grid centred at (cx, cy)."""
    def P(x, y):  # scale around the centre
        return f'{cx + (x-512)*s:.1f} {cy + (y-540)*s:.1f}'
    def B(x, y):  # book is nudged down to make room for the double chevron
        return P(x, y + 30)
    sw = 38*s
    book = f'''
    <path d="M{B(512,470)} C{B(452,420)} {B(352,402)} {B(262,418)} L{B(262,688)} C{B(352,672)} {B(452,690)} {B(512,740)} Z" fill="{CREAM}"/>
    <path d="M{B(512,470)} C{B(572,420)} {B(672,402)} {B(762,418)} L{B(762,688)} C{B(672,672)} {B(572,690)} {B(512,740)} Z" fill="{CREAM}" opacity=".88"/>
    <path d="M{B(512,478)} L{B(512,728)}" stroke="{GREEN_BOT}" stroke-opacity=".35" stroke-width="{6*s:.1f}" stroke-linecap="round"/>
    <path d="M{B(318,500)} C{B(380,490)} {B(436,500)} {B(476,526)} M{B(318,560)} C{B(380,550)} {B(436,560)} {B(476,586)} M{B(318,620)} C{B(380,610)} {B(436,620)} {B(476,646)}" stroke="{GREEN_BOT}" stroke-opacity=".18" stroke-width="{10*s:.1f}" fill="none" stroke-linecap="round"/>
    <path d="M{B(548,526)} C{B(588,500)} {B(644,490)} {B(706,500)} M{B(548,586)} C{B(588,560)} {B(644,550)} {B(706,560)} M{B(548,646)} C{B(588,620)} {B(644,610)} {B(706,620)}" stroke="{GREEN_BOT}" stroke-opacity=".14" stroke-width="{10*s:.1f}" fill="none" stroke-linecap="round"/>
    <path d="M{P(400,326)} L{P(512,260)} L{P(624,326)}" stroke="url(#brass)" stroke-width="{sw:.1f}" fill="none" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10"/>
    <path d="M{P(400,384)} L{P(512,318)} L{P(624,384)}" stroke="url(#brass)" stroke-width="{sw:.1f}" fill="none" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10"/>
    '''
    return book

DEFS = f'''<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GREEN_TOP}"/><stop offset="1" stop-color="{GREEN_BOT}"/></linearGradient>
  <radialGradient id="glow" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".10"/><stop offset=".6" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9d0b8"/><stop offset="1" stop-color="{BRASS_DEEP}"/></linearGradient>
</defs>'''

def svg(body, w=1024, h=1024):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{body}</svg>'

# 1. Full icon (square, store/iOS masks the corners itself)
icon = svg(f'<rect width="1024" height="1024" fill="url(#bg)"/>{emblem(512, 548, 1.04)}')
# 2. Android adaptive foreground: emblem inside the 66% safe zone
fg = svg(emblem(512, 538, 0.70))
# 3. Android adaptive background
bgl = svg('<rect width="1024" height="1024" fill="url(#bg)"/>')
# 4. Rounded badge for in-app header / favicon
badge = svg(f'<rect width="1024" height="1024" rx="200" fill="url(#bg)"/>{emblem(512, 548, 1.04)}')
for name, s in [('icon', icon), ('fg', fg), ('bg', bgl), ('badge', badge)]:
    open(f'{name}.svg', 'w').write(s)
print('ok')
