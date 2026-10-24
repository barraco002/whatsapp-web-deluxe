"""Comprueba que los assets de la tienda tengan las dimensiones exactas que pide cada formulario."""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, "store")

EXPECTED = {
    "screenshot-1-window.png": (1280, 800),
    "screenshot-2-options.png": (1280, 800),
    "screenshot-3-features.png": (1280, 800),
    "promo-small-440x280.png": (440, 280),
    "promo-marquee-1400x560.png": (1400, 560),
}

problems = []
for name, want in EXPECTED.items():
    path = os.path.join(STORE, name)
    if not os.path.exists(path):
        problems.append("falta " + name)
        continue
    im = Image.open(path)
    if im.size != want:
        problems.append("%s mide %s, se esperaba %s" % (name, im.size, want))
        continue
    colors = len(set(im.convert("RGB").resize((80, 50)).getdata()))
    if colors < 12:
        problems.append("%s parece vacia (%d colores)" % (name, colors))
        continue
    print("OK    %-34s %s  %d colores  %d bytes" % (name, im.size, colors, os.path.getsize(path)))

if problems:
    for p in problems:
        print("FALLO " + p)
    sys.exit(1)
print("\n%d/%d imagenes listas" % (len(EXPECTED), len(EXPECTED)))
