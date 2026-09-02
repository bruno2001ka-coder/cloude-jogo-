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

# ============================ REBOCO DESCASCADO ============================
# É a parede das casas, e o traço mais forte da referência de favela: o reboco cai em placas e o
# CIMENTO CRU aparece por baixo, com sujeira escorrendo do telhado pra baixo.
#
# UMA RESTRIÇÃO MANDA NO DESENHO DESTA TEXTURA: a cor de cada casa entra por `material.color`, que
# MULTIPLICA o mapa inteiro. Então não dá pra pintar tijolo vermelho no descascado — numa casa azul o
# tijolo sairia azul. O que aparece na falha é cimento DESSATURADO (cinza), que multiplicado por
# qualquer tinta continua lendo como cimento. Tijolo aparente de verdade existe no jogo, mas como
# geometria separada com o material `tijolo` sem tinta (ver a faixa de embasamento no WorldGenerator).
def reboco():
    base   = ruido_tileavel(RES,  3, 6, .55)   # ondulação larga da parede
    poro   = ruido_tileavel(RES, 40, 3, .50)   # grão fino do reboco
    # Frequência BAIXA é o que define a leitura: a 9 as falhas saíam do tamanho de moedas e a parede
    # lia como mofo pintado de cinza. A 3,5 cada placa tem quase um metro, que é o tamanho de reboco
    # que cai de verdade — e é o que aparece na referência.
    # A FORMA DA PLACA foi o que mais custou a acertar, e as duas tentativas erradas ensinam o porquê:
    #  · frequência baixa (3) com UMA oitava: falhas de quase um metro, todas do mesmo tamanho e
    #    arredondadas — a casa virava CAMUFLAGEM de manchas escuras;
    #  · frequência alta (7) com UMA oitava: falhas de 30 cm, mas de novo todas iguais e redondas —
    #    a parede virava MEDIDA, um chuvisco de pintinhas espalhado por igual.
    # O defeito comum é a oitava única: uma banda de frequência só devolve bolhas de UM tamanho.
    # Reboco caído de verdade tem placa grande com borda rasgada e placa pequena ao lado. Isso é um
    # campo multi-escala com a escala GRANDE dominando: 3 oitavas com persistência .45 (amplitudes
    # 1 / .45 / .20) dão a mancha grande, o recorte irregular e a variação de tamanho de uma vez só.
    placas = ruido_tileavel(RES,  5, 3, .45)   # onde a placa de reboco se soltou
    borda  = ruido_tileavel(RES, 26, 2, .50)   # morde a borda da placa pra não virar bolha lisa

    # A PLACA. Limiar sobre o ruído, mordido pelo ruído fino: é o recorte irregular que faz parecer
    # reboco arrancado em vez de mancha pintada. ~28% da parede descasca.
    # ~15% da parede descasca. A 28% o olho via DUAS cores em partes quase iguais e lia camuflagem:
    # o que faz ler como favela é a falha ser EXCEÇÃO sobre a pintura, não metade dela.
    # Terceira calibragem, e a que resolveu. A 28% e depois a 15% de cobertura, com o cimento .12
    # abaixo do reboco, a parede AINDA lia como camuflagem numa foto de perto: o olho não conta a
    # área, conta o CONTRASTE, e duas manchas de valor bem diferente espalhadas por igual formam
    # padrão de camuflagem em qualquer proporção. Agora são ~7% de falha e o degrau de valor caiu
    # pela metade — a falha vira detalhe que se nota de perto, não a leitura da parede de longe.
    caiu = ((placas + borda * .12 - .06) > .70).astype(float)
    caiu_suave = blur(caiu, 2)
    # Anel de borda: a beirada da placa é mais alta que o miolo, e é ela que pega a luz raspante.
    beirada = np.clip(blur(caiu, 3) - caiu_suave, 0, 1) * 2.2

    # SUJEIRA ESCORRIDA — e ESTA é a leitura da parede de morro, mais que a placa caída: água suja
    # descendo da laje em rastro vertical, ano após ano.
    #
    # A primeira versão tentou fazer o rastro esticando um ruído 2D com quatro médias corridas em Y.
    # Não funcionou e o motivo é aritmético: quatro passadas de 7 linhas num ladrilho de 512 borram
    # ~20 px, ou seja 5 cm de parede. O resultado não era rastro, era CHUVISCO — e era ele, e não a
    # placa caída, o "camuflagem" que apareceu em duas fotos seguidas.
    #
    # Rastro de verdade não se faz borrando: se faz tirando o Y da conta. O perfil sai da MÉDIA POR
    # COLUNA do ruído (um vetor 1D, sem nenhuma variação vertical), e o comprimento vem de uma
    # máscara em cosseno com fase sorteada por coluna. Cosseno porque é periódico: a textura ladrilha
    # na vertical, e qualquer máscara não periódica deixaria uma linha de emenda na parede.
    faixaX = ruido_tileavel(RES, 22, 2, .5)
    perfil = faixaX.mean(axis=0)[None, :]
    perfil = (perfil - perfil.min()) / ((perfil.max() - perfil.min()) or 1)
    veio = np.clip((perfil - .52) * 2.6, 0, 1) * np.ones((RES, 1))
    fase = ruido_tileavel(RES, 3, 2, .5).mean(axis=0)[None, :]
    fase = (fase - fase.min()) / ((fase.max() - fase.min()) or 1)
    yy = np.linspace(0, 1, RES, endpoint=False)[:, None] * np.ones((1, RES))
    escorrido = veio * (.5 + .5 * np.cos(2 * np.pi * (yy - fase))) ** 2

    # RELEVO. O reboco é uma casca POR CIMA do cimento: onde ele caiu, o nível baixa de verdade.
    # ...mas POUCO. Com o degrau em .32 a oclusão calculada por `ocl` enegrecia a falha inteira e,
    # somada ao aoMap do material no jogo, a placa saía quase PRETA na tela. O degrau real entre
    # reboco e cimento é de milímetros, não de um palmo.
    h = base * .40 + poro * .60
    h = h * (1 - caiu_suave * .18) - caiu_suave * .025 + beirada * .10

    # COR. Reboco quase branco (a tinta da casa entra por fora); o cimento exposto é mais escuro e
    # mais neutro. O escorrido escurece os dois por igual, que é o que dá o aspecto encardido.
    # O cimento a .52 contra reboco a .86 virava buraco preto depois de a tinta da casa multiplicar
    # tudo. A .71 a falha continua legível e a parede segue lendo como UMA parede encardida.
    reboco_v = .86 + base * .10 + poro * .08
    cimento_v = .78 + poro * .09 + borda * .05
    v = reboco_v * (1 - caiu_suave) + cimento_v * caiu_suave
    # O ESCORRIDO É QUE FAZ A PAREDE DE MORRO, não a placa caída: água suja descendo da laje em rastro
    # vertical. Ele subiu de .30 pra .34 na mesma proporção em que a falha desceu — a parede continua
    # encardida, mas encardida NA VERTICAL, que é direcional e por isso nunca lê como camuflagem.
    v = v - escorrido * .26 - beirada * .04
    alb = cinza(v.clip(0, 1))
    # O cimento puxa pro frio e o reboco pintado pro quente: a diferença de TEMPERATURA é o que separa
    # os dois mesmo depois de a tinta da casa multiplicar tudo.
    # A diferença de TEMPERATURA entre cimento (frio) e reboco pintado (quente) é o que separa os dois
    # depois de a tinta da casa multiplicar tudo. Em .045/.05 ela era forte demais e a falha lia como
    # MANCHA AZUL-CLARA sobre parede branca — chamava mais atenção que o reboco. Um sexto disso já
    # basta pro olho ler "cimento" sem ler "pintaram de azul".
    alb[..., 0] *= 1 - caiu_suave * .02
    alb[..., 2] *= 1 + caiu_suave * .015

    rough = (.84 + poro * .10 + caiu_suave * .10 + escorrido * .06).clip(.3, 1)
    # forca_normal baixa (era 1,9): o degrau da placa entrava no normal e a luz do jogo sombreava a
    # falha inteira; junto com o aoMap, a placa saía quase preta. O relevo do reboco é de milímetros.
    # ao_raio menor (era 6): a oclusão calculada num raio grande espalhava a sombra da falha muito
    # além dela e era metade do efeito camuflagem — a mancha escura no albedo ganhava uma segunda,
    # maior, na sombra.
    salvar("reboco", alb, h, rough, forca_normal=1.1, ao_raio=4)

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
    # Tijolo VELHO, não tijolo de loja: o laranja saturado que estava aqui (.52/.26/.19 com +.22 de
    # variação) lia como parede de brinquedo. Tom mais baixo, menos separação entre tijolos e uma
    # camada de encardido por cima é o que faz ler como embasamento exposto há anos.
    encardido = ruido_tileavel(RES, 6, 2, .55)
    r_ = .28 + tom * .09 + gr * .06
    g_ = .17 + tom * .05 + gr * .05
    b_ = .14 + tom * .04 + gr * .04
    alb = np.stack([r_, g_, b_], -1) * (.62 + encardido * .34)[..., None]
    # Argamassa suja, não branca: a .62 ela virava a cor DOMINANTE da parede (é uma grade contínua) e
    # o tijolo aparecia como quadradinhos soltos dentro dela.
    cinzaM = cinza(np.full((RES, RES), .34) + gr * .09)
    alb = alb * (1 - massa[..., None]) + cinzaM * massa[..., None]
    rough = (.88 + gr * .10 - massa * .04).clip(.4, 1)
    salvar("tijolo", alb, h, rough, forca_normal=3.2, ao_raio=5)

# ============================ TELHA / ZINCO OXIDADO ============================
# Telhado de favela é chapa ondulada enferrujando, não laje cinza. A ferrugem entra no ALBEDO e as
# tintas de telhado (WorldGenerator) são claras de propósito, pra multiplicar sem matar o tom — cada
# casa fica com um nível de oxidação diferente sem custar uma textura por casa.
def telha():
    x = np.linspace(0, 1, RES, endpoint=False)[None, :] * np.ones((RES, 1))
    # 10 ondas por ladrilho de 2 m = 20 cm de passo, que é o da telha ondulada de verdade. A 16 o
    # passo caía pra 12 cm e a telha virava ruído na tela.
    onda = (np.sin(x * np.pi * 2 * 10) * .5 + .5) ** 1.4

    manchaFerrugem = ruido_tileavel(RES,  7, 5, .60)
    pontos         = ruido_tileavel(RES, 30, 3, .50)
    gr             = ruido_tileavel(RES, 45, 2, .50)

    # A ferrugem se instala nas CALHAS da onda, onde a água para — por isso a máscara é multiplicada
    # por (1-onda). É esse detalhe que faz a chapa parecer chapa e não uma textura de ruído listrada.
    # O -.66 é o que deixa CHAPA à mostra. A .52 a ferrugem cobria quase tudo e o telhado virava uma
    # mancha laranja uniforme — some a ondulação, some a leitura de metal, e sobra ruído colorido.
    ferrugem = np.clip((manchaFerrugem * .8 + pontos * .35 - .66) * 3.0, 0, 1)
    ferrugem = np.clip(ferrugem * (.55 + (1 - onda) * .75), 0, 1)

    h = onda * .70 + gr * .22 + ferrugem * .08   # a ferrugem empola um pouco a chapa

    zinco_v = .60 + onda * .17 - gr * .05
    r_ = zinco_v * (1 - ferrugem) + (.52 + pontos * .16) * ferrugem
    g_ = zinco_v * (1 - ferrugem) + (.30 + pontos * .11) * ferrugem
    b_ = zinco_v * (1 - ferrugem) + (.20 + pontos * .07) * ferrugem
    alb = np.stack([r_, g_, b_], -1).clip(0, 1)

    # Chapa nova reflete; ferrugem é fosca e áspera. A diferença de roughness é metade da leitura.
    rough = (.62 + ferrugem * .34 + gr * .06).clip(.4, 1)
    metal = (1 - ferrugem) * .55
    salvar("telha", alb, h, rough, metal, forca_normal=2.6, ao_raio=7)

# ============================ CHÃO DE TERRA / VIELA ============================
def chao():
    terra = ruido_tileavel(RES, 5, 6, .58)
    grao = ruido_tileavel(RES, 60, 3, .5)
    pedra = ruido_tileavel(RES, 22, 3, .5)
    seixos = (pedra > .70).astype(float)
    seixos = blur(seixos, 1)
    h = terra * .45 + grao * .25 + seixos * .5
    # TERRA DE BARRANCO, NÃO AREIA DE PRAIA. Com a base em .40/.31/.22 e o sol do jogo por cima, o
    # morro inteiro saía cor de duna — a favela parecia construída numa praia. Terra de encosta é
    # escura e puxa pro vermelho do óxido de ferro; o claro que existe nela é o SEIXO, e é ele que
    # deve carregar a variação de luz, não o fundo.
    r_ = .27 + terra * .20 + grao * .09 + seixos * .20
    g_ = .19 + terra * .15 + grao * .08 + seixos * .18
    b_ = .13 + terra * .10 + grao * .06 + seixos * .16
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

# ============================ GRAFFITE ============================
# NÃO é tileável, e é o único mapa aqui que não é: graffite é uma peça única colada numa parede, não um
# padrão que se repete. Sai como RGBA — o alfa é o traço, e o resto é transparente — pra entrar como
# decalque num plano colado na fachada, sem precisar de uma segunda textura por casa.
#
# São quatro peças num atlas 2x2. Cada parede sorteia uma pelo deslocamento da UV, então quatro
# graffites diferentes custam UMA textura e UM material no jogo inteiro.
def graffite():
    import math
    from PIL import ImageDraw
    lado = 512
    im = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = np.random.default_rng(11)
    # Cores de lata, um tom abaixo do puro: spray saturado contra reboco sujo lia como caneta
    # fluorescente. E o traço leva CONTORNO ESCURO por baixo (ver `tag`), que é o que faz pichação
    # parecer pichação e não rabisco — de longe o olho pega a massa escura, não a cor.
    cores = [(198, 62, 54), (222, 186, 68), (66, 146, 190), (226, 224, 214), (118, 74, 156)]
    TINTA_CONTORNO = (26, 22, 20)

    def tag(ox, oy, w, hh, cor, traco):
        """Um rabisco contínuo: pontos de controle sorteados, ligados por linha grossa. Não tenta
        desenhar letra — de longe, numa parede de jogo, o que lê é o GESTO e a cor."""
        n = r.integers(7, 12)
        px = [ox + w * (.1 + .8 * (i / (n - 1))) for i in range(n)]
        py = [oy + hh * (.25 + .5 * r.random()) for _ in range(n)]
        # sobe e desce alternado: dá o zigue-zague de tag em vez de uma linha reta ondulada
        for i in range(n):
            py[i] += (hh * .22) * (1 if i % 2 else -1) * r.random()
        pts = list(zip(px, py))
        # Contorno primeiro, cor por cima: o traço fino de antes (5% da largura da tag) sumia na
        # parede e lia como risco de caneta. Grosso e contornado é o que se enxerga do outro lado da rua.
        d.line(pts, fill=TINTA_CONTORNO + (255,), width=traco + int(traco * .55), joint="curve")
        d.line(pts, fill=cor + (255,), width=traco, joint="curve")
        # respingo e contorno: o que separa "linha desenhada" de "spray"
        for _ in range(int(w * .25)):
            sx = ox + r.random() * w; sy = oy + r.random() * hh
            if r.random() < .5: continue
            rr = r.integers(1, 3)
            d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=cor + (int(60 + r.random() * 90),))
        return pts

    meio = lado // 2
    for cx in (0, meio):
        for cy in (0, meio):
            cor = cores[int(r.integers(0, len(cores)))]
            pts = tag(cx + meio * .07, cy + meio * .16, meio * .86, meio * .68, cor, int(meio * .12))
            # segundo traço mais fino por cima, de outra cor: graffite raramente é de uma cor só
            cor2 = cores[int(r.integers(0, len(cores)))]
            d.line([(x + r.random() * 6 - 3, y + r.random() * 8 - 4) for x, y in pts],
                   fill=cor2 + (210,), width=max(3, int(meio * .035)), joint="curve")

    # Desfoca de leve o ALFA: borda de spray não é recorte de tesoura.
    a = np.asarray(im.split()[3], dtype=float) / 255
    a = blur(a, 1)
    rgb = np.asarray(im.convert("RGB"), dtype=float) / 255
    saida = np.dstack([rgb, np.clip(a * 1.15, 0, 1)])
    Image.fromarray((saida * 255).astype(np.uint8)).save(f"{SAIDA}/graffite.png")

for f in (reboco, tijolo, telha, chao, madeira, graffite):
    f()
    print("ok:", f.__name__)

total = sum(os.path.getsize(os.path.join(SAIDA, f)) for f in os.listdir(SAIDA))
print(f"\n{len(os.listdir(SAIDA))} arquivos, {total/1048576:.2f} MB no total")
for f in sorted(os.listdir(SAIDA)):
    print(f"  {f:22s} {os.path.getsize(os.path.join(SAIDA,f))/1024:6.0f} KB")
