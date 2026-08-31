# Quintal 3D

Jogo 3D em Three.js — bairro brasileiro estilizado, com cultivo/economia, bots nas vielas, fazenda, modo drone e radar.

## Sistemas principais

- **NavMesh + A\*** (`src/NavMesh.js`) — grade de navegação de 463×463 células construída por
  rasterização dos obstáculos (14 ms, preguiçosa), A\* com heurística octile e anti-corner-cutting,
  string-pulling por raycast horizontal. É o que faz a polícia contornar os quarteirões em vez de
  andar contra a parede.
- **Combate** (`src/Police.js`, `src/Bullets.js`, `src/HealthBar.js`) — máquina de estados explícita
  da polícia (patrulha · indo · rapel · confiscando · combate · recuando), balas com trajetória real,
  zonas de acerto por parte do corpo (cabeça ×2, tronco ×1, pernas ×0,6) e barra de vida com armadura.
- **4 polos econômicos** (`src/Poles.js`) — Fazenda (oeste, insumo barato), Mercado de Sementes
  (centro), Loja de Armas (nordeste, munição e colete) e Receptador (sudeste, semente rara e venda),
  dispostos em quadrilátero pra obrigar a travessia do bairro patrulhado.
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

## Publicar no GitHub Pages

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

Depois, no GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**. O jogo fica disponível em `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.
