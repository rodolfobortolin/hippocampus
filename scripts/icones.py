"""Prepara os ícones a partir da arte em assets/.

O ícone do app é reencaixado na grade do macOS — 824 de 1024, com o resto
reservado para a sombra que o sistema desenha. Sem isso ele aparece maior que
os vizinhos no Dock. A silhueta vira máscara monocromática para a barra de
menus, onde o que importa é só o canal alfa: o macOS recolore conforme o tema.
"""
from PIL import Image
import pathlib

pathlib.Path('build').mkdir(exist_ok=True)
pathlib.Path('public').mkdir(exist_ok=True)

bruto = Image.open('assets/icone.png').convert('RGBA')
bruto = bruto.crop(bruto.getbbox())
MESTRE, CONTEUDO = 1024, 824
quadro = Image.new('RGBA', (MESTRE, MESTRE), (0, 0, 0, 0))
corpo = bruto.resize((CONTEUDO, CONTEUDO), Image.LANCZOS)
quadro.paste(corpo, ((MESTRE - CONTEUDO) // 2,) * 2, corpo)
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
