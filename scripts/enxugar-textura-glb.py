#!/usr/bin/env python3
"""Reduz a TEXTURA de um .glb sem tocar em malha, rig ou animação.

Existe por causa de um número: o `policial.glb` que o Bruno mandou tem 20,3 MB, e 20,0 deles são UMA
imagem PNG de 4096x4096. A malha inteira tem 2.140 triângulos e cabe em 0,3 MB. Num boneco de 90 cm
na tela de um celular, 4096 e 1024 são indistinguíveis — o que 4096 garante é um minuto e meio de
espera no 3G.

O QUE ESTE SCRIPT NÃO FAZ, e é o mais importante: ele não reexporta o modelo. Malha, esqueleto, pesos
de pele, animações e materiais saem daqui byte a byte iguais aos que entraram. A única coisa que muda
é o conteúdo do bufferView da imagem — e, por consequência, o deslocamento dos bufferViews seguintes.
Reexportar era o que já quebrou modelo neste projeto.

    python3 scripts/enxugar-textura-glb.py assets/policial.glb 1024
"""
import json, struct, sys, io, os
from PIL import Image

ALINHAR = 4  # o glTF exige bufferView alinhado a 4 bytes


def ler_glb(caminho):
    with open(caminho, 'rb') as f:
        if f.read(4) != b'glTF':
            raise SystemExit('não é um .glb')
        _ver, _total = struct.unpack('<II', f.read(8))
        js = bin_ = None
        while True:
            cab = f.read(8)
            if len(cab) < 8:
                break
            tam, tipo = struct.unpack('<II', cab)
            dados = f.read(tam)
            if tipo == 0x4E4F534A:
                js = json.loads(dados)
            elif tipo == 0x004E4942:
                bin_ = dados
    return js, bin_


def escrever_glb(caminho, js, bin_):
    cj = json.dumps(js, separators=(',', ':')).encode('utf-8')
    cj += b' ' * ((-len(cj)) % ALINHAR)          # o chunk JSON completa com ESPAÇO
    cb = bin_ + b'\x00' * ((-len(bin_)) % ALINHAR)  # e o binário com ZERO
    total = 12 + 8 + len(cj) + 8 + len(cb)
    with open(caminho, 'wb') as f:
        f.write(b'glTF' + struct.pack('<II', 2, total))
        f.write(struct.pack('<II', len(cj), 0x4E4F534A) + cj)
        f.write(struct.pack('<II', len(cb), 0x004E4942) + cb)
    return total


def enxugar(caminho, lado, qualidade=88):
    js, bin_ = ler_glb(caminho)
    if not js.get('images'):
        raise SystemExit('esse glb não tem imagem embutida')

    novas = {}
    for i, im in enumerate(js['images']):
        if 'bufferView' not in im:
            continue
        bv = js['bufferViews'][im['bufferView']]
        cru = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        img = Image.open(io.BytesIO(cru))
        antes = img.size
        if max(antes) > lado:
            img = img.resize((min(lado, antes[0]), min(lado, antes[1])), Image.LANCZOS)
        buf = io.BytesIO()
        img.convert('RGB').save(buf, 'JPEG', quality=qualidade, optimize=True, progressive=True)
        novas[im['bufferView']] = buf.getvalue()
        im['mimeType'] = 'image/jpeg'
        print('  imagem %d: %dx%d %s (%.1f MB) -> %dx%d JPEG (%.2f MB)'
              % (i, antes[0], antes[1], img.format or 'PNG', len(cru) / 1048576,
                 img.size[0], img.size[1], len(novas[im['bufferView']]) / 1048576))

    # ===== REMONTA O BINÁRIO =====
    # Cada bufferView é copiado INTEIRO e em ordem de deslocamento original. Copiar por bufferView (e
    # não recortar o buraco da imagem) é o que mantém correto o caso de views que se sobrepõem, com
    # folga entre si, ou não referenciadas por ninguém — e os `byteOffset` dos accessors são relativos
    # à view, então continuam valendo sem tocar em nada.
    ordem = sorted(range(len(js['bufferViews'])), key=lambda k: js['bufferViews'][k].get('byteOffset', 0))
    saida = bytearray()
    for k in ordem:
        bv = js['bufferViews'][k]
        dados = novas.get(k, bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
        saida += b'\x00' * ((-len(saida)) % ALINHAR)
        bv['byteOffset'] = len(saida)
        bv['byteLength'] = len(dados)
        saida += dados
    js['buffers'][0]['byteLength'] = len(saida)

    antes = os.path.getsize(caminho)
    depois = escrever_glb(caminho, js, bytes(saida))
    print('  %s: %.1f MB -> %.2f MB' % (os.path.basename(caminho), antes / 1048576, depois / 1048576))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    enxugar(sys.argv[1], int(sys.argv[2]))
