"""Arma los logos horizontales "LaburamosApp" y la trama de marca de agua a partir de public/marca/.

Uso: python generar_logos.py <carpeta public/marca del proyecto>

Necesita en esa carpeta: logotipo.png (caballo + "Laburamos" en navy, sale de recortar_lamina.py),
favicon-512.png (busto en el círculo naranja) e isotipo.png (busto).
Genera:
  logotipo-claro.png       círculo + "Laburamos" blanco + "App" naranja (fondos oscuros)
  logotipo-horizontal.png  círculo + "Laburamos" navy + "App" naranja (menú, fondos claros)
  marca-agua.png           baldosa 340x210 con isotipo gris + "LaburamosApp" girado, para la trama del CV
Si cambia el tamaño de los logos, actualizar los "ratio" en src/components/Logo.jsx.

Tipografías (Windows): Century Gothic Bold para "App" (la más parecida a la del logo) y Arial Bold para la trama.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

D = sys.argv[1]
FONTS = os.environ.get('FONTS_DIR', r'C:/Windows/Fonts')
GOTHIC = os.path.join(FONTS, 'GOTHICB.TTF')
ARIAL = os.path.join(FONTS, 'arialbd.ttf')
NAVY, ORANGE = (25, 25, 75), (247, 106, 1)

# 1. Palabra "Laburamos" recortada del logotipo (a la derecha del caballo, arriba de la sombra)
L = Image.open(os.path.join(D, 'logotipo.png')).convert('RGBA')
arr = np.array(L.crop((225, 0, L.width, 355)))
rows = np.where((arr[..., 3] > 40).any(1))[0]
cols = np.where((arr[..., 3] > 40).any(0))[0]
word = arr[rows.min():rows.max() + 1, cols.min():cols.max() + 1].copy()
cap_h = word.shape[0]  # "Laburamos" no tiene descendentes: el alto es el de la L

# 2. "App" en Century Gothic Bold, con la misma altura de mayúscula
f0 = ImageFont.truetype(GOTHIC, 200)
bb = f0.getbbox('A')
font = ImageFont.truetype(GOTHIC, int(200 * cap_h / (bb[3] - bb[1])))
tmp = Image.new('RGBA', (font.getbbox('App')[2] + 20, int(cap_h * 1.45)), (0, 0, 0, 0))
ImageDraw.Draw(tmp).text((0, -font.getbbox('A')[1]), 'App', font=font, fill=ORANGE + (255,))
app = tmp.crop(tmp.getbbox())


def build(color, name):
    w = word.copy()
    w[..., :3] = color
    wi = Image.fromarray(w, 'RGBA')
    h = wi.height
    circ = Image.open(os.path.join(D, 'favicon-512.png')).resize((int(h * 1.55), int(h * 1.55)), Image.LANCZOS)
    gap, gap2 = int(h * 0.42), int(h * 0.06)
    out = Image.new('RGBA', (circ.width + gap + wi.width + gap2 + app.width, max(circ.height, app.height)), (0, 0, 0, 0))
    top = (out.height - h) // 2
    out.alpha_composite(circ, (0, (out.height - circ.height) // 2))
    out.alpha_composite(wi, (circ.width + gap, top))
    out.alpha_composite(app, (circ.width + gap + wi.width + gap2, top))  # alineada arriba, como mayúscula
    out.save(os.path.join(D, name))
    print(name, out.size, 'ratio', f'{out.width}/{out.height}')


build((255, 255, 255), 'logotipo-claro.png')
build(NAVY, 'logotipo-horizontal.png')

# 3. Trama de marca de agua: isotipo en gris + "LaburamosApp", girado 22°, centrado en una baldosa
W, H = 340, 210
f = ImageFont.truetype(ARIAL, 30)
iso = Image.open(os.path.join(D, 'isotipo.png')).convert('RGBA')
g = ImageOps.grayscale(iso.convert('RGB'))
g = Image.merge('RGBA', (g, g, g, iso.getchannel('A')))
g = g.resize((int(g.width * 0.34), int(g.height * 0.34)), Image.LANCZOS)
tw = int(ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength('LaburamosApp', font=f))
st = Image.new('RGBA', (g.width + 10 + tw, max(g.height, 40)), (0, 0, 0, 0))
st.alpha_composite(g, (0, (st.height - g.height) // 2))
ImageDraw.Draw(st).text((g.width + 10, st.height // 2 - 18), 'LaburamosApp', font=f, fill=(110, 115, 160, 255))
st = st.rotate(22, resample=Image.BICUBIC, expand=True)
tile = Image.new('RGBA', (W, H), (0, 0, 0, 0))
tile.alpha_composite(st, ((W - st.width) // 2, (H - st.height) // 2))
tile.save(os.path.join(D, 'marca-agua.png'))
print('marca-agua.png', tile.size)
