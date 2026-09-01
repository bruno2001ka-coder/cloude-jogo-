"""Gera os conjuntos PBR do Quintal 3D: cor (albedo), normal e ORM.

Por que PROCEDURAL e não baixado: este ambiente bloqueia download externo, então não dá pra pegar
pacote do Poly Haven/ambientCG. Gerar tem duas vantagens de qualquer jeito — tudo sai TILEÁVEL de
verdade (o ruído é feito no espaço da frequência, então a borda fecha por construção) e eu controlo o
peso, que é o que decide se roda no celular.

ORM = um RGB só com Oclusão no R, Roughness no G e Metalness no B. É o formato que o glTF usa e que o
three lê direto: a MESMA imagem serve de aoMap, roughnessMap e metalnessMap, ou seja, 1 textura na
memória de vídeo em vez de 3.

Normal: derivado por Sobel do campo de altura que gerou o relevo, não desenhado à mão. É o que faz a
luz do jogo bater certo nos sulcos — reboco e tijolo respondem diferente ao sol porque a altura é
diferente, não porque a cor é.
"""
import numpy as np, os
from PIL import Image

RES = 512
# Relativo ao script: rodar de qualquer diretório escreve no mesmo lugar.
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "tex")
rng = np.random.default_rng(7)

def ruido_tileavel(res, freq, oitavas=5, persist=0.5):
    """Ruído fractal periódico. Sorteia no domínio da FREQUÊNCIA e volta por IFFT: qualquer imagem
    feita assim é periódica por definição, então a textura casa na borda sem costura visível."""
    acc = np.zeros((res, res))
    amp, f = 1.0, freq
    for _ in range(oitavas):
        campo = rng.normal(size=(res, res))
        F = np.fft.fft2(campo)
        ky = np.fft.fftfreq(res)[:, None] * res
        kx = np.fft.fftfreq(res)[None, :] * res
        k = np.sqrt(kx**2 + ky**2)
        # passa-banda em volta de f: mantém só o detalhe daquela escala
        filtro = np.exp(-((k - f) ** 2) / (2 * (f * 0.55 + 1) ** 2))
        camada = np.real(np.fft.ifft2(F * filtro))
        s = camada.std() or 1
        acc += amp * (camada / s)
        amp *= persist; f *= 2
    acc -= acc.min(); acc /= (acc.max() or 1)
    return acc

def normal_de_altura(h, forca=2.0):
    """Normal tangente a partir da altura, por diferença central com wrap (mantém o tileamento)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * forca
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * forca
    nz = np.ones_like(h)
    n = np.stack([-dx, -dy, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)

def orm(ao, rough, metal=None):
    m = np.zeros_like(ao) if metal is None else metal
    return (np.stack([ao, rough, m], -1).clip(0, 1) * 255).astype(np.uint8)

def blur(a, r):
    """Média em caixa separável com wrap — barato e suficiente pra referência de nível."""
    k = 2 * r + 1
    out = a.copy()
    for eixo in (0, 1):
        acc = np.zeros_like(out)
        for d in range(-r, r + 1):
            acc += np.roll(out, d, eixo)
        out = acc / k
    return out

def ocl(h, raio=8, forca=0.6):
    nivel = blur(h, raio)
    o = 1.0 - forca * np.clip(nivel - h, 0, None) / (np.ptp(h) or 1) * 4
    return np.clip(o, 0.25, 1.0)

def salvar(nome, albedo, h, rough, metal=None, forca_normal=2.0, ao_raio=8):
    os.makedirs(SAIDA, exist_ok=True)
    Image.fromarray((albedo.clip(0, 1) * 255).astype(np.uint8)).save(
        f"{SAIDA}/{nome}_cor.jpg", quality=88, optimize=True)
    Image.fromarray(normal_de_altura(h, forca_normal)).save(
        f"{SAIDA}/{nome}_normal.jpg", quality=92, optimize=True)
    Image.fromarray(orm(ocl(h, ao_raio), rough, metal)).save(
        f"{SAIDA}/{nome}_orm.jpg", quality=88, optimize=True)

def cinza(v):
    return np.stack([v, v, v], -1)

# ============================ REBOCO PINTADO ============================
# É a parede das casas. Fica QUASE BRANCO de propósito: a cor de cada casa entra por material.color,
# e o mapa só carrega a textura. Um albedo colorido aqui multiplicaria as duas cores e sujaria o tom.
def reboco():
    base = ruido_tileavel(RES, 3, 6, .55)
    poro = ruido_tileavel(RES, 40, 3, .5)
    manchas = ruido_tileavel(RES, 13, 4, .6)   # blobs menores: a 6 viravam borroes do tamanho da parede
    h = base * .45 + poro * .55
    # descascados: manchas onde o reboco caiu e aparece o cimento por baixo
    casca = (manchas > .80).astype(float)      # menos cobertura: reboco descascado e ponto, nao parede podre
    casca = blur(casca, 2)
    h = h * (1 - casca * .5) - casca * .18
    v = .82 + base * .12 + poro * .09 - casca * .12
    alb = cinza(v.clip(0, 1))
    alb[..., 2] *= .985  # um fio mais quente que neutro
    r = (.86 + poro * .10 + casca * .06).clip(.3, 1)
    salvar("reboco", alb, h, r, forca_normal=1.4, ao_raio=6)

# ============================ TIJOLO APARENTE ============================
def tijolo():
    lin, col = 14, 7                      # fiadas por textura
    y = np.linspace(0, lin, RES, endpoint=False)[:, None] * np.ones((1, RES))
    x = np.linspace(0, col, RES, endpoint=False)[None, :] * np.ones((RES, 1))
    fiada = np.floor(y)
    x = x + (fiada % 2) * .5              # amarração: fiada ímpar desloca meio tijolo
    fx, fy = x - np.floor(x), y - np.floor(y)
    arg = .055                            # espessura da argamassa
    massa = ((fx < arg) | (fx > 1 - arg) | (fy < arg * 2) | (fy > 1 - arg * 2)).astype(float)
    massa = blur(massa, 1)
    idx = (np.floor(x) * 31 + fiada * 17) % 7          # variação por tijolo
    tom = (idx / 6.0)
    gr = ruido_tileavel(RES, 30, 3, .5)
    h = (1 - massa) * (.72 + gr * .28) + massa * .12
    # tijolo avermelhado, argamassa cinza
    r_ = .52 + tom * .22 + gr * .10
    g_ = .26 + tom * .13 + gr * .09
    b_ = .19 + tom * .09 + gr * .08
    alb = np.stack([r_, g_, b_], -1)
    cinzaM = cinza(np.full((RES, RES), .62) + gr * .12)
    alb = alb * (1 - massa[..., None]) + cinzaM * massa[..., None]
    rough = (.88 + gr * .10 - massa * .04).clip(.4, 1)
    salvar("tijolo", alb, h, rough, forca_normal=3.2, ao_raio=5)

# ============================ TELHA / LAJE ============================
# Laje de cobertura com ondulação de fibrocimento: é o telhado mais comum de favela.
def telha():
    x = np.linspace(0, 1, RES, endpoint=False)[None, :] * np.ones((RES, 1))
    # 16 ondas por ladrilho de 2 m davam 12 cm de passo: a essa densidade a telha vira ruido na tela.
    # 10 ondas dao 20 cm, que e o passo da telha ondulada de verdade e le como telha a distancia.
    onda = (np.sin(x * np.pi * 2 * 10) * .5 + .5) ** 1.4
    sujeira = ruido_tileavel(RES, 8, 5, .6)
    gr = ruido_tileavel(RES, 45, 2, .5)
    h = onda * .7 + gr * .3
    v = .58 + onda * .16 + sujeira * .22 - gr * .06
    alb = cinza(v.clip(0, 1))
    alb[..., 0] *= 1.02; alb[..., 2] *= .97
    rough = (.90 + sujeira * .08).clip(.5, 1)
    salvar("telha", alb, h, rough, forca_normal=2.6, ao_raio=7)

# ============================ CHÃO DE TERRA / VIELA ============================
def chao():
    terra = ruido_tileavel(RES, 5, 6, .58)
    grao = ruido_tileavel(RES, 60, 3, .5)
    pedra = ruido_tileavel(RES, 22, 3, .5)
    seixos = (pedra > .70).astype(float)
    seixos = blur(seixos, 1)
    h = terra * .45 + grao * .25 + seixos * .5
    r_ = .40 + terra * .22 + grao * .10 + seixos * .16
    g_ = .31 + terra * .19 + grao * .09 + seixos * .15
    b_ = .22 + terra * .13 + grao * .07 + seixos * .14
    alb = np.stack([r_, g_, b_], -1)
    rough = (.93 + grao * .06 - seixos * .12).clip(.5, 1)
    salvar("chao", alb, h, rough, forca_normal=2.2, ao_raio=9)

# ============================ MADEIRA (portas, cerca, celeiro) ============================
# A PRIMEIRA versão desta função tinha o veio ATRAVESSADO na tábua: as juntas corriam na vertical e a
# fibra em faixas horizontais por cima. Isso não é madeira, é esteira — na porta do jogo lia como
# telha ondulada. Numa tábua real o veio corre no COMPRIMENTO, paralelo à junta.
# Convenção aqui: tábua em pé (como numa porta ou numa cerca de ripa). Junta e veio, os dois, variam
# em X e correm ao longo de Y.
TABUAS = 7          # por ladrilho de 2 m => tábua de 28 cm; uma porta de 95 cm mostra 3 tábuas e meia
def madeira():
    x = np.linspace(0, TABUAS, RES, endpoint=False)[None, :] * np.ones((RES, 1))
    y = np.linspace(0, 1, RES, endpoint=False)[:, None] * np.ones((1, RES))
    fx = x - np.floor(x)
    # Junta FINA e rasa. Antes tinha 3% de largura mas escurecia 55% e afundava .6 no relevo: com a
    # oclusão por cima virava um rasgo preto, e três rasgos pretos numa porta é o que dava o aspecto
    # de material errado. 1,5% de largura e 35% de escurecimento leem como fresta entre tábuas.
    junta = (np.minimum(fx, 1 - fx) < .015).astype(float)
    junta = blur(junta, 1)
    # Veio: linhas ao longo da tábua (variam em x), serpenteando devagar conforme sobem (deslocamento
    # que depende de y). O deslocamento é PERIÓDICO em y — um ruído qualquer quebraria o tileamento.
    onda = np.sin(y * np.pi * 2) * .35 + np.sin(y * np.pi * 4 + 1.7) * .18
    poro = ruido_tileavel(RES, 26, 3, .5)
    fibra = np.sin((x * 9 + onda + poro * .25) * np.pi * 2) * .5 + .5
    fibra = fibra ** 1.6          # linha escura fina sobre campo claro, como veio de verdade
    gr = ruido_tileavel(RES, 55, 2, .5)
    h = (1 - junta) * (.55 + fibra * .25 + gr * .20) - junta * .35
    # Tom por tábua: sem isso as tábuas somem e a superfície vira uma chapa lisa com listras.
    tabua = np.floor(x)
    tom = ((tabua * 37) % 5) / 4.0
    base = .46 + tom * .10 - fibra * .17 + gr * .05      # madeira média, quente
    r_ = base
    g_ = base * .70 + tom * .01
    b_ = base * .47
    alb = np.stack([r_, g_, b_], -1) * (1 - junta[..., None] * .35)
    rough = (.68 + gr * .12 + fibra * .10).clip(.35, 1)
    # forca_normal baixa: o veio é DESENHO, não sulco. A 2.0 a porta ganhava relevo de tronco lavrado.
    salvar("madeira", alb, h, rough, forca_normal=.9, ao_raio=4)

for f in (reboco, tijolo, telha, chao, madeira):
    f()
    print("ok:", f.__name__)

total = sum(os.path.getsize(os.path.join(SAIDA, f)) for f in os.listdir(SAIDA))
print(f"\n{len(os.listdir(SAIDA))} arquivos, {total/1048576:.2f} MB no total")
for f in sorted(os.listdir(SAIDA)):
    print(f"  {f:22s} {os.path.getsize(os.path.join(SAIDA,f))/1024:6.0f} KB")
