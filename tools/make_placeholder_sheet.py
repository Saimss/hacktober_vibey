# Placeholder sprite sheet: 4 frames x 6 rows (idle, walk, sleepy, hungry, happy, sad), 32px frames.
from PIL import Image, ImageDraw
F, K = 32, (30, 30, 40, 255)
cols = [(143,217,182),(143,217,182),(150,160,215),(235,170,120),(250,215,100),(140,150,185)]
img = Image.new('RGBA', (F*4, F*6), (0,0,0,0)); d = ImageDraw.Draw(img)
for r in range(6):
    for f in range(4):
        ox, oy = f*F, r*F; bob = [0,1,0,-1][f] if r != 2 else [0,0,1,1][f]
        d.ellipse([ox+5, oy+8+bob, ox+27, oy+30+bob], fill=cols[r]+(255,), outline=K)
        ey = oy+17+bob
        if r == 2:   [d.line([ox+a, ey, ox+a+4, ey], fill=K) for a in (9,19)]
        elif r == 4: [d.arc([ox+a, ey-3, ox+a+6, ey+3], 200, 340, fill=K) for a in (9,18)]
        else:        [d.rectangle([ox+a, ey-1, ox+a+2, ey+1], fill=K) for a in (10,20)]
        if r == 3: d.ellipse([ox+14, ey+4, ox+18, ey+8], fill=K)
        if r == 5: d.line([ox+13, ey+7, ox+19, ey+7], fill=K)
        if r == 1: d.rectangle([ox+8+(f%2)*8, oy+29, ox+12+(f%2)*8, oy+31], fill=K)
img.save('src/sheet.png')
