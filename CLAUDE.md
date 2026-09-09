# Quintal 3D

Jogo 3D de navegador em Three.js, ambientado numa favela brasileira. Codebase em **português** —
nomes, comentários e mensagens de commit. O Bruno joga **no celular Android**, e é por isso que peso
e toque mandam em quase toda decisão daqui.

Publicado em https://bruno2001ka-coder.github.io/cloude-jogo-/

---

## A regra que vale mais que todas

**Meça antes de mexer, e meça de novo depois.**

Não é estilo — é o que separa consertar de chutar. Praticamente todo defeito real neste projeto foi
achado por uma medição, e quase todo erro caro veio de eu ter suposto em vez de medir. Alguns que
estão registrados no código:

- *"o analógico não controla a velocidade"* — parecia sensação, era fato: 0,25 de dedo dava 13,07 m/s
  e 0,75 dava 14,00. Meio dedo ia igual a dedo cheio.
- *"só uma roda que saiu certo girando no eixo"* — as quatro medidas na hora: três estavam inchadas
  (0,594 × 0,363), uma certa (0,370 × 0,364).
- *"ela não me para, fica andando o carro"* — a viatura passou a **0,2 m** dele e seguiu reto.

### O instrumento mente antes do jogo

Isto aconteceu **muitas** vezes. Antes de acreditar num número ruim, desconfie da régua:

- teste escrito como tautologia (somando as constantes que eu mesmo tinha acabado de escolher);
- `core.scene.traverse` pegando o osso de um boneco a 295 m em vez do jogador;
- medir o veículo contra o **terreno cru** depois de ele passar a apoiar em laje — acusou 1,36 m de
  "roda no ar" que era o carro corretamente pousado num degrau;
- `renderer.info` lido depois do pós-processamento: devolveu "1 desenho, 1 triângulo";
- esquecer `updateWorldMatrix` num teste que não renderiza — as matrizes ficam velhas;
- cobrar **distância** da viatura quando o que importa é ela **parar** (ela chega perto de ronda, por
  acaso);
- **duas seguidas** medindo se a polícia segura a estrela: o teste disse *"com policial vendo, a
  ficha cai igual"* — e (1) não havia policial em campo, porque `__manterPolicialParado` mexe em
  `policiais[0]` e eu não tinha plantado ninguém; (2) plantado, ele ainda não via — pregado no lugar
  ele fica com o `olharY` do próprio pé, olhando pra +Z, e um alvo a **3 m de lado** cai fora do
  cone. Era policial de costas, e eu quase concluí que a mecânica não funcionava;
- e o caso recorde, **quatro réguas erradas seguidas** medindo a pontaria da bala:
  1. contar mortes — depende de dano, munição (começa em 24) e cadência; deu 0/8 até a 4 m;
  2. mirar numa altura absoluta fixa — o chão não é plano, o alvo estava noutro nível;
  3. medir o **ângulo** entre a mira e a bala — parece a medida óbvia e não é: as duas retas não saem
     do mesmo ponto, então formam ângulo e mesmo assim se encontram no alvo;
  4. ler a posição da **malha** da bala depois de eu ter feito a malha sair do cano e convergir —
     estava medindo o desenho, não a trajetória.
  A régua que finalmente valeu: *pega o ponto da mira a X metros e mede a distância perpendicular
  dele até a reta da bala*. Ou seja, escreva a régua na forma da PERGUNTA que o jogador faz.

Quando um teste reprova, a primeira pergunta é *"a régua ainda vale?"* — não *"como eu faço passar?"*.

### Nunca afrouxe uma asserção pra ficar verde

Já fiz, e o resultado foi o Bruno achando o defeito por foto. O `motopiloto.mjs` reprovou com
"quadril no selim: 0,496, alvo 0,59"; eu relaxei o limite em vez de consertar a pose. O teste estava
certo. Se a asserção não vale mais porque o mundo mudou, **troque a régua e escreva o porquê** — isso
é diferente de alargar o limite até passar.

### Quando um teste reprova, prove de quem é a culpa

`git stash push src/Arquivo.js`, roda, `git stash pop`. Foi assim que ficou provado que `reagir.mjs`
e `policia3d.mjs` já reprovavam antes das minhas mudanças, e que `reagir` é instável entre rodadas.

---

## Como rodar e testar

Não há build. O jogo é ES modules servidos como arquivo estático.

```
npm run check     # sintaxe dos 43 arquivos + assets referenciados existem
npm test          # colisores
```

### O ambiente de teste (importante)

O sandbox **bloqueia o unpkg**, então o `index.html` de produção (que busca o Three.js de lá) não
carrega aqui. Existe um site local espelhado:

```
scratchpad/runsite/    index.html reescrito + symlinks pra src, assets, tres, sw.js
```

Regenerar o index quando o de produção mudar:

```sh
sed 's#https://unpkg.com/three@0.160.0/build/three.module.js#./tres/build/three.module.js#;
     s#https://unpkg.com/three@0.160.0/examples/jsm/#./tres/examples/jsm/#' index.html > runsite/index.html
cd runsite && python3 -m http.server 8126
```

Os testes de verdade são scripts Playwright em `scratchpad/*.mjs`, apontando pra `localhost:8126`.
Chromium em `/opt/pw-browsers/chromium`.

**Três armadilhas do ambiente, todas já pagas:**

1. **Renderização por software roda a ~1 FPS.** Nunca espere o laço do jogo acontecer sozinho: chame
   `atualizarX(dt)` com passo fixo, que é o mesmo código do celular. E **nunca rode dois navegadores
   ao mesmo tempo** — já matou uma rodada por timeout.
2. **Laço de `atualizar(dt)` não avança o relógio de parede.** Carga de GLB e prazos com
   `performance.now()` nunca disparam dentro dele. Espere do lado de fora, com `waitForTimeout`.
3. **`pkill -f algum.mjs` mata o próprio shell** (o padrão casa com a linha de comando do bash).
   Aconteceu duas vezes.

---

## Publicar

`.github/workflows/static.yml` publica em cada push na `main`. O `github.io` é **bloqueado pelo proxy
daqui** — confira o deploy pelo `mcp__github__actions_list`, nunca abrindo a página.

Antes de subir, mexa nas duas marcas de versão (é por elas que o Bruno confere no celular se recebeu
código novo):

- `VERSAO_JOGO` em `src/main.js`
- `VERSAO` em `sw.js`

O service worker serve **código pela rede primeiro** e **asset pelo cache primeiro**, de propósito:
os arquivos de `src/` não têm hash no nome, e com cache-primeiro o jogador recebia sempre o JS da
sessão anterior — o sintoma foi *"corrigi e continua igual"*.

---

## Como o Bruno trabalha

- **Fala em português, informal, direto.** *"ele afunda"*, *"tá bugada"*, *"vai de rabo"*. Cada uma
  dessas frases é um defeito real e específico. Leve ao pé da letra e vá medir.
- **Manda print.** A foto é a prova final dele. Quando o assunto é visual, tire foto — no mesmo
  enquadramento do print dele quando houver.
- **Coordena dois agentes** neste repositório: eu e a "Manus".
- Regras dele, com as palavras dele:
  - *"sempre estude primeiro, não faça nada sem estudar"*
  - *"sempre apague os lixos, nunca deixar coisas antigas"* — mas ele pode suspender isso; já disse
    *"não é pra tirar nada"*, e aí sobra vira relatório, não deleção
  - desenvolver em `claude/quintal-3d-physics-combat-0gn73c`, com permissão permanente pra fazer
    merge na `main` e publicar
  - **não abrir pull request** a menos que ele peça

---

## Mapa do código

`src/` — 39 módulos ES, sem framework.

| | |
|---|---|
| `core.js` | cena, câmera, renderer, composer |
| `main.js` | o laço do jogo; é quem conhece todos os módulos e os liga |
| `Terrain.js` | relevo, chão em pedaços, `alturaDoChaoDesenhado` |
| `Favela.js` | o bairro inteiro (2.279 linhas): casas, telhados, asfalto, meio-fio |
| `Veiculo.js` | mecânica compartilhada de carro e moto; `Carro.js`/`Moto.js` são só fichas |
| `Rodas.js` | recorta rodas de um modelo fundido |
| `Police.js` | polícia (2.111 linhas): ficha, patrulha, combate, abordagem |
| `Viatura.js` | só dirige. Não conhece a polícia — recebe um alvo e devolve onde estacionou |
| `Personagem.js` | boneco com esqueleto, animações e as poses de veículo |

### Duas fronteiras que valem manter

- **`Viatura.js` não conhece `Police.js`.** Ela recebe `{x,z}` e devolve o ponto onde parou; quem
  sabe o que fazer com isso é o `main.js`. Foi essa separação que deixou a viatura atender o jogador
  sem uma linha nova de direção.
- **`Carro.js` e `Moto.js` são fichas, não código.** Todo conserto de veículo vale pros dois. Onde um
  precisa de comportamento diferente, entra uma **bandeira na ficha** (`plantarAsQuatroRodas`,
  `rolagemDoTerrenoDireta`, `rodasQueGiram`) — nunca um `if(éMoto)` espalhado.

---

## Armadilhas do Three.js que já custaram caro aqui

- **`mergeGeometries` devolve `null` sem avisar** quando as peças da pilha têm atributos diferentes.
  Some com a pilha inteira. Normalize os atributos antes de todo merge.
- **`InstancedMesh` com material PBR texturado renderiza PRETO** neste jogo. Peça texturada tem que
  ir por fusão.
- **Ordem de Euler não é confiável de derivar.** Escrevi a altura de uma quina à mão com os dois
  sinais e os dois discordaram da medição — o erro era de convenção, não de álgebra. Use
  `THREE.Quaternion` ou **aninhe objetos** (um Grupo que esterça, dentro dele a malha que gira).
- **O sinal do esterço é a armadilha que mais mordeu.** A derivação estava seis linhas acima do erro:
  `player.rotation.y -= direcao*taxa` quer dizer que virar pra direita é yaw **negativo**.
  **E eu caí nela de novo depois de escrever isto aqui:** `toldo.rotation.x=-.28` num mesh que já
  tinha `rotation.y=l.giro` tombou o toldo no eixo X **do mundo**, e na foto ele virou uma viga
  amarela diagonal atravessando a rua. Ler a regra não basta — o remédio é não ter a opção: grupo
  que gira em Y, peça que tomba dentro dele.
- **Deslocamento contra parede é medido da FACE, não do eixo.** A vitrine do comércio nasceu 0,05 à
  frente de `prof/2` — mas `ESP_PAREDE=0,18` é **centrada** ali, então a face de fora está em 0,09 e
  a vitrine ficou enterrada no tijolo, invisível em foto nenhuma. Passou pra 0,14.
- **Raio da roda sai em unidades do ARQUIVO.** Converta com `getWorldScale` — sem isso um pneu de
  18 cm virou 48.
- **Uma malha só nunca é cortada.** Nem por distância, nem pelo tronco de visão. Ver "peso".
- **Sem render, `matrixWorld` fica velho.** `updateWorldMatrix(true,true)` antes de medir.

---

## O chão, e por que ele é sagrado

Existem **três superfícies diferentes**, e confundi-las tem consequência visível:

1. `obterElevacao(x,z)` — a curva **analítica**;
2. `alturaDoChaoDesenhado(x,z)` — a **malha que a placa desenha**, que interpola reto entre vértices
   de 1,55 m e fica até 5–9 cm abaixo da curva em terreno convexo;
3. `superficiesAndaveis` — laje, escadão, piso de esconderijo, chão de hospital.

Acabamento colado no chão (fita de asfalto, meio-fio) e **apoio de veículo** assentam na **2**, nunca
na 1. Foi misturar as duas que fez a roda parecer enterrada no asfalto.

**O espaçamento de 1,55 m entre vértices não pode mudar.** O `alturaDoChaoDesenhado` replica a
triangulação exata do `PlaneGeometry`, e é nele que carro, moto, asfalto e meio-fio se apoiam. O chão
foi cortado em 49 pedaços com número inteiro de segmentos justamente pra os vértices ficarem onde
estavam — a prova de que deu certo é `rodanochao` e `asfalto` devolverem os mesmos números, dígito
por dígito.

### Onde o veículo apoia

`alturaDeApoio` pega o **mais alto de três**: chão desenhado, altura em que a fita da rua foi
assentada (`levanteContraQuina`), e superfície andável (`topoAndavelAbaixo`, **compartilhada** com o
jogador — duas versões da mesma pergunta divergem no primeiro ajuste).

E a parte que custou mais: **a origem do raio não pode ser a altura do próprio veículo** — é laço de
realimentação, o carro escala sozinho (medi 45 cm de flutuação). É o apoio **daquela quina no quadro
anterior**, com teto na altura de **quem dirige**. Sem esse teto a memória envelhece: medi a moto
montada a 5,32 m com o piloto a 2,73.

---

## Peso: o que pesa e por quê

Medido, por quadro:

```
antes:  389.428 triângulos · 124 desenhos
depois: 197.668 triângulos · 166 desenhos     (o chão em 49 pedaços de ~75 m)
```

**O princípio:** malha única não pode ser cortada por nada. O chão era *"UMA malha e UM draw call"* —
o comentário se gabava do problema. 224.450 triângulos (58% do quadro) numa malha de 520 m, sempre
desenhada inteira, quase toda dentro da neblina.

**A conta da neblina:** `FogExp2(0.013)` é `exp(-(d·0,013)²)` — **1% de opacidade a 165 m**, 0,1% a
200 m. O mapa tem 520 m de lado. Tudo além disso é desenho pra ninguém ver. O corte por distância
está em 190 m.

### O que ainda está gordo (medido, não feito)

| | |
|---|---|
| casas da favela | fundidas em blocos de 100–132 m — mesmo problema do chão, mesmo remédio |
| `assets/agachado.glb` | **6,08 MB, dos quais 5,76 MB são UMA textura** — e o `personagem.glb`, mesmo boneco e mesmos 3.044 triângulos, carrega ela em 0,24 MB. Pior: o jogo só usa esse arquivo por **um clipe de animação**; nem desenha a malha |
| 3 PNGs de planta | 1920×1920, **12,9 MB somados** — dez vezes a biblioteca de texturas inteira do jogo (1,2 MB a 512px) |
| `riflekar89.glb` | 4,16 MB para 1.020 triângulos |
| `mochila.glb` | 19.992 triângulos — mais que o carro (13.488) |

Total de `assets/`: **32 MB**. Dá pra chegar perto de 10 MB só encolhendo textura, **sem apagar
arquivo nenhum**. `scripts/encolher_glb.py` faz isso — ele remonta o bloco binário inteiro corrigindo
cada `bufferView` (trocar bytes no lugar empurra todos os offsets seguintes).

---

## Trocar um modelo do Meshy

Fluxo já rodado três vezes (SUV, moto, clipe de pilotar):

1. **Use o `_texture.glb`**, não o `_generate.glb` (esse não tem material).
2. `python3 scripts/encolher_glb.py entrada.glb assets/saida.glb` — 21,3 MB viraram 1,04 MB.
3. **Meça a frente no arquivo, não chute.** Duas provas independentes: X médio dos 10% mais altos
   (o guidão/teto é a parte alta e fica na frente) e altura máxima de cada metade. A moto já andou
   **de rabo** por alguém ter chutado esse ângulo.
4. **As rodas saem por ILHAS DE GEOMETRIA**, não por nó nem por material. Eu disse ao Bruno que era
   impossível olhando nós e materiais — estava errado. Solde por **posição** antes de andar pela
   malha: o exportador duplica vértice na costura de UV, e comparando por índice a peça vira várias.
5. Roda tem que **parecer disco** e as peças que entram com ela têm que ser **concêntricas** — sem
   isso ela engole para-lama e escapamento.

### Pose de personagem sobre veículo

A busca de ângulos (descida de coordenada no jogo rodando, `scratchpad/resolveguidao.mjs`) **precisa
cobrar a forma do membro, não só onde a ponta para**. O mesmo erro apareceu duas vezes:

- na perna: sem alvo de joelho, ela acha uma perna dobrada **pra trás** com o pé no lugar certo;
- no braço: mirando só a mão, deu 2,7 cm de erro e um braço **por dentro do tronco** — na foto o
  piloto sumiu.

E meça **ao longo do clipe inteiro**, não só no primeiro quadro: o tronco balança.

**Nem tudo é pra resolver.** Com o quadril já no selim, o erro do pé até a pedaleira ficou: clipe
8,2 cm · `POSE_MOTO` 51,1 cm · **busca 50,9 cm — pior que não mexer**. Ângulos resolvidos pra outra
moto não transferem, e a busca partindo deles só afundou.

---

## O passo: por que o boneco deslizava

*"diminui um pouco a velocidade do meu personagem, está andando deslizando."*

A causa **não era a velocidade** — era o `timeScale` da animação, que fazia `velocidade/4.1` com um
`4.1` que não correspondia a clipe nenhum.

A régua está na forma da pergunta dele: **durante o apoio, o pé anda pra trás no corpo a uma
velocidade `vPe`; se o corpo anda pra frente exatamente a `vPe`, o pé fica parado no mundo.** Razão
corpo/pé = 1,00 é não deslizar. Medida no jogo rodando, em quatro velocidades diferentes, pra provar
que mede o CLIPE e não o número que eu escolhi:

```
andar   0,628 · 0,627 · 0,634 · 0,617  ->  0,62 m/s
correr  2,387 · 2,315 · 2,300          ->  2,33 m/s
```

Com o divisor certo **por clipe**, o deslize é zero em qualquer velocidade:

```
              antes   depois
dedo metade    6,5     1,03
dedo cheio     6,5     1,00
correndo       3,0     1,00
```

A velocidade caiu junto porque ele pediu (4,14 → 2,88 m/s; correndo 7,04 → 4,90). Eram **4,6 alturas
por segundo** num corpo de 90 cm — 8 m/s traduzido pra gente de 1,75 m, velocidade de atleta de 100
metros, com o clipe de ANDAR tocando. Mexer nesse número **não traz o deslize de volta**.

**Duas vezes a régua atrapalhou aqui, e as duas eram grossura de medida:**

1. a primeira versão media deslize em **cm por apoio** — e em velocidade alta o apoio dura menos
   tempo, então acumulava menos centímetros: o número CAÍA enquanto o defeito piorava. Razão, não
   distância;
2. amostrando a 60 Hz, correndo o apoio passou a durar menos que os 5 quadros mínimos do detector e o
   teste devolveu `null`. Quase li como "a corrida desliza infinito". 240 Hz resolveu.

---

## A viatura nos becos

*"quero a viatura andando nos becos tbm, tem uns que dá pra andar sim eu ando."*

Ele estava certo, e o comentário do `Viatura.js` estava errado — **ele mediu o PIOR beco (2,45 m) e
concluiu sobre todos**. Pergunta errada: "o pior cabe?" não é "quais cabem?".

Medindo os 19, varrendo o corpo dela (0,86 × 1,90) deitado na tangente:

```
passagem mais estreita 2,10 m · viatura 0,86 m · sobra 0,62 m de cada lado
19 de 19 passam de ponta a ponta
```

**O que impedia não era largura, era como SAIR.** Beco é sem saída, e voltar de ré é a queixa que
criou o anel (*"eles vai certinho mais volta de ré kkkk"*). A mesma medição deu a resposta de graça:
as pontas mortas **não terminam em parede, terminam no morro livre** (6 m de folga). Então ela sobe,
dá o retorno lá em cima e desce. Zero ré.

**O retorno é uma GOTA, não um meio-círculo.** Meio-círculo devolve o carro paralelo mas **2R de
lado** — 5 m, num beco de 2,1 m. A curva tinha que se dobrar pra voltar ao eixo, e curva dobrada é
bico: o `u` cresce e o mapa anda pra trás. O teste acusou "1 quadro de ré" em 7 dos 8 desvios. Gota
(270° pra um lado, 90° pro outro) devolve no eixo, 2R atrás, virada 180°.

E a gota é **integrada, não derivada**: a conta fecha no papel, mas eu errei o sinal do segundo arco
escrevendo à mão e o teste reprovou de novo. Andar o caminho (gira o rumo, avança na direção dele) não
tem sinal pra errar. É a mesma lição do esterço e do toldo.

**A recusa mora no código, não no teste.** `montarDesvios` varre o traçado montado e descarta o que
não passa — a CatmullRom arredonda a boca do beco, e boca de beco é quina de casa. Dos 11 becos com
boca na rua, **5 viram desvio**.

**E os desvios são montados TARDE, no primeiro quadro.** Na carga do módulo os colisores ainda não
foram fundidos (`otimizarObstaculos` junta caixas, e a fundida é MAIOR). Montando cedo, um desvio
passava na conferência e raspava no jogo — o teste pegou, 2 pontos no primeiro metro.

Medido em 6 min de ronda: entra em beco 10×, sai 10×, **0 quadros dentro de parede, 0 de ré**, e
continua atendendo ocorrência (desembarca a 2,4 m do alvo). `BECO_CHANCE` é 0,12 porque a 0,4 ela
passava 195 s dos 360 s dentro de beco — virava patrulha de beco.

---

## Tiro: som e projétil

**O som** era uma senoide de 185 Hz com envelope, mais um estalo com modulação a 90 Hz. Senoide com
envelope o ouvido lê como **sino** — tem altura, dá pra cantar junto. Tiro é explosão: ruído de banda
larga moldado. A régua é a **planura espectral** (tom → 0, ruído → 1), medida no buffer que o jogo
toca. Instrumentei o código antigo pra ter o número real em vez de chutar:

```
corpo      antes    agora        ataque: 2,0-2,8 ms -> 0,7-1,0 ms
pistola    0,1225   0,6973
rifle      0,1966   0,5813
escopeta   0,2507   0,5500
```

**A precisão** tinha causa estrutural: câmera em terceira pessoa mira, cano dispara, e as duas retas
só se encontram no ponto visado — então a bala acerta a mira em **uma única distância**. Medido, com
o ponto visado a ~12 m: 123 cm fora da mira num alvo a 5 m, 107 cm a 20 m, 75 cm a 50 m.

O conserto é o que os jogos fazem: **a bala voa pela reta da mira** (origem na projeção do jogador
sobre ela — não na câmera, que fica atrás do ombro, nem no cano) e o **cano é só de onde o risco é
desenhado**, convergindo em 0,12 s. Depois: **0 cm em toda distância.**

**O desenho** era uma esfera de 4,5 cm a 95 m/s — 1,58 m por quadro, uma bolinha se teletransportando
com vão preto entre quadros. Nenhum tamanho de esfera conserta: o problema é a forma. Virou cilindro
de 1,8 m deitado na direção do tiro, aditivo, que cobre o vão e lê como risco.

---

## Estado atual

**Reprovando, e não é de mudança recente** (provado com `git stash`):

- `policia3d.mjs` — 3 falhas sobre caixas antigas no modelo do policial.
- `reagir.mjs` — **instável entre rodadas**; já passou 8/8 e reprovou 2/8 com o mesmo código. A
  variação é se o policial ferido chega a ver o jogador.
- `motocabe.mjs` — 4 pontos de 1.086 onde a moto trava em beco. Idêntico no código de antes.

**O ESCONDERIJO SAIU DO JOGO** (a pedido dele: *"tira esconderijos, vai ser só procurando mesmo,
passou um tempo não achou vai sumindo as estrelas"*). O que substituiu:

- a ficha cai com o **tempo sem nenhum policial vivo te ver** — 8 s pra perderem o rastro, 10 s por
  estrela depois disso. A régua é `pol.viu`, a MESMA que decide se atiram em você; qualquer outra
  (distância, por exemplo) deixaria limpar ficha com um policial de frente atirando.
  Medido: ficha 3 zera em **38,1 s** sozinho, e **não cai em 60 s** com um policial de olho;
- os **9 lotes de esconderijo viraram comércio** — 3 botecos, 3 lojas de roupa, 3 de eletrônicos,
  com placa colorida, toldo e vitrine acesa. Mesma casca oca, mesma porta: mudou o **papel**;
- **5 clientes** (eram 4), em casas da fileira marcadas antes de construir e erguidas OCAS. É o
  *"abrir a porta das casas que já existe"*: a casa comum é fundida em blocos de 100 m e a porta
  dela não existe mais como peça — quem tem porta que gira é a casca oca;
- o **cliente da laje saiu**: o teste de alcance media só o terreno em volta e, quando nenhuma laje
  passava, caía num `lajesAlcancaveis=casasPos` que devolvia o morro inteiro, telhado sem acesso
  incluído. Era *"cliente em cima do telhado que não tem nem como eu entregar"*;
- **abastecer a biqueira não chama mais a polícia.** Estava literal: `venderNaBiqueira` chamava
  `ganchosPolicia.denunciar()` → `somarProcurado(1)`. Uma estrela por venda.

Renomes que vieram junto: `refugios`→`casasOcas`, `refugioEmQueEsta`→`casaOcaEmQueEsta`,
`alternarPortaRefugio`→`alternarPorta`, `atualizarRefugios`→`atualizarPortas`. `estaEscondido` não
existe mais, e **`Police.js` não importa mais nada do `WorldGenerator`**.

**As 4 paredes do fim do mapa saíram** (a pedido dele: *"não tem nada a ver elas"*). Eram muros de
terra de **28 m de altura e 520 m de comprimento** em volta do mapa inteiro. Só a MALHA saiu; as 4
caixas de colisão ficaram, invisíveis — sem elas veículo e polícia sairiam do mundo. Provado nos
quatro lados por `scratchpad/barreira.mjs`. Sem o muro, quem chega na borda vê o horizonte pintado
(morros, baía e a cidade ao fundo), não um buraco.

**Sobra encontrada e deixada no lugar** (a pedido dele): em `Viatura.js`, `ocorrenciaAtendida` nunca
é posta como `true` em lugar nenhum — só declarada e zerada.

**Esperando decisão dele:**

- o **rifle apontado pra cima** enquanto pilota (a arma é presa ao osso da mão, e a mão mudou de
  orientação com o clipe): esconder pilotando, ou deitar no guidão?
- encolher as texturas listadas em "o que ainda está gordo".

**Combinado como próximo passo** (palavras dele): *"depois agente vai começar a criar minha casa, em
cima daquele morro que agente criou"*.
