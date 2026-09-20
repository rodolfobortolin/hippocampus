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

raw = Image.open('assets/icon.png').convert('RGBA')
raw = raw.crop(raw.getbbox())
MASTER = 1024
body = raw.resize((MASTER, MASTER), Image.LANCZOS)

# The background colour comes from the art itself, at a point inside the shape
# and away from the drawing — so the fill is the same black, wherever the art
# came from.
background = body.convert('RGB').getpixel((int(MASTER * 0.06), int(MASTER * 0.5)))
frame = Image.new('RGBA', (MASTER, MASTER), (*background, 255))
frame.alpha_composite(body)
frame.save('build/icon-1024.png')

sil = Image.open('assets/silhouette.png').convert('RGBA')
sil = sil.crop(sil.getbbox())

for scale in (1, 2):
    side = 22 * scale
    inner = int(side * 0.88)
    ratio = sil.size[0] / sil.size[1]
    w, h = (max(1, round(inner * ratio)), inner) if ratio < 1 else (inner, max(1, round(inner / ratio)))
    piece = sil.resize((w, h), Image.LANCZOS)
    black = Image.new('RGBA', (w, h), (0, 0, 0, 255))
    black.putalpha(piece.split()[3])
    box = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    box.paste(black, ((side - w) // 2, (side - h) // 2), black)
    box.save(f'public/trayTemplate{"@2x" if scale == 2 else ""}.png')

for target, height, colour in [('public/favicon.png', 56, (255, 150, 60, 255)),
                               ('public/brand.png', 120, (255, 145, 55, 255))]:
    ratio = sil.size[0] / sil.size[1]
    w = max(1, round(height * ratio))
    piece = sil.resize((w, height), Image.LANCZOS)
    ink = Image.new('RGBA', (w, height), colour)
    ink.putalpha(piece.split()[3])
    margin = 8 if 'brand' in target else 4
    sheet = Image.new('RGBA', (w + margin * 2, height + margin * 2), (0, 0, 0, 0))
    sheet.paste(ink, (margin, margin), ink)
    sheet.save(target)

print('art ready')
