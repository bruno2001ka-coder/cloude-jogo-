"""Reescreve um .glb com as texturas menores.

POR QUE ISTO EXISTE: o SUV do Meshy vem com base_color e normal em 4096x4096 e
metallic_roughness em 2048 — 14,6 MB de arquivo pra um carro de 2 m que, na tela de um celular,
raramente passa de 300 px de altura. O conjunto de texturas do jogo INTEIRO tem 1,2 MB a 512.

Não dá pra só trocar os bytes da imagem no lugar: os `bufferView` guardam offset e tamanho dentro de
um bloco binário contínuo, então mudar o tamanho de um empurra todos os seguintes. O jeito certo é
remontar o bloco inteiro, na ordem, corrigindo cada offset — que é o que este script faz.
"""
import json,struct,io,sys
from PIL import Image

ALVO={'base_color':1024,'normal':1024,'metallic_roughness':512}
PADRAO=1024
QUALIDADE=88

def ler_glb(caminho):
    d=open(caminho,'rb').read();off=12;js=None;bin_=None
    while off<len(d):
        clen,ctype=struct.unpack('<II',d[off:off+8]);ch=d[off+8:off+8+clen]
        if ctype==0x4E4F534A: js=json.loads(ch)
        elif ctype==0x004E4942: bin_=ch
        off+=8+clen
    return js,bin_

def encolher(entrada,saida):
    js,bin_=ler_glb(entrada)
    # 1) gera as imagens novas
    novas={}
    for i,im in enumerate(js.get('images',[])):
        bv=js['bufferViews'][im['bufferView']]
        o=bv.get('byteOffset',0);n=bv['byteLength']
        img=Image.open(io.BytesIO(bin_[o:o+n]))
        alvo=ALVO.get(im.get('name',''),PADRAO)
        if img.width>alvo:
            img=img.resize((alvo,alvo),Image.LANCZOS)
        buf=io.BytesIO()
        img.convert('RGB').save(buf,format='JPEG',quality=QUALIDADE,optimize=True)
        # O CONTEÚDO VIRA JPEG, ENTÃO O `mimeType` TEM QUE DIZER ISSO. Ficou 'image/png' na primeira
        # versão e passou batido porque o SUV já vinha com JPEG; a moto do piloto veio em PNG e
        # entregaria bytes JPEG anunciados como PNG. Navegador costuma adivinhar pelo cabeçalho, mas
        # não é obrigado — e um asset que depende de adivinhação quebra no aparelho de alguém.
        im['mimeType']='image/jpeg'
        novas[im['bufferView']]=buf.getvalue()
        print(f"  {im.get('name')}: {n/1048576:.2f} MB -> {len(novas[im['bufferView']])/1048576:.2f} MB ({alvo}px)")

    # 2) remonta o bloco binário na ordem dos bufferViews, corrigindo os offsets
    partes=[];pos=0
    for i,bv in enumerate(js['bufferViews']):
        if i in novas: dados=novas[i]
        else:
            o=bv.get('byteOffset',0);dados=bin_[o:o+bv['byteLength']]
        # alinhamento de 4 bytes: o glTF exige, e sem isto o leitor lê lixo no acessor seguinte
        pad=(-pos)%4
        if pad: partes.append(b'\x00'*pad);pos+=pad
        bv['byteOffset']=pos;bv['byteLength']=len(dados)
        partes.append(dados);pos+=len(dados)
    novo_bin=b''.join(partes)
    js['buffers']=[{'byteLength':len(novo_bin)}]

    # 3) escreve o glb
    txt=json.dumps(js,separators=(',',':')).encode('utf-8')
    txt+=b' '*((-len(txt))%4)
    corpo=novo_bin+b'\x00'*((-len(novo_bin))%4)
    total=12+8+len(txt)+8+len(corpo)
    with open(saida,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,total))
        f.write(struct.pack('<II',len(txt),0x4E4F534A));f.write(txt)
        f.write(struct.pack('<II',len(corpo),0x004E4942));f.write(corpo)
    return total

if __name__=='__main__':
    tam=encolher(sys.argv[1],sys.argv[2])
    print(f"saída: {tam/1048576:.2f} MB")
