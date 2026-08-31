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
- **4 polos econômicos** (`src/Poles.js`) — Fazenda (oeste, insumo barato), Mercado de Sementes
  (centro), Loja de Armas (nordeste, as armas, a munição de cada uma e o colete) e Receptador
  (sudeste, semente rara e venda), dispostos em quadrilátero pra obrigar a travessia do bairro
  patrulhado.
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
