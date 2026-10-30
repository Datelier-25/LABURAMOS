"""Recorta logotipo e isotipo de la lámina de marca (JPG), quita el fondo gris y arma favicon e íconos.
Uso: python recortar_lamina.py <lamina.jpg> <carpeta_salida>
Las coordenadas de recorte son las de la lámina original de 1600x893 (assets/lamina_marca.jpg)."""
import sys, os
import numpy as np
from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGB')
BG = np.array([234.5, 236.5, 235.5])
ORANGE = (247, 106, 1)


def grow(seed, allowed):
    """Expande la semilla dentro de `allowed` (4-vecinos)."""
    reach = seed & allowed
    while True:
        g = reach.copy()
        g[1:, :] |= reach[:-1, :]; g[:-1, :] |= reach[1:, :]
        g[:, 1:] |= reach[:, :-1]; g[:, :-1] |= reach[:, 1:]
        g &= allowed
        if (g == reach).all():
            return reach
        reach = g


def cutout(box, keep=None, tol=70):
    """RGBA del recorte sin fondo. Semillas de fondo: el gris exacto en cualquier parte (huecos de letras,
    entre patas) salvo dentro de `keep` (caja de la lámina): ahí la mancha de la cara es del mismo gris
    y solo se borra lo que esté conectado con el exterior. El borde suave se expande desde las semillas."""
    a = np.asarray(im.crop(box), float)
    d = np.sqrt(((a - BG) ** 2).sum(-1))
    seed = d < 12
    if keep:
        kx0, ky0, kx1, ky1 = (keep[0] - box[0], keep[1] - box[1], keep[2] - box[0], keep[3] - box[1])
        inner = np.zeros_like(seed)
        inner[max(ky0, 0):ky1, max(kx0, 0):kx1] = True
        seed &= ~inner
        seed[0, :] |= d[0, :] < 12; seed[-1, :] |= d[-1, :] < 12
        seed[:, 0] |= d[:, 0] < 12; seed[:, -1] |= d[:, -1] < 12
    edge = grow(seed, d < tol)
    alpha = np.where(edge, np.clip((d - 12) / (tol - 12), 0, 1), 1.0)
    al = alpha[..., None]
    rgb = np.where(al < 1, (a - (1 - al) * BG) / np.maximum(al, 1e-3), a)
    # la mancha que quedó (gris de la lámina, opaca) pasa a blanco de la paleta
    lift = (alpha == 1) & (d < 30)
    w = np.clip(1 - d / 30, 0, 1)[..., None]
    rgb = np.where(lift[..., None], rgb + (255 - BG) * w, rgb)
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)


def to_img(arr):
    img = Image.fromarray(arr, 'RGBA')
    return img.crop(img.getbbox())


def fit(img, size, frac, dy=0.0):
    """Centra `img` en un lienzo cuadrado transparente ocupando `frac` del lado."""
    s = frac * size / max(img.size)
    r = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c.alpha_composite(r, ((size - r.width) // 2, (size - r.height) // 2 + round(dy * size)))
    return c


def shape(size, kind):
    """Círculo o cuadrado redondeado naranja, dibujado a 4x para antialias."""
    k = 4
    m = Image.new('L', (size * k, size * k), 0)
    dr = ImageDraw.Draw(m)
    if kind == 'circle':
        dr.ellipse((0, 0, size * k - 1, size * k - 1), fill=255)
    else:
        dr.rounded_rectangle((0, 0, size * k - 1, size * k - 1), radius=int(size * k * 0.22), fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    c = Image.new('RGBA', (size, size), ORANGE + (0,))
    c.putalpha(m)
    return c


# 1. Logotipo principal (caballo + sombra + palabra)
main_box = (250, 95, 1390, 530)
main = cutout(main_box, keep=(300, 95, 440, 260))   # cabeza del caballo grande
to_img(main).save(f'{OUT}/logotipo.png')

# 2. Caballo de cuerpo entero con su sombra, sin la palabra (la "L" arranca en x≈485, la sombra en y≈465)
horse = main.copy()
x0, y0 = main_box[:2]
horse[:, 470 - x0:, 3] = 0                          # todo lo que está a la derecha del caballo...
sh = main[465 - y0:, 470 - x0:]                     # ...salvo la sombra que se extiende debajo de la palabra
horse[465 - y0:, 470 - x0:] = sh
horse = to_img(horse)
horse.save(f'{OUT}/isotipo-caballo.png')

# 3. Isotipo (busto del caballo, versión sin fondo de la lámina)
iso_box = (1380, 635, 1515, 820)
iso = to_img(cutout(iso_box, keep=iso_box))
iso.save(f'{OUT}/isotipo.png')

# 4. Favicon: círculo naranja + busto (como en la lámina)
def favicon(size):
    c = shape(size, 'circle')
    c.alpha_composite(fit(iso, size, 0.72, dy=0.0))
    return c

for s in (16, 32, 48, 180, 512):
    favicon(s).save(f'{OUT}/favicon-{s}.png')
favicon(256).save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

# 5. Icono de app: cuadrado redondeado naranja + caballo entero con sombra (como en la lámina)
def app_icon(size, rounded=True):
    c = shape(size, 'rounded') if rounded else Image.new('RGBA', (size, size), ORANGE + (255,))
    c.alpha_composite(fit(horse, size, 0.74, dy=0.0))
    return c

for s in (192, 512):
    app_icon(s).save(f'{OUT}/icono-app-{s}.png')
app_icon(180, rounded=False).save(f'{OUT}/apple-touch-icon.png')   # iOS redondea solo

for f in sorted(os.listdir(OUT)):
    print(f, Image.open(f'{OUT}/{f}').size)

# Las versiones "claro" y "horizontal" (círculo naranja + LaburamosApp) las arma generar_logos.py
