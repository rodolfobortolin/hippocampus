"""Prepara os ícones a partir da arte em assets/.

O ícone do app sangra até a borda, de propósito.

A grade clássica do macOS reservava 824 de 1024 para o conteúdo e o resto para
a sombra que o sistema desenhava. Do macOS 26 em diante o sistema aplica a
própria máscara em todo ícone — e aí a margem da arte vira margem *dentro* do
recorte do sistema: o desenho aparece pequeno, boiando num quadrado vazio.
Sangrando até a borda, quem define a forma é o macOS, que é o que ele quer.

O fundo é pintado opaco antes de colar a arte. Se o raio do canto da arte não
bater exatamente com o do sistema, a diferença fica preenchida com a mesma cor
escura em vez de virar um respingo transparente na quina.

A silhueta vira máscara monocromática para a barra de menus, onde o que importa
é só o canal alfa: o macOS recolore conforme o tema.
"""
from PIL import Image
import pathlib

pathlib.Path('build').mkdir(exist_ok=True)
pathlib.Path('public').mkdir(exist_ok=True)

bruto = Image.open('assets/icone.png').convert('RGBA')
bruto = bruto.crop(bruto.getbbox())
MESTRE = 1024
corpo = bruto.resize((MESTRE, MESTRE), Image.LANCZOS)

# A cor do fundo vem da própria arte, num ponto dentro da forma e longe do
# desenho — assim o preenchimento é o mesmo preto, venha de onde vier a arte.
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
