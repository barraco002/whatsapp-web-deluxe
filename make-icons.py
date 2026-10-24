from PIL import Image, ImageDraw
import os
d = r'D:\dev\whatsapp-deluxe-extension\icons'
os.makedirs(d, exist_ok=True)
S = 512
im = Image.new('RGBA', (S, S), (0,0,0,0))
dr = ImageDraw.Draw(im)
# fondo: cuadrado redondeado verde
dr.rounded_rectangle([8,8,S-8,S-8], radius=int(S*0.22), fill=(37,211,102,255))
# burbuja blanca centrada
x0, y0, x1, y1 = int(S*0.22), int(S*0.26), int(S*0.78), int(S*0.68)
dr.rounded_rectangle([x0,y0,x1,y1], radius=int(S*0.10), fill=(255,255,255,255))
# cola de la burbuja (triangulo abajo-izquierda)
dr.polygon([(int(S*0.30), y1-6), (int(S*0.30), int(S*0.80)), (int(S*0.46), y1-6)], fill=(255,255,255,255))
# tres puntos verdes dentro de la burbuja
cy = (y0+y1)//2
for k in (-1,0,1):
    cx = int(S*0.5 + k*S*0.11)
    r = int(S*0.035)
    dr.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(37,211,102,255))
for size in (128, 48, 32, 16):
    out = im.resize((size,size), Image.LANCZOS)
    p = os.path.join(d, 'icon%d.png' % size)
    out.save(p, optimize=True)
    print(p, os.path.getsize(p), 'bytes')