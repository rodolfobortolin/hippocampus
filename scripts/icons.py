"""Prepares the icons from the art in assets/.

The app icon bleeds to the edge, on purpose.

The classic macOS grid reserved 824 of 1024 for the content and the rest for
the shadow the system drew. From macOS 26 onwards the system applies its own
mask to every icon — and then the art's own margin becomes a margin *inside*
the system's clip: the drawing shows up small, floating in an empty square.
Bleeding to the edge leaves the shape to macOS, which is what it wants.

The background is painted opaque before the art is pasted. If the corner radius
of the art does not match the system's exactly, the difference is filled with
the same dark colour instead of becoming a transparent nick in the corner.

The silhouette becomes a monochrome mask for the menu bar, where only the alpha
channel matters: macOS recolours it according to the theme.
"""
from PIL import Image
import pathlib

pathlib.Path('build').mkdir(exist_ok=True)
pathlib.Path('public').mkdir(exist_ok=True)

bruto = Image.open('assets/icone.png').convert('RGBA')
bruto = bruto.crop(bruto.getbbox())
MESTRE = 1024
corpo = bruto.resize((MESTRE, MESTRE), Image.LANCZOS)

# The background colour comes from the art itself, at a point inside the shape
# and away from the drawing — so the fill is the same black, wherever the art
# came from.
fundo = corpo.convert('RGB').getpixel((int(MESTRE * 0.06), int(MESTRE * 0.5)))
quadro = Image.new('RGBA', (MESTRE, MESTRE), (*fundo, 255))
quadro.alpha_composite(corpo)
quadro.save('build/icone-1024.png')

sil = Image.open('assets/silhueta.png').convert('RGBA')
sil = sil.crop(sil.getbbox())

for escala in (1, 2):
    lado = 22 * escala
    interno = int(lado * 0.88)
    prop = sil.size[0] / sil.size[1]
    lg, at = (max(1, round(interno * prop)), interno) if prop < 1 else (interno, max(1, round(interno / prop)))
    peca = sil.resize((lg, at), Image.LANCZOS)
    preto = Image.new('RGBA', (lg, at), (0, 0, 0, 255))
    preto.putalpha(peca.split()[3])
    caixa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    caixa.paste(preto, ((lado - lg) // 2, (lado - at) // 2), preto)
    caixa.save(f'public/trayTemplate{"@2x" if escala == 2 else ""}.png')

for destino, altura, cor in [('public/favicon.png', 56, (255, 150, 60, 255)),
                             ('public/marca.png', 120, (255, 145, 55, 255))]:
    prop = sil.size[0] / sil.size[1]
    lg = max(1, round(altura * prop))
    peca = sil.resize((lg, altura), Image.LANCZOS)
    tinta = Image.new('RGBA', (lg, altura), cor)
    tinta.putalpha(peca.split()[3])
    folga = 8 if 'marca' in destino else 4
    fundo = Image.new('RGBA', (lg + folga * 2, altura + folga * 2), (0, 0, 0, 0))
    fundo.paste(tinta, (folga, folga), tinta)
    fundo.save(destino)

print('arte preparada')
