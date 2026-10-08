# Generates the pixel-art UI assets in src/retro/ (run from the project root: python tools/make_retro_assets.py)
from PIL import Image
import math, os, random
os.makedirs('src/retro', exist_ok=True)
def C(h, a=255): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (a,)

def nine(name, S, c, fill, outline, hi, lo):
    """9-slice frame: corner chamfer c px, bevel highlight/shadow, 1px outline. Slice = S px."""
    W = S * 3; im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); px = im.load()
    F, O, H, L = map(C, (fill, outline, hi, lo))
    for y in range(W):
        for x in range(W):
            dx, dy = min(x, W-1-x), min(y, W-1-y)
            if dx + dy < c - 1: continue
            if dx == 0 or dy == 0 or dx + dy == c - 1: px[x, y] = O
            elif (y == 1 and 1 <= x <= W-3) or (x == 1 and 1 <= y <= W-3): px[x, y] = H
            elif (y == W-2 and 2 <= x <= W-2) or (x == W-2 and 2 <= y <= W-2): px[x, y] = L
            else: px[x, y] = F
    im.save(f'src/retro/{name}.png')

INK = '#2b1606'
nine('panel-orange', 4, 3, '#efb35c', INK, '#f9d896', '#c07f2e')
nine('panel-dark',   4, 3, '#3a210a', '#1a0d02', '#5c3a14', '#26140a')
nine('s-dark',   2, 2, '#3a210a', '#1a0d02', '#5c3a14', '#26140a')
nine('s-cream',  2, 2, '#fbeccb', INK, '#fff8e4', '#e2c58a')
nine('s-field',  2, 2, '#fbeccb', INK, '#c9a56a', '#fff8e4')
nine('s-btn',    2, 2, '#c9893a', INK, '#e6b066', '#8f5a1c')
nine('s-btnlight', 2, 2, '#f6d9a0', INK, '#fff3d0', '#d4a95e')
nine('s-btndark',  2, 2, '#4a290a', INK, '#6e4214', '#2f1a06')

# bamboo basket-weave tile (16x16, shown at 3x)
random.seed(4); t = Image.new('RGBA', (16, 16)); p = t.load()
rows = [C('#f0c27a'), C('#d9954a'), C('#c98a3a'), C('#4a2a0a')]
for ox, oy, horiz in ((0,0,1), (8,0,0), (0,8,0), (8,8,1)):
    for a in range(8):
        for b in range(8):
            i = (b % 4) if horiz else (a % 4)          # position across the slat
            end = (a == 7) if horiz else (b == 7)        # slat end gap
            col = C('#4a2a0a') if end else rows[i]
            if not end and i in (1, 2) and random.random() < .12: col = C('#b9732a')
            p[ox+a, oy+b] = col
t.save('src/retro/bamboo.png')

# round woven tray (40x40, shown at 3x)
N = 40; im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); px = im.load()
for y in range(N):
    for x in range(N):
        if math.hypot(x+.5-20.5, y+.5-20.5) <= 18.5: px[x, y] = (0, 0, 0, 90)
for y in range(N):
    for x in range(N):
        dx, dy = x+.5-18.5, y+.5-18.5; r = math.hypot(dx, dy); s = dx + dy
        if r > 18.5: continue
        if r > 17.3: px[x, y] = C(INK)
        elif r > 13.8: px[x, y] = C('#e6a84f') if s < -5 else C('#8f4f12') if s > 5 else C('#c4741c')
        elif r > 12.8: px[x, y] = C('#8f4f12')
        else:
            a = ((x // 2) + (y // 2)) % 2 == 0
            col = (C('#f2c872') if a else C('#e3aa52')) if s <= 6 else (C('#d9a04a') if a else C('#c98f3a'))
            if s < -15 and r > 7: col = C('#fff0bd')
            px[x, y] = col
im.save('src/retro/tray.png')
print('assets ok')
