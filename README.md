# Quintal 3D

Jogo 3D em Three.js — bairro brasileiro estilizado, com cultivo/economia, bots nas vielas, fazenda, modo drone e radar.

## Sistemas principais

- **NavMesh + A\*** (`src/NavMesh.js`) — grade de navegação de 463×463 células construída por
  rasterização dos obstáculos (14 ms, preguiçosa), A\* com heurística octile e anti-corner-cutting,
  string-pulling por raycast horizontal. É o que faz a polícia contornar os quarteirões em vez de
  andar contra a parede.
- **Combate** (`src/Police.js`, `src/Bullets.js`, `src/HealthBar.js`) — máquina de estados explícita
  da polícia (patrulha · indo · pairando · rapel · confiscando · combate · recuando), balas com
  trajetória real, zonas de acerto por parte do corpo (cabeça ×2, tronco ×1, pernas ×0,6) e barra de
  vida com armadura. O helicóptero patrulha o mapa e acha a plantação **por sobrevoo** — só enxerga
  a muda florida, para em cima dela e aí desce os policiais de rapel.
- **Arsenal** (`src/Weapons.js`) — quatro armas com dano, cadência, alcance e dispersão próprios:
  Pistola (a inicial, 121 DPS), Rifle (2 tiros de tronco matam, maior alcance), Escopeta (6 chumbos
  num cone de 5°, arrasa de perto e não faz nada de longe) e Metralhadora (maior DPS do jogo, queima
  9 balas por segundo). Munição é **por arma**, comprada separado. As quatro malhas nascem juntas na
  mão e a troca só alterna a visibilidade — nada de alocar geometria em pleno combate. Segurar o
  botão de tiro atira em rajada no ritmo da arma; o botão redondo ao lado cicla entre as que você tem
  (ou as teclas `Q` e `1`–`4`).
- **Boneco 3D do jogador** (`src/Personagem.js`, `assets/personagem.glb`) — modelo com esqueleto de 24
  ossos e 4 animações (andar, correr, andar atirando, corrida rápida), 3.044 triângulos. Só o jogador
  usa: polícia e NPCs seguem low-poly porque são dezenas na tela e malha com esqueleto custa muito mais
  por quadro. A arma pendura no osso `RightHand` e o colete no osso do peito, então os dois acompanham
  a animação em vez de ficarem rígidos. Carga assíncrona: o jogo roda com o boneco de caixas até o
  arquivo chegar, e segue com ele se o arquivo falhar — é degradação, não tela de erro.
  Duas armadilhas que custaram caro e estão comentadas no código: a textura vinha como **emissiva**
  (o boneco brilharia sozinho à noite, fora do ciclo dia/noite), e **medir uma malha com esqueleto**
  por `Box3` ou por escala de nó dá números fantasiosos — a única medida verdadeira são os vértices já
  deformados pelos ossos, e ela só vale depois do primeiro quadro.
- **Controles de PC** (`src/Input.js`) — padrão de jogo de tiro: botão esquerdo atira, botão direito
  mira, mouse gira a câmera **sem inversão** em nenhum eixo (Pointer Lock), `Shift` corre, `Espaço`
  pula, `E` colhe e abre/fecha porta **sem largar a mira**, `Q` abre o inventário, `Tab`/`X`/rodinha
  trocam de arma e `1`–`4` vão direto numa. Mirando, a suavização do giro sobe de 12 pra 60 e a
  câmera de 7 pra 45 por segundo — o lerp passa a convergir dentro do próprio frame, que é o que tira
  a tremida e o "puxão" da cruz depois que a mão já parou.
- **Mira e movimento** (`src/Camera.js`, `src/Player.js`) — câmera em órbita da cabeça com trava
  contra parede e contra o chão, modo de mira (🎯 no celular, botão direito no PC — o Shift virou
  corrida, como em qualquer jogo de tiro) que
  fecha o FOV, aproxima por cima do ombro, fecha o cone de dispersão a 30% e reduz giro e velocidade
  — precisão custa mobilidade. O movimento tem **step offset**: a colisão horizontal ignora a faixa
  dos pés até 24% da altura do corpo, então degrau é degrau e parede é parede, sem caso especial.
- **4 polos econômicos** (`src/Poles.js`) — cada insumo tem UM ponto de venda, pra o ciclo obrigar a
  travessia do bairro patrulhado: Fazenda (oeste) é a única fonte de vaso e terra, Mercado (centro) a
  única de semente, Loja de Armas (nordeste) vende armas/munição/colete e o Receptador (sudeste) só
  escoa os pacotes.
- **Procurado e esconderijo** (`src/Police.js`, `src/WorldGenerator.js`) — a ficha (★ até 5 no HUD)
  sobe quando a abordagem avança e **+1 por policial morto**, e o nível dimensiona a próxima
  guarnição: 2 policiais com a ficha limpa, até 6 no topo. Abater todos é o caminho mais rápido pra
  trazer mais gente. **Fora do esconderijo nada limpa a ficha** — nem fugir, nem vencer o tiroteio.
  Esconder-se são 8 casas comuns da favela, ocas e com porta que abre e fecha: **entrar e fechar**,
  as duas condições juntas. Aos 3 s escondido a guarnição perde o rastro e recua; a cada 18 s cai uma
  estrela. Sair antes de zerar deixa ficha, e com ficha a polícia recomeça — agora numa **caçada**
  atrás do jogador (sem plantação envolvida), com o holofote seguindo ele. O helicóptero **só entra
  a partir de 3★**: com a ficha baixa o céu fica limpo.
- **Polícia de rua** (`src/Police.js`) — duplas que aparecem de tempos em tempos (a cada 70–140 s, no
  máximo 2 ao mesmo tempo, 75 s de ronda cada) e vão embora sozinhas. Não é vigilância 24 h: com a
  ficha limpa elas rondam pontos aleatórios do bairro, e com ficha aberta 60% das rondas passam a
  mirar os **esconderijos** — é a polícia batendo nas casas onde você costuma se enfiar.
- **Visão da polícia** (`src/Police.js`) — cada policial só enxerga dentro de um **cone à frente**
  (±54° e 18 m com a ficha limpa, abrindo até ±74° e 27 m no topo) **e** com linha de visão livre:
  atrás de parede, dentro de casa com a porta fechada ou pelas costas, ele não vê. Quem avista
  compartilha a última posição pelo **rádio** e os outros convergem pra lá — recebem onde você
  *estava*, não onde você está, então dá pra despistar. A percepção é escalonada entre os policiais
  (uma checagem a cada 0,3 s, defasada) pra não estourar o orçamento de raycast do celular. As
  funções do cone são puras e testadas fora do jogo.
- **Save automático** (`src/Save.js`) — grava dinheiro, inventário, armas compradas, munição por arma,
  plantações (pela **idade** de cada muda, não pelo instante, que reinicia junto com a página),
  procurado e posição; carrega sozinho ao abrir, e sem save o jogo começa do zero. Contra corrupção:
  **dois slots alternados** com número de sequência (a gravação vai sempre no mais velho, então uma
  aba morta no meio da escrita não leva o save junto), **checksum** por slot, versão de formato e
  validação campo a campo — save adulterado degrada pro padrão em vez de espalhar `NaN` pela economia.
  Salva também no `visibilitychange`, que no celular é o último momento garantido antes do navegador
  matar a aba.
- **Colete visível** (`src/Player.js`) — a armadura aparece no corpo (placa, ombreiras e correia
  low-poly, filhas do tronco) enquanto houver colete equipado ou no bolso, e some ao acabar ou na
  morte. Nasce pronta e escondida: o jogo só alterna `.visible`, nunca constrói malha em combate.
- **Cidade no fundo** (`src/Skyline.js`) — anel de 96 prédios em 1 draw call que acompanha a câmera
  como o céu, sem colisão e sem sombra.

O registro da reunião técnica que definiu esses sistemas, com as fórmulas e os números medidos, está
em [`docs/REUNIAO-TECNICA.md`](docs/REUNIAO-TECNICA.md).

Esta versão carrega o Three.js e os addons de pós-processamento por CDN (unpkg), então **precisa de internet pra rodar** — em troca, ganha:

- Pós-processamento real (`EffectComposer` + `UnrealBloomPass`) — bloom nas janelas acesas e no lampião do esconderijo.
- Iluminação de ambiente via HDRI (`assets/ceu.hdr`, CC0 / [Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)) — reflexo mais real em vidro e metal.

A versão single-file 100% offline (sem internet, sem CDN) continua existindo separada — essa aqui é a versão "gráficos web".

## Rodar localmente

Precisa servir por HTTP (não abre direto com duplo-clique, por causa dos módulos ES):

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000/`.

## Publicar

O jogo está no ar em **https://bruno2001ka-coder.github.io/cloude-jogo-/**, publicado pelo GitHub
Pages a cada push na `main` — o workflow é o [`.github/workflows/static.yml`](.github/workflows/static.yml),
que sobe o repositório inteiro como conteúdo estático. Não há build: o jogo é só HTML, módulos ES e
um `.hdr`, e o Pages já serve tudo com o `Content-Type` correto (que é o que os módulos ES exigem).

A origem do Pages precisa estar em **Settings → Pages → Source: GitHub Actions**. Se for trocada
para "Deploy from a branch", o workflow para de publicar.

### Fly.io (legado, fora de uso)

O `Dockerfile`, o `fly.toml` e o `.dockerignore` são de uma tentativa anterior de hospedar no Fly.io
e **não estão em uso** — o deploy vivo é o GitHub Pages. Para um site estático o container só
acrescenta uma etapa de build que pode falhar, sem nenhum ganho. Os arquivos ficam aqui caso um dia
o jogo passe a precisar de servidor.
